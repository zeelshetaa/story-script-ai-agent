import json
import re
import time
from datetime import datetime
from typing import Any, Dict, Optional, TypeVar, Union
import requests

from backend.config import settings
from backend.models.schemas import LLMCallLog
from backend.storage.project_store import project_store

T = TypeVar("T")

groq_auth_failed = False
gemini_auth_failed = False

def robust_json_parse(raw: str) -> Any:
    cleaned = raw.strip()

    # Strip Markdown code block wrappers
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    # Locate outermost braces or brackets
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        cleaned = cleaned[first_brace : last_brace + 1]
    else:
        first_bracket = cleaned.find("[")
        last_bracket = cleaned.rfind("]")
        if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
            cleaned = cleaned[first_bracket : last_bracket + 1]

    # Attempt 1: Direct JSON parse
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Attempt 2: Preprocess syntax errors (double closing braces, trailing commas)
    preprocessed = re.sub(r"\}\}\s*,\s*\{", "},{", cleaned)
    preprocessed = re.sub(r"\}\}\s*\]", "}]", preprocessed)
    preprocessed = re.sub(r",\s*([\}\]])", r"\1", preprocessed)

    try:
        return json.loads(preprocessed)
    except Exception:
        pass

    # Attempt 3: Try jsonrepair library if available
    try:
        import jsonrepair
        repaired = jsonrepair.repair_json(preprocessed)
        return json.loads(repaired)
    except Exception:
        pass

    try:
        import jsonrepair
        repaired2 = jsonrepair.repair_json(cleaned)
        return json.loads(repaired2)
    except Exception:
        pass

    raise ValueError(f"Failed to parse JSON output: {cleaned[:120]}...")

def call_gemini_api(model: str, prompt: str, system_prompt: str, api_key: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
        },
    }
    
    resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=120)
    if resp.status_code != 200:
        raise RuntimeError(f"Gemini API error ({resp.status_code}): {resp.text}")
        
    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Unexpected Gemini response structure: {data}") from e

def call_groq_api(model: str, prompt: str, system_prompt: str, api_key: str) -> str:
    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=120)
    if resp.status_code != 200:
        err_body = resp.text
        # Check for failed_generation inside Groq error
        try:
            err_json = resp.json()
            if "error" in err_json and "failed_generation" in err_json["error"]:
                return err_json["error"]["failed_generation"]
        except Exception:
            pass
        raise RuntimeError(f"Groq API error ({resp.status_code}): {err_body}")

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Unexpected Groq response structure: {data}") from e

