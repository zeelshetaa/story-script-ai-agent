import { Project } from '../types.ts';
import { splitIntoSections } from '../utils/chunking.ts';
import { detectLanguage } from '../utils/languageDetect.ts';

export async function runStage01Split(project: Project): Promise<Project> {
  const sections = splitIntoSections(project.raw_story, 350);
  const langResult = detectLanguage(project.raw_story);

  project.sections = sections;
  project.status.detected_language = langResult.code;
  project.stage_outputs['stage_01'] = {
    total_sections: sections.length,
    detected_language_code: langResult.code,
    detected_language_name: langResult.name,
    section_lengths: sections.map((s) => s.split(/\s+/).length),
  };

  return project;
}
