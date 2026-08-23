import { callStructured } from '../llm/client.ts';
import { Project, SectionTone } from '../types.ts';

interface ToneResult {
  tone: string;
  pacing: string;
  emotional_arc: string;
  key_themes: string[];
}

export async function runStage02Tone(project: Project): Promise<Project> {
  const sections = project.sections && project.sections.length > 0 ? project.sections : [project.raw_story];
  const sectionTones: SectionTone[] = [];

  for (let i = 0; i < sections.length; i++) {
    const sectionText = sections[i];
    const prompt = `Analyze the tone, pacing, and emotional rhythm of Section ${i + 1} of ${sections.length}:

Section Text:
"""
${sectionText}
"""

Return JSON with:
{
  "tone": "tense | dramatic | peaceful | melancholic | suspenseful | triumphant | comic | mystical | energetic",
  "pacing": "slow | medium | fast | accelerating",
  "emotional_arc": "One concise sentence describing the emotional trajectory across this section",
  "key_themes": ["theme 1", "theme 2", "theme 3"]
}`;

    const res = await callStructured<ToneResult>({
      prompt,
      stage: 2,
      stageName: `Section Tone Extraction (${i + 1}/${sections.length})`,
      projectId: project.status.project_id,
      isLightTask: true,
    });

    sectionTones.push({
      section_index: i + 1,
      tone: res.tone || 'dramatic',
      pacing: res.pacing || 'medium',
      emotional_arc: res.emotional_arc || 'Story moves forward with narrative tension.',
      key_themes: Array.isArray(res.key_themes) ? res.key_themes : ['Destiny', 'Action'],
    });
  }

  project.section_tones = sectionTones;
  project.stage_outputs['stage_02'] = {
    section_tones: sectionTones,
  };

  return project;
}
