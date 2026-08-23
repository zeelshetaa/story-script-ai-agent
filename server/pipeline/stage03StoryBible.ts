import { callStructured } from '../llm/client.ts';
import { Project, StoryBible } from '../types.ts';

export async function runStage03StoryBible(project: Project): Promise<Project> {
  const sot = project.source_of_truth;
  if (!sot) throw new Error('Source of Truth missing before Stage 03');

  const charSummary = sot.characters.map((c) => `${c.name} (${c.gender}, ${c.age}): ${c.appearance}`).join('\n');
  const eventSummary = sot.events.map((e) => `[Event ${e.order_index}] ${e.description} (${e.emotion})`).join('\n');
  const factsSummary = sot.facts.map((f) => `- ${f}`).join('\n');

  const prompt = `You are creating a comprehensive Story Bible for a cinematic adaptation.
The detected story language is: ${sot.detected_language}.
Please write the Story Bible in the detected story language (or authentic bilingual terms where appropriate).

Source Facts & Characters:
CHARACTERS:
${charSummary}

CHRONOLOGICAL EVENTS:
${eventSummary}

ATOMIC FACTS:
${factsSummary}

Generate the Story Bible JSON with:
{
  "title": "Compelling, evocative title for the video script",
  "summary": "2-3 polished sentences capturing the core premise, central conflict, and emotional resolution",
  "genre": "e.g. Mythological Fantasy, Historical Drama, Sci-Fi Thriller, Folk Tale, Romance, Action",
  "theme": "Core philosophical or moral message of the narrative",
  "important_facts": ["Key world rule 1", "Key world rule 2", "Key constraint 3"],
  "cultural_context": ["Cultural traditions, setting motifs, dialect notes, historical or mythical references"]
}`;

  const res = await callStructured<StoryBible>({
    prompt,
    stage: 3,
    stageName: 'Story Bible Generation',
    projectId: project.status.project_id,
    isLightTask: false,
  });

  const storyBible: StoryBible = {
    title: res.title || 'Cinematic Story Script',
    summary: res.summary || 'A compelling cinematic journey through timeless storytelling.',
    genre: res.genre || 'Cinematic Drama',
    theme: res.theme || 'Courage, Destiny, and Truth',
    important_facts: Array.isArray(res.important_facts) ? res.important_facts : sot.facts.slice(0, 5),
    cultural_context: Array.isArray(res.cultural_context) ? res.cultural_context : [],
    language: sot.detected_language,
  };

  project.story_bible = storyBible;
  project.stage_outputs['stage_03'] = storyBible;

  return project;
}
