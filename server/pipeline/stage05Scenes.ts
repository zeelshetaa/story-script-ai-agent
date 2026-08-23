import { callStructured } from '../llm/client.ts';
import { Project, Scene } from '../types.ts';

interface SceneGenerationItem {
  event_id: string;
  scene_title: string;
  story_section_index: number;
  characters_present: string[];
  location_id: string;
  time_of_day: string;
  what_happens: string;
  emotion: string;
  transition?: string;
  needs_clarification?: string;
}

interface SceneGenerationResponse {
  scenes: SceneGenerationItem[];
}

export async function runStage05Scenes(project: Project): Promise<Project> {
  const sot = project.source_of_truth;
  if (!sot) throw new Error('Source of Truth missing before Stage 05');

  const events = sot.events;
  const chars = sot.characters;
  const locs = sot.locations;

  const prompt = `You are a Lead Screenwriter creating a master scene-by-scene script breakdown.
CRITICAL MANDATE: You MUST generate EXACTLY ONE scene for EVERY event in the Source of Truth list below.
NO merging events, NO skipping events, NO inventing new events. Order must strictly follow the event order_index.

SOURCE OF TRUTH EVENTS (${events.length} total):
${events
  .map(
    (e) =>
      `[${e.id}] Order: ${e.order_index} | Location: ${e.location_id} | Characters: ${e.characters_involved.join(
        ', '
      )} | Time: ${e.time_of_day} | Emotion: ${e.emotion}\nDescription: ${e.description}`
  )
  .join('\n\n')}

AVAILABLE CHARACTERS:
${chars.map((c) => `- ${c.id}: ${c.name}`).join('\n')}

AVAILABLE LOCATIONS:
${locs.map((l) => `- ${l.id}: ${l.name} (${l.description})`).join('\n')}

Generate JSON with an array of exactly ${events.length} scenes:
{
  "scenes": [
    {
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
    }
  ]
}`;

  const res = await callStructured<SceneGenerationResponse>({
    prompt,
    stage: 5,
    stageName: 'Scene Generation (1-to-1 Event Mapping)',
    projectId: project.status.project_id,
    isLightTask: false,
  });

  const generatedScenes = Array.isArray(res.scenes) ? res.scenes : [];
  const eventSceneMap = new Map<string, SceneGenerationItem>();

  for (const s of generatedScenes) {
    if (s && s.event_id) {
      eventSceneMap.set(s.event_id, s);
    }
  }

  // Strict Validation: Guarantee every event in Source of Truth is covered
  const finalScenes: Scene[] = [];

  events.forEach((evt, idx) => {
    const existing = eventSceneMap.get(evt.id);
    const sceneId = `scene_${String(idx + 1).padStart(2, '0')}`;

    if (existing) {
      finalScenes.push({
        id: sceneId,
        event_id: evt.id,
        scene_title: existing.scene_title || `Scene ${idx + 1}: ${evt.description.slice(0, 40)}...`,
        story_section_index: existing.story_section_index || 1,
        characters_present:
          Array.isArray(existing.characters_present) && existing.characters_present.length > 0
            ? existing.characters_present
            : evt.characters_involved,
        location_id: existing.location_id || evt.location_id,
        time_of_day: existing.time_of_day || evt.time_of_day,
        what_happens: existing.what_happens || evt.description,
        emotion: existing.emotion || evt.emotion,
        duration_seconds: 0, // Will be computed in Stage 06
        narration: '',        // Will be generated in Stage 07
        dialogue: [],        // Will be mapped in Stage 07
        image_prompt: '',    // Will be generated in Stage 08
        video_prompt: '',    // Will be generated in Stage 08
        consistency_issues: [],
        transition: existing.transition || (idx === events.length - 1 ? 'FADE OUT' : 'CUT TO:'),
      });
    } else {
      // Auto-fallback guarantee for missed event
      finalScenes.push({
        id: sceneId,
        event_id: evt.id,
        scene_title: `Scene ${idx + 1}: ${evt.description.slice(0, 40)}`,
        story_section_index: 1,
        characters_present: evt.characters_involved,
        location_id: evt.location_id,
        time_of_day: evt.time_of_day,
        what_happens: evt.description,
        emotion: evt.emotion,
        duration_seconds: 0,
        narration: '',
        dialogue: [],
        image_prompt: '',
        video_prompt: '',
        consistency_issues: [],
        transition: idx === events.length - 1 ? 'FADE OUT' : 'CUT TO:',
      });
    }
  });

  project.scenes = finalScenes;
  project.stage_outputs['stage_05'] = {
    total_scenes: finalScenes.length,
    events_covered: events.length,
    coverage_rate: '100%',
  };

  return project;
}
