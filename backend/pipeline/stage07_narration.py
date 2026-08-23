from typing import Dict, List, Any
from backend.llm.client import call_structured
from backend.models.schemas import Project, SceneDialogue

def run_stage07_narration(project: Project) -> Project:
    sot = project.source_of_truth
    if not sot:
        raise ValueError("Source of Truth missing before Stage 07")

    char_map: Dict[str, str] = {c.id: c.name for c in sot.characters}

    # Map dialogues strictly by event_id from Source of Truth
    dialogues_by_event: Dict[str, List[Dict[str, str]]] = {}
    for d in sot.dialogue_lines:
        if d.event_id not in dialogues_by_event:
            dialogues_by_event[d.event_id] = []
        speaker_name = char_map.get(d.speaker, d.speaker)
        dialogues_by_event[d.event_id].append({"speaker": speaker_name, "text": d.text})

    for i, scene in enumerate(project.scenes):
        locked_dialogues = dialogues_by_event.get(scene.event_id, [])
        target_words = int(round(scene.duration_seconds * 2.2))

        dialogue_prompt_str = (
            "\n".join([f'"{d["speaker"]}": "{d["text"]}"' for d in locked_dialogues])
            if locked_dialogues
            else "NO DIALOGUE IN SOURCE STORY FOR THIS EVENT."
        )

        prompt = f"""You are writing the voice-over narration and dialogue delivery for Scene {i + 1} of {len(project.scenes)}.

SCENE DETAILS:
- Title: {scene.scene_title}
- Action / What happens: {scene.what_happens}
- Dominant Emotion: {scene.emotion}
- Scene Duration: {scene.duration_seconds} seconds
- Target Narration Word Count: approx {target_words} words (spoken at ~150 wpm)

CRITICAL DIALOGUE CONSTRAINT:
The ONLY permitted character dialogue lines for this scene are:
{dialogue_prompt_str}

STRICT RULE: You are STRICTLY FORBIDDEN from inventing any new dialogue lines for characters.
Only use the exact source dialogue lines provided above. If there is no dialogue, dialogue_performances must be an empty list.

Narration must be cinematic, 3rd-person perspective, resonant, and match the target word count and scene emotion.

Return JSON with:
{{
  "narration": "Cinematic voice-over text written in 3rd person matching the emotion and target length",
  "dialogue_performances": [
    {', '.join([f'{{ "speaker": "{d["speaker"]}", "text": "{d["text"].replace(chr(34), chr(92)+chr(34))}", "emotion": "tone of delivery" }}' for d in locked_dialogues])}
  ]
}}"""

        res = call_structured(
            prompt=prompt,
            stage=7,
            stage_name=f"Narration & Dialogue (Scene {i + 1}/{len(project.scenes)})",
            project_id=project.status.project_id,
            is_light_task=False,
        )

        res_dict = res if isinstance(res, dict) else {}
        scene.narration = res_dict.get("narration") or scene.what_happens

        # Strictly enforce locked dialogue lines (never allow invented dialogue)
        if locked_dialogues:
            perf_map: Dict[str, str] = {}
            if isinstance(res_dict.get("dialogue_performances"), list):
                for p in res_dict["dialogue_performances"]:
                    if isinstance(p, dict) and p.get("text"):
                        perf_map[p["text"].strip()] = p.get("emotion") or scene.emotion

            scene.dialogue = [
                SceneDialogue(
                    speaker=ld["speaker"],
                    text=ld["text"],
                    emotion=perf_map.get(ld["text"].strip()) or scene.emotion,
                )
                for ld in locked_dialogues
            ]
        else:
            scene.dialogue = []

    project.stage_outputs["stage_07"] = {
        "total_scenes_processed": len(project.scenes),
        "total_dialogues_included": sum(len(s.dialogue) for s in project.scenes),
    }

    return project
