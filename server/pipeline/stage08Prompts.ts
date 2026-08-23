import { callStructured } from '../llm/client.ts';
import { Project } from '../types.ts';

interface PromptPolishResponse {
  cinematic_image_prompt: string;
  cinematic_video_prompt: string;
}

export async function runStage08Prompts(project: Project): Promise<Project> {
  const sot = project.source_of_truth;
  if (!sot) throw new Error('Source of Truth missing before Stage 08');

  const charMap = new Map<string, { name: string; appearance: string; clothing: string }>();
  for (const c of sot.characters) {
    charMap.set(c.id, { name: c.name, appearance: c.appearance, clothing: c.clothing });
  }

  const locMap = new Map<string, { name: string; description: string }>();
  for (const l of sot.locations) {
    locMap.set(l.id, { name: l.name, description: l.description });
  }

  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];

    // Build base image prompt programmatically from LOCKED data
    const locInfo = locMap.get(scene.location_id) || { name: 'Setting', description: 'Atmospheric scene location' };
    const charsInScene = (scene.characters_present || []).map((cid) => {
      const c = charMap.get(cid);
      if (c) {
        return `${c.name}: ${c.appearance}, wearing ${c.clothing}`;
      }
      return cid;
    });

    const charsString = charsInScene.length > 0 ? charsInScene.join('; ') : 'No prominent characters visible';
    const programmaticBasePrompt = `Cinematic 35mm film shot of ${scene.scene_title}, set in ${locInfo.name} (${locInfo.description}). Time: ${scene.time_of_day}, atmosphere: ${scene.emotion}. Visible characters: ${charsString}. Action: ${scene.what_happens}. Photorealistic, volumetric cinematic lighting, 8k resolution.`;
    const programmaticVideoPrompt = `Slow cinematic tracking camera movement in ${locInfo.name} at ${scene.time_of_day}, focusing on ${scene.what_happens}, ${scene.emotion} mood, high dynamic range, 4k 24fps.`;

    if (scene.image_prompt && scene.video_prompt) {
      continue; // Already generated
    }

    try {
      const prompt = `You are a Cinematographer and Visual Prompt Engineer for AI visual generators (Midjourney v6, Flux.1, Runway Gen-3, Sora, Pika).
Transform the structured scene breakdown into two production prompts.

PROGRAMMATIC BASE SCENE DATA:
"""
Scene: ${scene.scene_title} | Location: ${locInfo.description} | Time: ${scene.time_of_day} | Characters: [${charsString}] | Action: ${scene.what_happens} | Mood: ${scene.emotion}
"""

RULES:
1. Both prompts MUST be written in English.
2. The image prompt must polish the visual description into photorealistic cinematic English (specify lens e.g. 35mm / 50mm anamorphic, lighting e.g. volumetric golden hour / chiaroscuro, atmospheric haze, color palette, 8k resolution, IMAX film texture).
3. The video prompt must specify dynamic camera motion (e.g. slow dolly in, tracking shot, low-angle tilt, drone sweep) + character physical kinetics + environmental motion (dust, embers, wind).
4. CRITICAL: You CANNOT introduce new characters, alter clothing colors, or invent story events not present in the base data.

Return JSON:
{
  "cinematic_image_prompt": "Cinematic visual prompt for text-to-image AI...",
  "cinematic_video_prompt": "Cinematic camera movement and kinetics prompt for text-to-video AI..."
}`;

      const res = await callStructured<PromptPolishResponse>({
        prompt,
        stage: 8,
        stageName: `Image & Video Prompts (Scene ${i + 1}/${project.scenes.length})`,
        projectId: project.status.project_id,
        isLightTask: true,
      });

      scene.image_prompt = res.cinematic_image_prompt || programmaticBasePrompt;
      scene.video_prompt = res.cinematic_video_prompt || programmaticVideoPrompt;
    } catch (e: any) {
      console.warn(`[Stage 8] Fallback to programmatic prompt for scene ${i + 1}:`, e?.message);
      scene.image_prompt = scene.image_prompt || programmaticBasePrompt;
      scene.video_prompt = scene.video_prompt || programmaticVideoPrompt;
    }

    // Small delay between calls to avoid RPM limits
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  project.stage_outputs['stage_08'] = {
    total_scenes_prompted: project.scenes.length,
    prompts_generated: project.scenes.length * 2,
  };

  return project;
}
