import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  get geminiApiKey(): string {
    return process.env.GEMINI_API_KEY || '';
  },
  get groqApiKey(): string {
    return process.env.GROQ_API_KEY || '';
  },
  get groqModelMain(): string {
    return process.env.GROQ_MODEL_MAIN || 'openai/gpt-oss-120b';
  },
  get groqModelLight(): string {
    return process.env.GROQ_MODEL_LIGHT || 'openai/gpt-oss-20b';
  },
  groqFallbackModels: [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b',
    'groq/compound',
    'groq/compound-mini',
  ],
  geminiModelMain: 'gemini-3.1-flash-lite',
  geminiFallbackModels: ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-pro-preview'],
  storagePath: process.env.STORAGE_PATH || path.join(process.cwd(), 'storage'),
  defaultDurationSeconds: parseInt(process.env.DEFAULT_DURATION_SECONDS || '600', 10),
  get preferredProvider(): 'groq' | 'gemini' {
    return (process.env.GROQ_API_KEY ? 'groq' : 'gemini') as 'groq' | 'gemini';
  },
};
