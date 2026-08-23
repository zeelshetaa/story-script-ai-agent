import { callStructured } from '../llm/client.ts';
import { FidelityIssue, Project } from '../types.ts';

interface JudgeSceneResponse {
  has_issues: boolean;
  issues: Array<{
    scene_id?: string;
    event_id?: string;
    issue_type: 'hallucination' | 'wrong_relationship' | 'altered_event' | 'missing_character' | 'unsupported_fact';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export async function runStage11Fidelity(project: Project): Promise<Project> {
  const sot = project.source_of_truth;
  if (!sot) throw new Error('Source of Truth missing before Stage 11');

  const fidelityIssues: FidelityIssue[] = [];

  // 1. Code Check: Verify 1-to-1 event mapping
  const eventSceneCount = new Map<string, number>();
  for (const scene of project.scenes) {
    eventSceneCount.set(scene.event_id, (eventSceneCount.get(scene.event_id) || 0) + 1);
  }

  for (const evt of sot.events) {
    const count = eventSceneCount.get(evt.id) || 0;
    if (count === 0) {
      fidelityIssues.push({
        event_id: evt.id,
        issue_type: 'altered_event',
        description: `Source of Truth event '${evt.id}' (${evt.description.slice(0, 40)}...) is missing from generated scenes.`,
        severity: 'high',
      });
    } else if (count > 1) {
      fidelityIssues.push({
        event_id: evt.id,
        issue_type: 'altered_event',
        description: `Source of Truth event '${evt.id}' is duplicated across ${count} scenes.`,
        severity: 'medium',
      });
    }
  }

  // 2. LLM-as-Judge Check on Scenes vs Ground Truth
  const eventMap = new Map(sot.events.map((e) => [e.id, e]));

  // Batch judge all scenes in one structured prompt for speed and comprehensive cross-comparison
  const scenesSummary = project.scenes
    .map(
      (s, idx) =>
        `[SCENE ${idx + 1}] ID: ${s.id} | EventID: ${s.event_id}
Title: ${s.scene_title}
Action: ${s.what_happens}
Narration: ${s.narration}
Dialogue: ${s.dialogue.map((d) => `${d.speaker}: "${d.text}"`).join(' | ') || 'None'}
Image Prompt: ${s.image_prompt}`
    )
    .join('\n\n');

  const groundTruthSummary = sot.events
    .map((e) => `[EVENT ${e.id}] (${e.emotion}, Loc: ${e.location_id}): ${e.description}`)
    .join('\n');

  const prompt = `You are a strict Screenplay Fidelity Judge.
Compare the generated scenes against the locked Ground Truth Source of Truth.
Identify any hallucinations, altered plot outcomes, invented facts, or character relationship contradictions.

LOCKED GROUND TRUTH EVENTS:
${groundTruthSummary}

LOCKED ATOMIC FACTS:
${sot.facts.map((f) => `- ${f}`).join('\n')}

GENERATED SCENES:
${scenesSummary}

Check each scene for:
- "hallucination": scene claims events or magic/technology not in story
- "wrong_relationship": characters behave in direct contradiction to source
- "altered_event": outcome or key death/victory is reversed or modified
- "missing_character": key protagonist omitted from their canonical scene
- "unsupported_fact": specific factual assertion fabricated without basis

Return JSON:
{
  "has_issues": true | false,
  "issues": [
    {
      "scene_id": "scene_01",
      "event_id": "event_01",
      "issue_type": "hallucination | wrong_relationship | altered_event | missing_character | unsupported_fact",
      "description": "Clear explanation of the divergence",
      "severity": "low | medium | high"
    }
  ]
}`;

  const res = await callStructured<JudgeSceneResponse>({
    prompt,
    stage: 11,
    stageName: 'Fidelity & Hallucination Judge',
    projectId: project.status.project_id,
    isLightTask: false,
  });

  if (res && Array.isArray(res.issues)) {
    for (const issue of res.issues) {
      fidelityIssues.push({
        scene_id: issue.scene_id || project.scenes[0]?.id,
        event_id: issue.event_id || sot.events[0]?.id,
        issue_type: issue.issue_type || 'unsupported_fact',
        description: issue.description,
        severity: issue.severity || 'low',
      });
    }
  }

  project.fidelity_issues = fidelityIssues;
  project.stage_outputs['stage_11'] = {
    total_fidelity_issues: fidelityIssues.length,
    fidelity_score_percent: Math.max(0, 100 - fidelityIssues.length * 5),
    verdict: fidelityIssues.length === 0 ? 'PASSED_PERFECT_FIDELITY' : 'PASSED_WITH_NOTICES',
  };

  return project;
}
