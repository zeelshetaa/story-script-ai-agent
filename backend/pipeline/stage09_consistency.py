from typing import List, Set, Dict
from backend.models.schemas import Project

def run_stage09_consistency(project: Project) -> Project:
    sot = project.source_of_truth
    if not sot:
        raise ValueError("Source of Truth missing before Stage 09")

    valid_char_ids: Set[str] = {c.id for c in sot.characters}
    valid_char_names: Dict[str, str] = {c.id: c.name for c in sot.characters}
    valid_loc_ids: Set[str] = {l.id for l in sot.locations}

    total_issues_count = 0

    for scene in project.scenes:
        issues: List[str] = []

        # 1. Verify characters present exist in Source of Truth
        for char_id in scene.characters_present:
            if char_id not in valid_char_ids:
                issues.append(f"Unknown character ID '{char_id}' present in scene.")

        # 2. Verify location ID exists in Source of Truth
        if scene.location_id not in valid_loc_ids:
            issues.append(f"Unknown location ID '{scene.location_id}' assigned to scene.")

        # 3. Verify character names are referenced in image prompt if characters are present
        image_prompt_lower = (scene.image_prompt or "").lower()
        for char_id in scene.characters_present:
            char_name = valid_char_names.get(char_id)
            if char_name:
                first_name = char_name.split()[0].lower()
                if first_name not in image_prompt_lower and char_name.lower() not in image_prompt_lower:
                    issues.append(f"Notice: Character name '{char_name}' not explicitly mentioned in visual prompt text.")

        scene.consistency_issues = issues
        total_issues_count += len(issues)

    project.stage_outputs["stage_09"] = {
        "total_scenes_checked": len(project.scenes),
        "total_issues_flagged": total_issues_count,
        "status": "CLEAN_AND_CONSISTENT" if total_issues_count == 0 else "CONSISTENCY_NOTICES_RECORDED",
    }

    return project
