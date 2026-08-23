from backend.llm.client import call_structured
from backend.models.schemas import Project, StoryBible

def run_stage03_story_bible(project: Project) -> Project:
    sot = project.source_of_truth
    if not sot:
        raise ValueError("Source of Truth missing before Stage 03")

    char_summary = "\n".join([f"{c.name} ({c.gender}, {c.age}): {c.appearance}" for c in sot.characters])
    event_summary = "\n".join([f"[Event {e.order_index}] {e.description} ({e.emotion})" for e in sot.events])
    facts_summary = "\n".join([f"- {f}" for f in sot.facts])

    prompt = f"""You are creating a comprehensive Story Bible for a cinematic adaptation.
The detected story language is: {sot.detected_language}.
Please write the Story Bible in the detected story language (or authentic bilingual terms where appropriate).

Source Facts & Characters:
CHARACTERS:
{char_summary}

CHRONOLOGICAL EVENTS:
{event_summary}

ATOMIC FACTS:
{facts_summary}

Generate the Story Bible JSON with:
{{
  "title": "Compelling, evocative title for the video script",
  "summary": "2-3 polished sentences capturing the core premise, central conflict, and emotional resolution",
  "genre": "e.g. Mythological Fantasy, Historical Drama, Sci-Fi Thriller, Folk Tale, Romance, Action",
  "theme": "Core philosophical or moral message of the narrative",
  "important_facts": ["Key world rule 1", "Key world rule 2", "Key constraint 3"],
  "cultural_context": ["Cultural traditions, setting motifs, dialect notes, historical or mythical references"]
}}"""

    res = call_structured(
        prompt=prompt,
        stage=3,
        stage_name="Story Bible Generation",
        project_id=project.status.project_id,
        is_light_task=False,
    )

    res_dict = res if isinstance(res, dict) else {}
    story_bible = StoryBible(
        title=res_dict.get("title") or "Cinematic Story Script",
        summary=res_dict.get("summary") or "A compelling cinematic journey through timeless storytelling.",
        genre=res_dict.get("genre") or "Cinematic Drama",
        theme=res_dict.get("theme") or "Courage, Destiny, and Truth",
        important_facts=res_dict.get("important_facts") if isinstance(res_dict.get("important_facts"), list) else sot.facts[:5],
        cultural_context=res_dict.get("cultural_context") if isinstance(res_dict.get("cultural_context"), list) else [],
        language=sot.detected_language,
    )

    project.story_bible = story_bible
    project.stage_outputs["stage_03"] = story_bible.model_dump()

    return project
