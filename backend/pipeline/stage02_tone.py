from typing import List, Dict, Any
from backend.llm.client import call_structured
from backend.models.schemas import Project, SectionTone

def run_stage02_tone(project: Project) -> Project:
    sections = project.sections if project.sections else [project.raw_story]
    section_tones: List[SectionTone] = []

    for i, section_text in enumerate(sections):
        prompt = f"""Analyze the tone, pacing, and emotional rhythm of Section {i + 1} of {len(sections)}:

Section Text:
\"\"\"
{section_text}
\"\"\"

Return JSON with:
{{
  "tone": "tense | dramatic | peaceful | melancholic | suspenseful | triumphant | comic | mystical | energetic",
  "pacing": "slow | medium | fast | accelerating",
  "emotional_arc": "One concise sentence describing the emotional trajectory across this section",
  "key_themes": ["theme 1", "theme 2", "theme 3"]
}}"""

        res = call_structured(
            prompt=prompt,
            stage=2,
            stage_name=f"Section Tone Extraction ({i + 1}/{len(sections)})",
            project_id=project.status.project_id,
            is_light_task=True,
        )

        res_dict = res if isinstance(res, dict) else {}
        section_tones.append(
            SectionTone(
                section_index=i + 1,
                tone=res_dict.get("tone") or "dramatic",
                pacing=res_dict.get("pacing") or "medium",
                emotional_arc=res_dict.get("emotional_arc") or "Story moves forward with narrative tension.",
                key_themes=res_dict.get("key_themes") if isinstance(res_dict.get("key_themes"), list) else ["Destiny", "Action"],
            )
        )

    project.section_tones = section_tones
    project.stage_outputs["stage_02"] = {
        "section_tones": [st.model_dump() for st in section_tones],
    }

    return project
