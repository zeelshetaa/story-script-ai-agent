import time
from typing import Dict, Any
from backend.llm.client import call_structured
from backend.models.schemas import Project

def run_stage08_prompts(project: Project) -> Project:
    sot = project.source_of_truth
    if not sot:
        raise ValueError("Source of Truth missing before Stage 08")

    char_map = {c.id: {"name": c.name, "appearance": c.appearance, "clothing": c.clothing} for c in sot.characters}
    loc_map = {l.id: {"name": l.name, "description": l.description} for l in sot.locations}

    for i, scene in enumerate(project.scenes):
        loc_info = loc_map.get(scene.location_id, {"name": "Setting", "description": "Atmospheric scene location"})
        chars_in_scene = []
        for cid in scene.characters_present or []:
            c = char_map.get(cid)
            if c:
                chars_in_scene.append(f"{c['name']}: {c['appearance']}, wearing {c['clothing']}")
            else:
                chars_in_scene.append(cid)

        chars_string = "; ".join(chars_in_scene) if chars_in_scene else "No prominent characters visible"
        programmatic_base_prompt = (
            f"Cinematic 35mm film shot of {scene.scene_title}, set in {loc_info['name']} ({loc_info['description']}). "
            f"Time: {scene.time_of_day}, atmosphere: {scene.emotion}. Visible characters: {chars_string}. "
            f"Action: {scene.what_happens}. Photorealistic, volumetric cinematic lighting, 8k resolution."
        )
        programmatic_video_prompt = (
            f"Slow cinematic tracking camera movement in {loc_info['name']} at {scene.time_of_day}, "
            f"focusing on {scene.what_happens}, {scene.emotion} mood, high dynamic range, 4k 24fps."
        )

        if scene.image_prompt and scene.video_prompt:
            continue

        try:
            prompt = f"""You are a Cinematographer and Visual Prompt Engineer for AI visual generators (Midjourney v6, Flux.1, Runway Gen-3, Sora, Pika).
Transform the structured scene breakdown into two production prompts.

PROGRAMMATIC BASE SCENE DATA:
\"\"\"
Scene: {scene.scene_title} | Location: {loc_info['description']} | Time: {scene.time_of_day} | Characters: [{chars_string}] | Action: {scene.what_happens} | Mood: {scene.emotion}
\"\"\"

RULES:
1. Both prompts MUST be written in English.
2. The image prompt must polish the visual description into photorealistic cinematic English (specify lens e.g. 35mm / 50mm anamorphic, lighting e.g. volumetric golden hour / chiaroscuro, atmospheric haze, color palette, 8k resolution, IMAX film texture).
3. The video prompt must specify dynamic camera motion (e.g. slow dolly in, tracking shot, low-angle tilt, drone sweep) + character physical kinetics + environmental motion (dust, embers, wind).
4. CRITICAL: You CANNOT introduce new characters, alter clothing colors, or invent story events not present in the base data.

Return JSON:
{{
  "cinematic_image_prompt": "Cinematic visual prompt for text-to-image AI...",
  "cinematic_video_prompt": "Cinematic camera movement and kinetics prompt for text-to-video AI..."
}}"""

            res = call_structured(
                prompt=prompt,
                stage=8,
                stage_name=f"Image & Video Prompts (Scene {i + 1}/{len(project.scenes)})",
                project_id=project.status.project_id,
                is_light_task=True,
            )

            res_dict = res if isinstance(res, dict) else {}
            scene.image_prompt = res_dict.get("cinematic_image_prompt") or programmatic_base_prompt
            scene.video_prompt = res_dict.get("cinematic_video_prompt") or programmatic_video_prompt
        except Exception as e:
            print(f"[Stage 8] Fallback to programmatic prompt for scene {i + 1}: {e}")
            scene.image_prompt = scene.image_prompt or programmatic_base_prompt
            scene.video_prompt = scene.video_prompt or programmatic_video_prompt

        time.sleep(0.1)

    project.stage_outputs["stage_08"] = {
        "total_scenes_prompted": len(project.scenes),
        "prompts_generated": len(project.scenes) * 2,
    }

    return project
