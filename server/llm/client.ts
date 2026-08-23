import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { jsonrepair } from 'jsonrepair';
import { config } from '../config.ts';
import { projectStore } from '../storage/projectStore.ts';
import { LLMCallLog } from '../types.ts';

// Lazy client initializations
let groqClientInstance: Groq | null = null;
let geminiClientInstance: GoogleGenAI | null = null;

let groqAuthFailed = false;
let geminiAuthFailed = false;

function getGroqClient(): Groq | null {
  const key = config.groqApiKey;
  if (key && !groqAuthFailed) {
    if (!groqClientInstance) {
      groqClientInstance = new Groq({ apiKey: key });
    }
    return groqClientInstance;
  }
  return null;
}

function getGeminiClient(): GoogleGenAI | null {
  const key = config.geminiApiKey;
  if (key && !geminiAuthFailed) {
    if (!geminiClientInstance) {
      geminiClientInstance = new GoogleGenAI({
        apiKey: key,
      });
    }
    return geminiClientInstance;
  }
  return null;
}

export interface StructuredCallParams {
  prompt: string;
  systemPrompt?: string;
  stage: number;
  stageName: string;
  projectId: string;
  isLightTask?: boolean;
  maxRetries?: number;
  expectedSchemaDesc?: string;
  preferredProvider?: 'groq' | 'gemini';
}

export function robustJsonParse<T = any>(raw: string): T {
  let cleaned = raw.trim();

  // Strip Markdown Code Blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  // Find outermost JSON brackets
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else {
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
  }

  // Attempt 1: Direct JSON.parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {}

  // Attempt 2: Fix accidental double closing braces before commas e.g. "}},{" -> "},{" or "}}]" -> "}]"
  let preprocessed = cleaned.replace(/\}\}\s*,\s*\{/g, '},{');
  preprocessed = preprocessed.replace(/\}\}\s*\]/g, '}]');
  preprocessed = preprocessed.replace(/,\s*([\}\]])/g, '$1');

  try {
    return JSON.parse(preprocessed) as T;
  } catch {}

  // Attempt 3: jsonrepair on preprocessed
  try {
    const rep = jsonrepair(preprocessed);
    return JSON.parse(rep) as T;
  } catch {}

  // Attempt 4: jsonrepair on cleaned
  try {
    const rep2 = jsonrepair(cleaned);
    return JSON.parse(rep2) as T;
  } catch {}

  throw new Error(`Failed to parse JSON: ${cleaned.substring(0, 120)}...`);
}

