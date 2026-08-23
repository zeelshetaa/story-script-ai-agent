import { Project } from '../types.ts';

const EMOTION_BONUS_MAP: Record<string, number> = {
  intense: 4.0,
  dramatic: 3.5,
  suspenseful: 3.5,
  triumphant: 3.0,
  grief: 3.0,
  joyful: 2.0,
  mystical: 2.5,
  calm: 1.0,
  peaceful: 1.0,
  neutral: 0.0,
};

function getEmotionBonus(emotion: string): number {
  const lower = (emotion || '').toLowerCase();
  for (const [key, bonus] of Object.entries(EMOTION_BONUS_MAP)) {
    if (lower.includes(key)) {
      return bonus;
    }
  }
  return 1.5;
}

function getImportanceBonus(title: string, whatHappens: string, index: number, total: number): number {
  const text = `${title} ${whatHappens}`.toLowerCase();
  if (text.includes('climax') || text.includes('final battle') || text.includes('ultimate') || index === total - 1) {
    return 5.0;
  }
  if (text.includes('conflict') || text.includes('fight') || text.includes('confrontation') || text.includes('betrayal')) {
    return 3.0;
  }
  if (index === 0 || text.includes('opening') || text.includes('beginning') || text.includes('intro')) {
    return 2.0;
  }
  return 0.0;
}

export async function runStage06Timeline(project: Project): Promise<Project> {
  const sot = project.source_of_truth;
  if (!sot) throw new Error('Source of Truth missing before Stage 06');
  if (!project.scenes || project.scenes.length === 0) throw new Error('Scenes missing before Stage 06');

  const requestedTotalSeconds = project.status.requested_duration_seconds || 600;
  const scenes = project.scenes;

  // Build dialogue word count map per event_id
  const eventDialogueWordCount = new Map<string, number>();
  for (const d of sot.dialogue_lines) {
    const wc = d.text ? d.text.trim().split(/\s+/).length : 0;
    eventDialogueWordCount.set(d.event_id, (eventDialogueWordCount.get(d.event_id) || 0) + wc);
  }

  const rawDurations: number[] = [];

  scenes.forEach((scene, idx) => {
    const whatHappensWords = scene.what_happens ? scene.what_happens.trim().split(/\s+/).length : 20;
    const dialogueWords = eventDialogueWordCount.get(scene.event_id) || 0;

    // Standard narration estimate: ~150 wpm = 2.5 words/second
    const estimatedNarrationWords = Math.max(25, Math.min(whatHappensWords * 1.2, 75));
    const narrationDuration = estimatedNarrationWords / 2.5;
    const dialogueDuration = dialogueWords / 2.8;

    const emotionBonus = getEmotionBonus(scene.emotion);
    const importanceBonus = getImportanceBonus(scene.scene_title, scene.what_happens, idx, scenes.length);
    const actionComplexity = whatHappensWords / 8.0;

    const raw = narrationDuration + dialogueDuration + emotionBonus + importanceBonus + actionComplexity;

    // Clamp between min 8s and max 120s
    const clamped = Math.max(8.0, Math.min(raw, 120.0));
    rawDurations.push(clamped);
  });

  const sumRaw = rawDurations.reduce((a, b) => a + b, 0);

  // Normalize proportionally to match requested_duration_seconds
  const scale = sumRaw > 0 ? requestedTotalSeconds / sumRaw : 1.0;
  let finalDurations = rawDurations.map((d) => Math.round(d * scale));

  // Ensure minimum 8s after scaling
  finalDurations = finalDurations.map((d) => Math.max(8, d));

  // Adjust rounding differences so total equals requestedTotalSeconds exactly
  let currentSum = finalDurations.reduce((a, b) => a + b, 0);
  let diff = requestedTotalSeconds - currentSum;

  let idx = 0;
  while (diff !== 0 && idx < finalDurations.length * 2) {
    const targetIndex = idx % finalDurations.length;
    if (diff > 0) {
      finalDurations[targetIndex] += 1;
      diff -= 1;
    } else if (diff < 0 && finalDurations[targetIndex] > 8) {
      finalDurations[targetIndex] -= 1;
      diff += 1;
    }
    idx++;
  }

  scenes.forEach((scene, i) => {
    scene.duration_seconds = finalDurations[i];
  });

  const totalCalculated = finalDurations.reduce((a, b) => a + b, 0);

  project.stage_outputs['stage_06'] = {
    requested_total_seconds: requestedTotalSeconds,
    total_scenes: scenes.length,
    scene_durations: finalDurations,
    actual_total_seconds: totalCalculated,
    average_scene_seconds: Math.round(totalCalculated / scenes.length),
  };

  return project;
}
