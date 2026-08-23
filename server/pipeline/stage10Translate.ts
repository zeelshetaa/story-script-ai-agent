import { callStructured } from '../llm/client.ts';
import { Project, SceneDialogue } from '../types.ts';
import { LANGUAGE_MAP } from '../utils/languageDetect.ts';

interface TranslatedSceneResponse {
  scene_title: string;
  what_happens: string;
  narration: string;
  dialogue: Array<{
    speaker: string;
    text: string;
    emotion?: string;
  }>;
}

export async function runStage10Translate(project: Project): Promise<Project> {
  const detectedLang = project.status.detected_language || 'en';
  const targetLang = project.status.target_language || 'en';

  if (detectedLang.toLowerCase() === targetLang.toLowerCase()) {
    project.stage_outputs['stage_10'] = {
      skipped: true,
      reason: `Target language (${targetLang}) matches source story language (${detectedLang}).`,
    };
    return project;
  }

  const targetLangName = LANGUAGE_MAP[targetLang]?.name || targetLang;

  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];

    const prompt = `You are an expert literary and screenplay translator specializing in cross-lingual adaptations.
Translate this scene script into: ${targetLangName} (${targetLang}).

ORIGINAL SCENE:
- Title: ${scene.scene_title}
- What Happens: ${scene.what_happens}
- Narration: ${scene.narration}
- Dialogue:
${
  scene.dialogue.length > 0
    ? scene.dialogue.map((d) => `  "${d.speaker}": "${d.text}" [${d.emotion || 'neutral'}]`).join('\n')
    : '  (No dialogue)'
}

RULES:
1. Provide a fluent, natural semantic translation (not robotic word-for-word) preserving drama, cultural nuance, and emotional resonance.
2. STRICT RULE: Character names and location names MUST NOT be translated or changed into foreign names. Keep them intact.
3. Keep speaker names intact.

Return JSON:
{
  "scene_title": "Translated scene title",
  "what_happens": "Translated action text",
  "narration": "Translated voice-over narration",
  "dialogue": [
    ${
      scene.dialogue.length > 0
        ? scene.dialogue
            .map(
              (d) =>
                `{ "speaker": "${d.speaker}", "text": "Translated dialogue line", "emotion": "${
                  d.emotion || 'neutral'
                }" }`
            )
            .join(',\n    ')
        : ''
    }
  ]
}`;

    const res = await callStructured<TranslatedSceneResponse>({
      prompt,
      stage: 10,
      stageName: `Translation to ${targetLangName} (Scene ${i + 1}/${project.scenes.length})`,
      projectId: project.status.project_id,
      isLightTask: false,
    });

    if (res.scene_title) scene.scene_title = res.scene_title;
    if (res.what_happens) scene.what_happens = res.what_happens;
    if (res.narration) scene.narration = res.narration;

    if (Array.isArray(res.dialogue) && res.dialogue.length === scene.dialogue.length) {
      scene.dialogue = res.dialogue.map((td, idx) => ({
        speaker: scene.dialogue[idx].speaker, // preserve exact speaker name
        text: td.text || scene.dialogue[idx].text,
        emotion: td.emotion || scene.dialogue[idx].emotion,
      }));
    }
  }

  project.stage_outputs['stage_10'] = {
    translated_to: targetLangName,
    scenes_translated: project.scenes.length,
  };

  return project;
}