export async function callStructured<T = any>(params: StructuredCallParams): Promise<T> {
  const {
    prompt,
    systemPrompt = 'You are a professional story analyst and screenwriter. Output only valid JSON.',
    stage,
    stageName,
    projectId,
    isLightTask = false,
    maxRetries = 7,
  } = params;

  const constraintBlock =
    '\n\nCRITICAL CONSTRAINT: Return ONLY valid, parseable JSON matching the required schema. Do not include markdown commentary or code block markers outside JSON.';

  const fullPrompt = prompt + constraintBlock;

  const hasGroq = Boolean(config.groqApiKey) && !groqAuthFailed;
  const hasGemini = Boolean(config.geminiApiKey) && !geminiAuthFailed;

  if (!hasGroq && !hasGemini) {
    throw new Error(
      'No active AI API Key found! Please verify GROQ_API_KEY or GEMINI_API_KEY in .env or environment variables.'
    );
  }

  // Initial provider selection: prefer Groq for speed if available, or Gemini
  let providerToUse: 'groq' | 'gemini' = hasGroq ? 'groq' : 'gemini';

  const geminiModels = [config.geminiModelMain, ...config.geminiFallbackModels];
  const groqModels = isLightTask
    ? [config.groqModelLight, ...config.groqFallbackModels]
    : [config.groqModelMain, ...config.groqFallbackModels];

  let geminiModelIdx = 0;
  let groqModelIdx = 0;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();

    // Select active model
    let modelName = '';
    if (providerToUse === 'groq') {
      if (!getGroqClient() || groqAuthFailed) {
        providerToUse = 'gemini';
      }
    }
    if (providerToUse === 'gemini') {
      if (!getGeminiClient() || geminiAuthFailed) {
        providerToUse = 'groq';
      }
    }

    if (providerToUse === 'groq') {
      modelName = groqModels[groqModelIdx % groqModels.length];
    } else {
      modelName = geminiModels[geminiModelIdx % geminiModels.length];
    }

    const logEntry: LLMCallLog = {
      timestamp: new Date().toISOString(),
      stage,
      stage_name: stageName,
      attempt,
      provider: providerToUse,
      model: modelName,
      status: 'failed',
    };

    try {
      let rawResponseText = '';

      if (providerToUse === 'groq') {
        const groq = getGroqClient();
        if (!groq) throw new Error('Groq client unavailable or key disabled');

        const completion = await groq.chat.completions.create({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        });

        rawResponseText = completion.choices[0]?.message?.content || '';
      } else {
        // Gemini API call
        const ai = getGeminiClient();
        if (!ai) throw new Error('Gemini client unavailable');

        const response = await ai.models.generateContent({
          model: modelName,
          contents: fullPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        rawResponseText = response.text || '';
      }

      const parsedData = robustJsonParse<T>(rawResponseText);

      logEntry.status = 'success';
      logEntry.duration_ms = Date.now() - startTime;

      // Persist call log
      await projectStore.logLLMCall(projectId, logEntry, parsedData);

      return parsedData;
    } catch (err: any) {
      // Check if error contains failed_generation (e.g. Groq 400 json_validate_failed)
      let candidateGeneration = '';
      if (err?.error?.failed_generation) {
        candidateGeneration = err.error.failed_generation;
      } else if (typeof err?.message === 'string' && err.message.includes('"failed_generation":')) {
        try {
          const jsonStart = err.message.indexOf('{');
          if (jsonStart !== -1) {
            const parsedErr = JSON.parse(err.message.substring(jsonStart));
            if (parsedErr?.error?.failed_generation) {
              candidateGeneration = parsedErr.error.failed_generation;
            }
          }
        } catch {}
      }

      if (candidateGeneration) {
        try {
          const recovered = robustJsonParse<T>(candidateGeneration);
          console.log(`[LLM] Auto-recovered & repaired JSON from failed_generation in Stage ${stage}`);
          logEntry.status = 'success';
          logEntry.duration_ms = Date.now() - startTime;
          await projectStore.logLLMCall(projectId, logEntry, recovered);
          return recovered;
        } catch (repErr) {
          console.warn(`[LLM] Could not parse failed_generation:`, repErr);
        }
      }

      lastError = err;
      const errorMsg = err?.message || String(err);
      logEntry.error = errorMsg;
      logEntry.duration_ms = Date.now() - startTime;

      await projectStore.logLLMCall(projectId, logEntry);

      console.warn(
        `[LLM] Stage ${stage} (${stageName}) Attempt ${attempt}/${maxRetries} (${providerToUse}:${modelName}) failed: ${errorMsg}`
      );

      const isAuthError =
        errorMsg.includes('401') ||
        errorMsg.includes('invalid_api_key') ||
        errorMsg.includes('Invalid API Key') ||
        errorMsg.includes('API_KEY_INVALID');

      const isQuotaError =
        errorMsg.includes('429') ||
        errorMsg.includes('Quota exceeded') ||
        errorMsg.includes('RESOURCE_EXHAUSTED') ||
        errorMsg.includes('503') ||
        errorMsg.includes('high demand') ||
        errorMsg.includes('rate_limit_exceeded') ||
        errorMsg.includes('UNAVAILABLE');

      const isNotFoundError =
        errorMsg.includes('404') ||
        errorMsg.includes('NOT_FOUND') ||
        errorMsg.includes('model_not_found') ||
        errorMsg.includes('does not exist');

      const isValidationOrFormatError =
        errorMsg.includes('400') ||
        errorMsg.includes('json_validate_failed') ||
        errorMsg.includes('Failed to generate JSON') ||
        errorMsg.includes('Failed to parse JSON');

      if (isAuthError) {
        if (providerToUse === 'groq') {
          console.warn('[LLM] Groq API authentication failed. Switching permanently to Gemini.');
          groqAuthFailed = true;
          providerToUse = 'gemini';
        } else {
          console.warn('[LLM] Gemini API authentication failed. Switching permanently to Groq.');
          geminiAuthFailed = true;
          providerToUse = 'groq';
        }
      } else if (isValidationOrFormatError) {
        // Model produced invalid JSON or failed provider validator - switch provider or model immediately
        if (providerToUse === 'groq' && !geminiAuthFailed && Boolean(config.geminiApiKey)) {
          console.log('[LLM] Switching to Gemini provider due to Groq JSON validation error...');
          providerToUse = 'gemini';
        } else if (providerToUse === 'gemini' && !groqAuthFailed && Boolean(config.groqApiKey)) {
          console.log('[LLM] Switching to Groq provider due to Gemini error...');
          providerToUse = 'groq';
        } else if (providerToUse === 'gemini') {
          geminiModelIdx++;
        } else {
          groqModelIdx++;
        }
      } else if (isQuotaError || isNotFoundError) {
        // Rotate model first within the same provider
        if (providerToUse === 'gemini') {
          geminiModelIdx++;
          console.log(
            `[LLM] Gemini rotating to fallback model: ${geminiModels[geminiModelIdx % geminiModels.length]}`
          );
          if (geminiModelIdx >= geminiModels.length && !groqAuthFailed && Boolean(config.groqApiKey)) {
            console.log('[LLM] Switching to Groq provider due to Gemini limit...');
            providerToUse = 'groq';
          }
        } else {
          groqModelIdx++;
          console.log(`[LLM] Groq rotating to fallback model: ${groqModels[groqModelIdx % groqModels.length]}`);
          if (groqModelIdx >= groqModels.length && !geminiAuthFailed && Boolean(config.geminiApiKey)) {
            console.log('[LLM] Switching to Gemini provider due to Groq limit...');
            providerToUse = 'gemini';
          }
        }
      } else {
        // Other errors (e.g. transient connection)
        if (providerToUse === 'groq' && !geminiAuthFailed && Boolean(config.geminiApiKey)) {
          groqModelIdx++;
          providerToUse = 'gemini';
        } else if (providerToUse === 'gemini' && !groqAuthFailed && Boolean(config.groqApiKey)) {
          geminiModelIdx++;
          providerToUse = 'groq';
        } else if (providerToUse === 'gemini') {
          geminiModelIdx++;
        } else {
          groqModelIdx++;
        }
      }

      if (attempt < maxRetries) {
        const backoffMs = Math.min(600 * Math.pow(1.3, attempt), 3000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new Error(
    `Stage ${stage} (${stageName}) failed after ${maxRetries} attempts. Last error: ${
      lastError?.message || String(lastError)
    }`
  );
}
