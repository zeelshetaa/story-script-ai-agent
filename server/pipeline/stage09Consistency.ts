import { Project } from '../types.ts';

export async function runStage09Consistency(project: Project): Promise<Project> {
  const sot = project.source_of_truth;
  if (!sot) throw new Error('Source of Truth missing before Stage 09');

  const validCharIds = new Set(sot.characters.map((c) => c.id));
  const validCharNames = new Map(sot.characters.map((c) => [c.id, c.name]));
  const validLocIds = new Set(sot.locations.map((l) => l.id));

  let totalIssuesCount = 0;

  for (const scene of project.scenes) {
    const issues: string[] = [];

    // 1. Verify characters present exist in Source of Truth
    for (const charId of scene.characters_present) {
      if (!validCharIds.has(charId)) {
        issues.push(`Unknown character ID '${charId}' present in scene.`);
      }
    }

    // 2. Verify location ID exists in Source of Truth
    if (!validLocIds.has(scene.location_id)) {
      issues.push(`Unknown location ID '${scene.location_id}' assigned to scene.`);
    }

    // 3. Verify character names are referenced in image prompt if characters are present
    const imagePromptLower = (scene.image_prompt || '').toLowerCase();
    for (const charId of scene.characters_present) {
      const charName = validCharNames.get(charId);
      if (charName) {
        const firstName = charName.split(/\s+/)[0].toLowerCase();
        if (!imagePromptLower.includes(firstName) && !imagePromptLower.includes(charName.toLowerCase())) {
          // Soft notice (some prompts refer to generic roles or pronouns)
          issues.push(`Notice: Character name '${charName}' not explicitly mentioned in visual prompt text.`);
        }
      }
    }

    scene.consistency_issues = issues;
    totalIssuesCount += issues.length;
  }

  project.stage_outputs['stage_09'] = {
    total_scenes_checked: project.scenes.length,
    total_issues_flagged: totalIssuesCount,
    status: totalIssuesCount === 0 ? 'CLEAN_AND_CONSISTENT' : 'CONSISTENCY_NOTICES_RECORDED',
  };

  return project;
}
