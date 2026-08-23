from typing import List, Dict, Any
from backend.llm.client import call_structured
from backend.models.schemas import Project, SceneDialogue
from backend.utils.language_detect import LANGUAGE_MAP

def run_stage10_translate(project: Project) -> Project:
    detected_lang = project.status.detected_language or "en"
    target_lang = project.status.target_language or "en"

    if detected_lang.lower() == target_lang.lower():
        project.stage_outputs["stage_10"] = {
            "skipped": True,
            "reason": f"Target language ({target_lang}) matches source story language ({detected_lang}).",
        }
        return project

    target_lang_name = LANGUAGE_MAP.get(target_lang, {}).get("name", target_lang)

    for i, scene in enumerate(project.scenes):
        dialogue_str = (
            "\n".join([f'  "{d.speaker}": "{d.text}" [{d.emotion or "neutral"}]' for d in scene.dialogue])
            if scene.dialogue
            else "  (No dialogue)"
        )

        prompt = f"""You are an expert literary and screenplay translator specializing in cross-lingual adaptations.
Translate this scene script into: {target_lang_name} ({target_lang}).

ORIGINAL SCENE:
- Title: {scene.scene_title}
- What Happens: {scene.what_happens}
- Narration: {scene.narration}
- Dialogue:
{dialogue_str}

RULES:
1. Provide a fluent, natural semantic translation (not robotic word-for-word) preserving drama, cultural nuance, and emotional resonance.
2. STRICT RULE: Character names and location names MUST NOT be translated or changed into foreign names. Keep them intact.
3. Keep speaker names intact.

Return JSON:
{{
  "scene_title": "Translated scene title",
  "what_happens": "Translated action text",
  "narration": "Translated voice-over narration",
  "dialogue": [
    {', '.join([f'{{ "speaker": "{d.speaker}", "text": "Translated dialogue line", "emotion": "{d.emotion or "neutral"}" }}' for d in scene.dialogue])}
  ]
}}"""

        res = call_structured(
            prompt=prompt,
            stage=10,
            stage_name=f"Translation to {target_lang_name} (Scene {i + 1}/{len(project.scenes)})",
            project_id=project.status.project_id,
            is_light_task=False,
        )

        res_dict = res if isinstance(res, dict) else {}
        if res_dict.get("scene_title"):
            scene.scene_title = res_dict["scene_title"]
        if res_dict.get("what_happens"):
            scene.what_happens = res_dict["what_happens"]
        if res_dict.get("narration"):
            scene.narration = res_dict["narration"]

        if isinstance(res_dict.get("dialogue"), list) and len(res_dict["dialogue"]) == len(scene.dialogue):
            scene.dialogue = [
                SceneDialogue(
                    speaker=scene.dialogue[idx].speaker,
                    text=td.get("text") or scene.dialogue[idx].text,
                    emotion=td.get("emotion") or scene.dialogue[idx].emotion,
                )
                for idx, td in enumerate(res_dict["dialogue"])
            ]

    project.stage_outputs["stage_10"] = {
        "translated_to": target_lang_name,
        "scenes_translated": len(project.scenes),
    }

    return project
