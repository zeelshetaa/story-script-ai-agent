import math
from typing import Dict, List
from backend.models.schemas import Project

EMOTION_BONUS_MAP: Dict[str, float] = {
    "intense": 4.0,
    "dramatic": 3.5,
    "suspenseful": 3.5,
    "triumphant": 3.0,
    "grief": 3.0,
    "joyful": 2.0,
    "mystical": 2.5,
    "calm": 1.0,
    "peaceful": 1.0,
    "neutral": 0.0,
}

def get_emotion_bonus(emotion: str) -> float:
    lower = (emotion or "").lower()
    for key, bonus in EMOTION_BONUS_MAP.items():
        if key in lower:
            return bonus
    return 1.5

def get_importance_bonus(title: str, what_happens: str, index: int, total: int) -> float:
    text = f"{title} {what_happens}".lower()
    if "climax" in text or "final battle" in text or "ultimate" in text or index == total - 1:
        return 5.0
    if "conflict" in text or "fight" in text or "confrontation" in text or "betrayal" in text:
        return 3.0
    if index == 0 or "opening" in text or "beginning" in text or "intro" in text:
        return 2.0
    return 0.0

def run_stage06_timeline(project: Project) -> Project:
    sot = project.source_of_truth
    if not sot:
        raise ValueError("Source of Truth missing before Stage 06")
    if not project.scenes:
        raise ValueError("Scenes missing before Stage 06")

    requested_total_seconds = project.status.requested_duration_seconds or 600
    scenes = project.scenes

    event_dialogue_word_count: Dict[str, int] = {}
    for d in sot.dialogue_lines:
        wc = len(d.text.strip().split()) if d.text else 0
        event_dialogue_word_count[d.event_id] = event_dialogue_word_count.get(d.event_id, 0) + wc

    raw_durations: List[float] = []

    for idx, scene in enumerate(scenes):
        what_happens_words = len(scene.what_happens.strip().split()) if scene.what_happens else 20
        dialogue_words = event_dialogue_word_count.get(scene.event_id, 0)

        # Standard narration estimate: ~150 wpm = 2.5 words/second
        estimated_narration_words = max(25.0, min(what_happens_words * 1.2, 75.0))
        narration_duration = estimated_narration_words / 2.5
        dialogue_duration = dialogue_words / 2.8

        emotion_bonus = get_emotion_bonus(scene.emotion)
        importance_bonus = get_importance_bonus(scene.scene_title, scene.what_happens, idx, len(scenes))
        action_complexity = what_happens_words / 8.0

        raw = narration_duration + dialogue_duration + emotion_bonus + importance_bonus + action_complexity
        clamped = max(8.0, min(raw, 120.0))
        raw_durations.append(clamped)

    sum_raw = sum(raw_durations)
    scale = (requested_total_seconds / sum_raw) if sum_raw > 0 else 1.0
    final_durations = [int(round(d * scale)) for d in raw_durations]
    final_durations = [max(8, d) for d in final_durations]

    current_sum = sum(final_durations)
    diff = requested_total_seconds - current_sum

    idx = 0
    while diff != 0 and idx < len(final_durations) * 2:
        target_idx = idx % len(final_durations)
        if diff > 0:
            final_durations[target_idx] += 1
            diff -= 1
        elif diff < 0 and final_durations[target_idx] > 8:
            final_durations[target_idx] -= 1
            diff += 1
        idx += 1

    for i, scene in enumerate(scenes):
        scene.duration_seconds = final_durations[i]

    total_calculated = sum(final_durations)

    project.stage_outputs["stage_06"] = {
        "requested_total_seconds": requested_total_seconds,
        "total_scenes": len(scenes),
        "scene_durations": final_durations,
        "actual_total_seconds": total_calculated,
        "average_scene_seconds": round(total_calculated / len(scenes)),
    }

    return project