def call_structured(
    prompt: str,
    stage: int,
    stage_name: str,
    project_id: str,
    system_prompt: str = "You are a professional story analyst and screenwriter. Output only valid JSON.",
    is_light_task: bool = False,
    max_retries: int = 7,
) -> Any:
    global groq_auth_failed, gemini_auth_failed

    constraint_block = (
        "\n\nCRITICAL CONSTRAINT: Return ONLY valid, parseable JSON matching the required schema. "
        "Do not include markdown commentary or code block markers outside JSON."
    )
    full_prompt = prompt + constraint_block

    has_groq = bool(settings.GROQ_API_KEY) and not groq_auth_failed
    has_gemini = bool(settings.GEMINI_API_KEY) and not gemini_auth_failed

    if not has_groq and not has_gemini:
        raise RuntimeError(
            "No active AI API Key found! Please set GROQ_API_KEY or GEMINI_API_KEY in .env or environment variables."
        )

    provider_to_use = "groq" if has_groq else "gemini"
    gemini_models = [settings.GEMINI_MODEL_MAIN] + settings.GEMINI_FALLBACK_MODELS
    groq_models = (
        [settings.GROQ_MODEL_LIGHT] + settings.GROQ_FALLBACK_MODELS
        if is_light_task
        else [settings.GROQ_MODEL_MAIN] + settings.GROQ_FALLBACK_MODELS
    )

    gemini_model_idx = 0
    groq_model_idx = 0
    last_error: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        start_time = time.time()

        if provider_to_use == "groq" and (not settings.GROQ_API_KEY or groq_auth_failed):
            provider_to_use = "gemini"
        if provider_to_use == "gemini" and (not settings.GEMINI_API_KEY or gemini_auth_failed):
            provider_to_use = "groq"

        if provider_to_use == "groq":
            model_name = groq_models[groq_model_idx % len(groq_models)]
        else:
            model_name = gemini_models[gemini_model_idx % len(gemini_models)]

        log_entry = LLMCallLog(
            timestamp=datetime.utcnow().isoformat() + "Z",
            stage=stage,
            stage_name=stage_name,
            attempt=attempt,
            provider=provider_to_use,
            model=model_name,
            status="failed",
        )

        try:
            if provider_to_use == "groq":
                raw_text = call_groq_api(model_name, full_prompt, system_prompt, settings.GROQ_API_KEY)
            else:
                raw_text = call_gemini_api(model_name, full_prompt, system_prompt, settings.GEMINI_API_KEY)

            parsed_data = robust_json_parse(raw_text)

            log_entry.status = "success"
            log_entry.duration_ms = int((time.time() - start_time) * 1000)
            project_store.log_llm_call(project_id, log_entry, parsed_data)

            return parsed_data

        except Exception as err:
            error_msg = str(err)
            last_error = err

            # Check if error contains failed_generation
            candidate_gen = None
            if "failed_generation" in error_msg:
                try:
                    match = re.search(r'"failed_generation":\s*"([^"]+)"', error_msg)
                    if match:
                        candidate_gen = match.group(1).encode("utf-8").decode("unicode_escape")
                except Exception:
                    pass

            if candidate_gen:
                try:
                    recovered = robust_json_parse(candidate_gen)
                    print(f"[LLM] Auto-recovered JSON from failed_generation in Stage {stage}")
                    log_entry.status = "success"
                    log_entry.duration_ms = int((time.time() - start_time) * 1000)
                    project_store.log_llm_call(project_id, log_entry, recovered)
                    return recovered
                except Exception:
                    pass

            log_entry.error = error_msg
            log_entry.duration_ms = int((time.time() - start_time) * 1000)
            project_store.log_llm_call(project_id, log_entry)

            print(f"[LLM] Stage {stage} ({stage_name}) Attempt {attempt}/{max_retries} ({provider_to_use}:{model_name}) failed: {error_msg}")

            is_auth_error = any(k in error_msg for k in ["401", "invalid_api_key", "Invalid API Key", "API_KEY_INVALID"])
            is_quota_error = any(k in error_msg for k in ["429", "Quota exceeded", "RESOURCE_EXHAUSTED", "503", "high demand", "rate_limit_exceeded", "UNAVAILABLE"])
            is_validation_error = any(k in error_msg for k in ["400", "json_validate_failed", "Failed to generate JSON", "Failed to parse JSON"])

            if is_auth_error:
                if provider_to_use == "groq":
                    print("[LLM] Groq auth failed, switching to Gemini.")
                    groq_auth_failed = True
                    provider_to_use = "gemini"
                else:
                    print("[LLM] Gemini auth failed, switching to Groq.")
                    gemini_auth_failed = True
                    provider_to_use = "groq"
            elif is_validation_error:
                if provider_to_use == "groq" and not gemini_auth_failed and bool(settings.GEMINI_API_KEY):
                    print("[LLM] Switching to Gemini provider due to Groq validation error...")
                    provider_to_use = "gemini"
                elif provider_to_use == "gemini" and not groq_auth_failed and bool(settings.GROQ_API_KEY):
                    print("[LLM] Switching to Groq provider due to Gemini error...")
                    provider_to_use = "groq"
                elif provider_to_use == "gemini":
                    gemini_model_idx += 1
                else:
                    groq_model_idx += 1
            elif is_quota_error:
                if provider_to_use == "gemini":
                    gemini_model_idx += 1
                    if gemini_model_idx >= len(gemini_models) and not groq_auth_failed and bool(settings.GROQ_API_KEY):
                        provider_to_use = "groq"
                else:
                    groq_model_idx += 1
                    if groq_model_idx >= len(groq_models) and not gemini_auth_failed and bool(settings.GEMINI_API_KEY):
                        provider_to_use = "gemini"
            else:
                if provider_to_use == "groq" and not gemini_auth_failed and bool(settings.GEMINI_API_KEY):
                    groq_model_idx += 1
                    provider_to_use = "gemini"
                elif provider_to_use == "gemini" and not groq_auth_failed and bool(settings.GROQ_API_KEY):
                    gemini_model_idx += 1
                    provider_to_use = "groq"
                elif provider_to_use == "gemini":
                    gemini_model_idx += 1
                else:
                    groq_model_idx += 1

            if attempt < max_retries:
                backoff_s = min(0.6 * (1.3 ** attempt), 3.0)
                time.sleep(backoff_s)

    raise RuntimeError(f"Stage {stage} ({stage_name}) failed after {max_retries} attempts. Last error: {last_error}")
