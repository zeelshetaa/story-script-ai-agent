from typing import List, Dict, Any
from backend.llm.client import call_structured
from backend.models.schemas import CharacterProfile, LocationProfile, Project

def run_stage04_profiles(project: Project) -> Project:
    sot = project.source_of_truth
    if not sot:
        raise ValueError("Source of Truth missing before Stage 04")

    character_profiles: List[CharacterProfile] = []

    # Enhance each character with LLM while enforcing strict verbatim locking on physical traits
    for locked_char in sot.characters:
        prompt = f"""You are a cinematic character designer. Enhance this character's psychological and performance profile without altering any physical appearance or attire.

LOCKED Character Base Data:
- ID: {locked_char.id}
- Name: {locked_char.name}
- Age: {locked_char.age}
- Gender: {locked_char.gender}
- Appearance: {locked_char.appearance}
- Clothing: {locked_char.clothing}
- Existing Relationships: {', '.join(locked_char.relationships)}

Return JSON with:
{{
  "id": "{locked_char.id}",
  "role": "e.g. Protagonist, Antagonist, Mentor, Sage, Catalyst, Loyal Companion, Narrator",
  "personality": "Psychological depth, core motivations, internal conflicts, temperament",
  "traits": ["trait 1", "trait 2", "trait 3", "trait 4"],
  "voice_style": "Vocal tone, cadence, rhythm, emotional resonance (e.g. deep baritone with quiet authority, rapid breathless whisper)",
  "relationships": ["List of dynamic relationships with specific context"]
}}"""

        enhanced = call_structured(
            prompt=prompt,
            stage=4,
            stage_name=f"Character Profile ({locked_char.name})",
            project_id=project.status.project_id,
            is_light_task=True,
        )

        enh_dict = enhanced if isinstance(enhanced, dict) else {}

        # CRITICAL ENFORCEMENT: Locked fields are COPIED VERBATIM from Source of Truth
        profile = CharacterProfile(
            id=locked_char.id,
            name=locked_char.name,
            gender=locked_char.gender,      # Locked verbatim
            age=locked_char.age,            # Locked verbatim
            appearance=locked_char.appearance,  # Locked verbatim
            clothing=locked_char.clothing,      # Locked verbatim
            role=enh_dict.get("role") or "Main Character",
            personality=enh_dict.get("personality") or "Determined and courageous.",
            traits=enh_dict.get("traits") if isinstance(enh_dict.get("traits"), list) else ["Focused", "Resilient"],
            voice_style=enh_dict.get("voice_style") or "Clear, natural delivery.",
            relationships=(
                enh_dict.get("relationships")
                if isinstance(enh_dict.get("relationships"), list) and enh_dict.get("relationships")
                else locked_char.relationships
            ),
        )
        character_profiles.append(profile)

    location_profiles: List[LocationProfile] = []

    # Enhance locations
    for locked_loc in sot.locations:
        prompt = f"""Enhance the visual cinematography profile for this story location.

LOCKED Location Base Data:
- ID: {locked_loc.id}
- Name: {locked_loc.name}
- Description: {locked_loc.description}

Return JSON with:
{{
  "id": "{locked_loc.id}",
  "mood": "Atmospheric mood (e.g. ancient mystical solitude, bustling marketplace energy, ominous gothic dread)",
  "time_of_day_default": "morning | afternoon | golden hour | sunset | night | blue hour",
  "visual_style": "Cinematography visual references, lighting setup, color palette, texture, lens choices"
}}"""

        enhanced_loc = call_structured(
            prompt=prompt,
            stage=4,
            stage_name=f"Location Profile ({locked_loc.name})",
            project_id=project.status.project_id,
            is_light_task=True,
        )

        enh_loc_dict = enhanced_loc if isinstance(enhanced_loc, dict) else {}

        location_profiles.append(
            LocationProfile(
                id=locked_loc.id,
                name=locked_loc.name,
                description=locked_loc.description,  # Locked verbatim
                mood=enh_loc_dict.get("mood") or "Atmospheric and rich in atmosphere.",
                time_of_day_default=enh_loc_dict.get("time_of_day_default") or "day",
                visual_style=enh_loc_dict.get("visual_style") or "Cinematic wide angles with natural lighting.",
            )
        )

    project.characters = character_profiles
    project.locations = location_profiles
    project.stage_outputs["stage_04"] = {
        "characters_count": len(character_profiles),
        "locations_count": len(location_profiles),
        "checkpoint_pending": True,
    }

    return project
