from typing import List, Dict, Any
from backend.llm.client import call_structured
from backend.models.schemas import Project, Scene

def run_stage05_scenes(project: Project) -> Project:
    sot = project.source_of_truth
    if not sot:
        raise ValueError("Source of Truth missing before Stage 05")

    events = sot.events
    chars = sot.characters
    locs = sot.locations

    events_str = "\n\n".join(
        [
            f"[{e.id}] Order: {e.order_index} | Location: {e.location_id} | Characters: {', '.join(e.characters_involved)} | Time: {e.time_of_day} | Emotion: {e.emotion}\nDescription: {e.description}"
            for e in events
        ]
    )

    prompt = f"""You are a Lead Screenwriter creating a master scene-by-scene script breakdown.
CRITICAL MANDATE: You MUST generate EXACTLY ONE scene for EVERY event in the Source of Truth list below.
NO merging events, NO skipping events, NO inventing new events. Order must strictly follow the event order_index.

SOURCE OF TRUTH EVENTS ({len(events)} total):
{events_str}

AVAILABLE CHARACTERS:
{chr(10).join([f"- {c.id}: {c.name}" for c in chars])}

AVAILABLE LOCATIONS:
{chr(10).join([f"- {l.id}: {l.name} ({l.description})" for l in locs])}

Generate JSON with an array of exactly {len(events)} scenes:
{{
  "scenes": [
    {{
      "event_id": "event_01",
      "scene_title": "Descriptive, engaging scene title",
      "story_section_index": 1,
      "characters_present": ["char_id1", "char_id2"],
      "location_id": "loc_id",
      "time_of_day": "morning | afternoon | sunset | night | twilight",
      "what_happens": "Detailed cinematic screen action beat-by-beat describing what we see and hear",
      "emotion": "tense | triumphant | suspenseful | grief | heartwarming | mystical",
      "transition": "CUT TO: | DISSOLVE TO: | MATCH CUT TO: | FADE TO BLACK | SMASH CUT TO:",
      "needs_clarification": "Only if event description is contradictory or unfilmable (leave empty string otherwise)"
    }}
  ]
}}"""

    res = call_structured(
        prompt=prompt,
        stage=5,
        stage_name="Scene Generation (1-to-1 Event Mapping)",
        project_id=project.status.project_id,
        is_light_task=False,
    )

    generated_scenes = res.get("scenes", []) if isinstance(res, dict) and isinstance(res.get("scenes"), list) else []
    event_scene_map: Dict[str, Dict[str, Any]] = {}

    for s in generated_scenes:
        if isinstance(s, dict) and s.get("event_id"):
            event_scene_map[s["event_id"]] = s

    # Strict Validation: Guarantee every event in Source of Truth is covered
    final_scenes: List[Scene] = []

    for idx, evt in enumerate(events):
        existing = event_scene_map.get(evt.id)
        scene_id = f"scene_{str(idx + 1).zfill(2)}"

        if existing:
            final_scenes.append(
                Scene(
                    id=scene_id,
                    event_id=evt.id,
                    scene_title=existing.get("scene_title") or f"Scene {idx + 1}: {evt.description[:40]}...",
                    story_section_index=existing.get("story_section_index") or 1,
                    characters_present=(
                        existing.get("characters_present")
                        if isinstance(existing.get("characters_present"), list) and existing.get("characters_present")
                        else evt.characters_involved
                    ),
                    location_id=existing.get("location_id") or evt.location_id,
                    time_of_day=existing.get("time_of_day") or evt.time_of_day,
                    what_happens=existing.get("what_happens") or evt.description,
                    emotion=existing.get("emotion") or evt.emotion,
                    duration_seconds=0,  # Computed in Stage 06
                    narration="",         # Generated in Stage 07
                    dialogue=[],         # Mapped in Stage 07
                    image_prompt="",     # Generated in Stage 08
                    video_prompt="",     # Generated in Stage 08
                    consistency_issues=[],
                    transition=existing.get("transition") or ("FADE OUT" if idx == len(events) - 1 else "CUT TO:"),
                )
            )
        else:
            # Fallback
            final_scenes.append(
                Scene(
                    id=scene_id,
                    event_id=evt.id,
                    scene_title=f"Scene {idx + 1}: {evt.description[:40]}",
                    story_section_index=1,
                    characters_present=evt.characters_involved,
                    location_id=evt.location_id,
                    time_of_day=evt.time_of_day,
                    what_happens=evt.description,
                    emotion=evt.emotion,
                    duration_seconds=0,
                    narration="",
                    dialogue=[],
                    image_prompt="",
                    video_prompt="",
                    consistency_issues=[],
                    transition="FADE OUT" if idx == len(events) - 1 else "CUT TO:",
                )
            )

    project.scenes = final_scenes
    project.stage_outputs["stage_05"] = {
        "total_scenes": len(final_scenes),
        "events_covered": len(events),
        "coverage_rate": "100%",
    }

    return project
