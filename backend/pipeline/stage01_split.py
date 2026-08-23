from backend.models.schemas import Project
from backend.utils.chunking import split_into_sections
from backend.utils.language_detect import detect_language

def run_stage01_split(project: Project) -> Project:
    sections = split_into_sections(project.raw_story, 350)
    lang_result = detect_language(project.raw_story)

    project.sections = sections
    project.status.detected_language = lang_result["code"]
    project.stage_outputs["stage_01"] = {
        "total_sections": len(sections),
        "detected_language_code": lang_result["code"],
        "detected_language_name": lang_result["name"],
        "section_lengths": [len(s.split()) for s in sections],
    }

    return project
