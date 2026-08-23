import { callStructured } from '../llm/client.ts';
import { Project, SceneDialogue } from '../types.ts';

interface SceneNarrationResponse {
  narration: string;
  dialogue_performances: Array<{
    speaker: string;
    text: string;
    emotion: string;
  }>;
}

export async function runStage07Narration(project: Project): Promise<Project> {
  const sot = project.source_of_truth;
  if (!sot) throw new Error('Source of Truth missing before Stage 07');

  const charMap = new Map<string, string>();
  for (const c of sot.characters) {
    charMap.set(c.id, c.name);
  }

  // Map dialogues strictly by event_id from Source of Truth
  const dialoguesByEvent = new Map<string, Array<{ speaker: string; text: string }>>();
  for (const d of sot.dialogue_lines) {
    const list = dialoguesByEvent.get(d.event_id) || [];
    const speakerName = charMap.get(d.speaker) || d.speaker;
    list.push({ speaker: speakerName, text: d.text });
    dialoguesByEvent.set(d.event_id, list);
  }

  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    const lockedDialogues = dialoguesByEvent.get(scene.event_id) || [];
    const targetWords = Math.round(scene.duration_seconds * 2.2);

    const prompt = `You are writing the voice-over narration and dialogue delivery for Scene ${i + 1} of ${project.scenes.length}.

SCENE DETAILS:
- Title: ${scene.scene_title}
- Action / What happens: ${scene.what_happens}
- Dominant Emotion: ${scene.emotion}
- Scene Duration: ${scene.duration_seconds} seconds
- Target Narration Word Count: approx ${targetWords} words (spoken at ~150 wpm)

CRITICAL DIALOGUE CONSTRAINT:
The ONLY permitted character dialogue lines for this scene are:
${
  lockedDialogues.length > 0
    ? lockedDialogues.map((d) => `"${d.speaker}": "${d.text}"`).join('\n')
    : 'NO DIALOGUE IN SOURCE STORY FOR THIS EVENT.'
}

STRICT RULE: You are STRICTLY FORBIDDEN from inventing any new dialogue lines for characters.
Only use the exact source dialogue lines provided above. If there is no dialogue, dialogue_performances must be an empty list.

Narration must be cinematic, 3rd-person perspective, resonant, and match the target word count and scene emotion.

Return JSON with:
{
  "narration": "Cinematic voice-over text written in 3rd person matching the emotion and target length",
  "dialogue_performances": [
    ${
      lockedDialogues.length > 0
        ? lockedDialogues
            .map(
              (d) => `{ "speaker": "${d.speaker}", "text": "${d.text.replace(/"/g, '\\"')}", "emotion": "tone of delivery" }`
            )
            .join(',\n    ')
        : ''
    }
  ]
}`;

    const res = await callStructured<SceneNarrationResponse>({
      prompt,
      stage: 7,
      stageName: `Narration & Dialogue (Scene ${i + 1}/${project.scenes.length})`,
      projectId: project.status.project_id,
      isLightTask: false,
    });

    scene.narration = res.narration || `${scene.what_happens}`;

    // Strictly enforce locked dialogue lines (never allow invented dialogue)
    if (lockedDialogues.length > 0) {
      const perfMap = new Map<string, string>();
      if (Array.isArray(res.dialogue_performances)) {
        for (const p of res.dialogue_performances) {
          if (p && p.text) {
            perfMap.set(p.text.trim(), p.emotion || scene.emotion);
          }
        }
      }

      scene.dialogue = lockedDialogues.map((ld) => ({
        speaker: ld.speaker,
        text: ld.text,
        emotion: perfMap.get(ld.text.trim()) || scene.emotion,
      }));
    } else {
      scene.dialogue = [];
    }
  }

  project.stage_outputs['stage_07'] = {
    total_scenes_processed: project.scenes.length,
    total_dialogues_included: project.scenes.reduce((acc, s) => acc + s.dialogue.length, 0),
  };

  return project;
}
