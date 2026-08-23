import re
import time
from datetime import datetime
from typing import Callable, List, Optional, Dict, Any

from backend.llm.client import call_structured
from backend.models.schemas import (
    ClarificationItem,
    LockedCharacter,
    LockedDialogueLine,
    LockedEvent,
    LockedLocation,
    Project,
    SourceOfTruth,
)
from backend.utils.checksum import compute_source_of_truth_checksum

def normalize_key(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower()).strip()

def are_names_fuzzy_match(name_a: str, name_b: str) -> bool:
    clean_a = normalize_key(name_a)
    clean_b = normalize_key(name_b)
    if not clean_a or not clean_b:
        return False
    if clean_a == clean_b:
        return True
    if clean_a in clean_b or clean_b in clean_a:
        return True
    return False

def run_stage00_ground_truth(
    project: Project,
    on_clarification_needed: Optional[Callable[[ClarificationItem], None]] = None,
) -> Project:
    sections = project.sections if project.sections else [project.raw_story]
    section_extractions: List[Dict[str, Any]] = []

    for i, section_text in enumerate(sections):
        prompt = f"""You are extracting the immutable Ground Truth facts from Section {i + 1} of {len(sections)} of a story.
The story may be in any language (e.g. Hindi, Gujarati, English). Preserve original character names and cultural nuances.

Story Section Text:
\"\"\"
{section_text}
\"\"\"

Extract structured JSON strictly following this schema:
{{
  "characters": [
    {{
      "id": "unique_char_id",
      "name": "Full character name (original language / script or faithful transliteration)",
      "age": "age or age range (e.g. 'approx 35', 'elderly', 'young adult', 'child')",
      "gender": "male | female | non-binary | animal | unknown",
      "appearance": "concrete physical description (height, build, hair, facial features, distinctive marks)",
      "clothing": "specific garments, traditional attire, accessories, colors",
      "relationships": ["relationship to other characters, e.g., 'elder brother of Arjun', 'enemy of Kansa'"]
    }}
  ],
  "locations": [
    {{
      "id": "unique_loc_id",
      "name": "Location name",
      "description": "Architectural/environmental visual details, sensory details, weather, era"
    }}
  ],
  "events": [
    {{
      "id": "sec_{i + 1}_evt_1",
      "order_index": 1,
      "description": "Concrete action/event happening in this section",
      "characters_involved": ["list of character ids/names"],
      "location_id": "location id",
      "time_of_day": "morning | afternoon | sunset | night | twilight",
      "emotion": "dominant emotion (e.g. tense, joyful, grieving, determined, suspenseful)"
    }}
  ],
  "dialogue_lines": [
    {{
      "event_id": "sec_{i + 1}_evt_1",
      "speaker": "character id or name who spoke",
      "text": "Exact direct speech spoken in the story (verbatim from text)"
    }}
  ],
  "facts": [
    "Atomic verified factual statements derived strictly from this section"
  ],
  "ambiguities": [
    "Any critical plot contradiction or unclear character identity that makes script writing impossible (empty list if clear)"
  ]
}}"""

        extraction = call_structured(
            prompt=prompt,
            stage=0,
            stage_name=f"Ground Truth Extraction (Section {i + 1}/{len(sections)})",
            project_id=project.status.project_id,
            is_light_task=False,
        )
        section_extractions.append(extraction if isinstance(extraction, dict) else {})

    # MERGE CHARACTERS WITH FUZZY DEDUPLICATION ("most detailed wins")
    merged_chars: Dict[str, LockedCharacter] = {}
    char_id_remap: Dict[str, str] = {}

    for ext in section_extractions:
        for char in ext.get("characters", []):
            if not char or not char.get("name"):
                continue
            name = char["name"]
            matched_id: Optional[str] = None
            for ex_id, ex_char in merged_chars.items():
                if are_names_fuzzy_match(name, ex_char.name):
                    matched_id = ex_id
                    break

            raw_id = char.get("id") or f"char_{normalize_key(name)}"
            safe_id = matched_id or raw_id

            if not matched_id:
                new_char = LockedCharacter(
                    id=safe_id,
                    name=name,
                    age=char.get("age") or "unknown",
                    gender=char.get("gender") or "unknown",
                    appearance=char.get("appearance") or "Standard human appearance",
                    clothing=char.get("clothing") or "Standard clothing",
                    relationships=char.get("relationships") if isinstance(char.get("relationships"), list) else [],
                )
                merged_chars[safe_id] = new_char
            else:
                existing = merged_chars[matched_id]
                if len(char.get("appearance") or "") > len(existing.appearance):
                    existing.appearance = char.get("appearance")
                if len(char.get("clothing") or "") > len(existing.clothing):
                    existing.clothing = char.get("clothing")
                if existing.age == "unknown" and char.get("age") and char["age"] != "unknown":
                    existing.age = char["age"]
                if existing.gender == "unknown" and char.get("gender") and char["gender"] != "unknown":
                    existing.gender = char["gender"]
                if char.get("relationships"):
                    existing.relationships = list(set(existing.relationships + char["relationships"]))
                if len(name) > len(existing.name):
                    existing.name = name

            char_id_remap[char.get("id", "")] = safe_id
            char_id_remap[name] = safe_id
            char_id_remap[name.lower()] = safe_id

    if not merged_chars:
        merged_chars["char_protagonist"] = LockedCharacter(
            id="char_protagonist",
            name="Protagonist",
            age="Adult",
            gender="unknown",
            appearance="Main character in the story",
            clothing="Appropriate attire",
            relationships=[],
        )

    # MERGE LOCATIONS
    merged_locs: Dict[str, LockedLocation] = {}
    loc_id_remap: Dict[str, str] = {}

    for ext in section_extractions:
        for loc in ext.get("locations", []):
            if not loc or not loc.get("name"):
                continue
            name = loc["name"]
            matched_id = None
            for ex_id, ex_loc in merged_locs.items():
                if are_names_fuzzy_match(name, ex_loc.name):
                    matched_id = ex_id
                    break

            raw_id = loc.get("id") or f"loc_{normalize_key(name)}"
            safe_id = matched_id or raw_id

            if not matched_id:
                merged_locs[safe_id] = LockedLocation(
                    id=safe_id,
                    name=name,
                    description=loc.get("description") or "Story environment",
                )
            else:
                existing_loc = merged_locs[matched_id]
                if len(loc.get("description") or "") > len(existing_loc.description):
                    existing_loc.description = loc.get("description")

            loc_id_remap[loc.get("id", "")] = safe_id
            loc_id_remap[name] = safe_id

    if not merged_locs:
        merged_locs["loc_main"] = LockedLocation(
            id="loc_main",
            name="Main Setting",
            description="Primary environment of the story",
        )

    # MERGE EVENTS
    raw_events: List[Dict[str, Any]] = []
    raw_dialogues: List[Dict[str, Any]] = []

    for ext in section_extractions:
        for evt in ext.get("events", []):
            if not evt or not evt.get("description"):
                continue
            chars_inv = [char_id_remap.get(c, char_id_remap.get(c.lower(), c)) for c in evt.get("characters_involved", [])]
            loc_id = loc_id_remap.get(evt.get("location_id", ""), list(merged_locs.keys())[0])

            raw_events.append({
                "description": evt["description"],
                "characters_involved": chars_inv,
                "location_id": loc_id,
                "time_of_day": evt.get("time_of_day", "day"),
                "emotion": evt.get("emotion", "dramatic"),
                "original_id": evt.get("id"),
            })

        for d in ext.get("dialogue_lines", []):
            if d and d.get("text"):
                raw_dialogues.append({
                    "original_event_id": d.get("event_id"),
                    "speaker": char_id_remap.get(d.get("speaker", ""), d.get("speaker", "")),
                    "text": d["text"],
                })

    if not raw_events:
        raw_events.append({
            "description": project.raw_story[:200],
            "characters_involved": list(merged_chars.keys()),
            "location_id": list(merged_locs.keys())[0],
            "time_of_day": "day",
            "emotion": "dramatic",
            "original_id": "sec_1_evt_1",
        })

    # GLOBAL EVENT RE-INDEXING 1..N
    global_events: List[LockedEvent] = []
    event_id_map: Dict[str, str] = {}

    for idx, evt in enumerate(raw_events):
        global_id = f"event_{str(idx + 1).zfill(2)}"
        if evt.get("original_id"):
            event_id_map[evt["original_id"]] = global_id
        global_events.append(
            LockedEvent(
                id=global_id,
                order_index=idx + 1,
                description=evt["description"],
                characters_involved=evt["characters_involved"],
                location_id=evt["location_id"],
                time_of_day=evt["time_of_day"],
                emotion=evt["emotion"],
            )
        )

    # REMAP DIALOGUE LINES
    global_dialogues: List[LockedDialogueLine] = []
    for d in raw_dialogues:
        mapped_evt_id = event_id_map.get(d["original_event_id"], global_events[0].id)
        global_dialogues.append(
            LockedDialogueLine(
                event_id=mapped_evt_id,
                speaker=d["speaker"],
                text=d["text"],
            )
        )

    # MERGE FACTS
    facts_set = set()
    for ext in section_extractions:
        for f in ext.get("facts", []):
            if f and len(f.strip()) > 3:
                facts_set.add(f.strip())

    detected_lang = project.status.detected_language or "en"
    chars_list = list(merged_chars.values())
    locs_list = list(merged_locs.values())
    facts_list = list(facts_set)

    checksum = compute_source_of_truth_checksum({
        "detected_language": detected_lang,
        "characters": chars_list,
        "locations": locs_list,
        "events": global_events,
        "dialogue_lines": global_dialogues,
        "facts": facts_list,
    })

    sot = SourceOfTruth(
        checksum=checksum,
        detected_language=detected_lang,
        characters=chars_list,
        locations=locs_list,
        events=global_events,
        dialogue_lines=global_dialogues,
        facts=facts_list,
        locked_at=datetime.utcnow().isoformat() + "Z",
    )
    project.source_of_truth = sot

    # AMBIGUITIES CHECK
    has_existing_clar = bool(project.clarifications)
    all_ambiguities = []
    for ext in section_extractions:
        for a in ext.get("ambiguities", []):
            if a and len(a.strip()) > 10:
                all_ambiguities.append(a.strip())

    if all_ambiguities and on_clarification_needed and not has_existing_clar:
        clar_item = ClarificationItem(
            id=f"clar_{int(time.time() * 1000)}",
            stage=0,
            question=f"Ground Truth clarification needed: {all_ambiguities[0]}",
            context=f"The story has ambiguity regarding key details: {'; '.join(all_ambiguities)}",
            options=["Proceed with default interpretation", "Custom clarify in text"],
            created_at=datetime.utcnow().isoformat() + "Z",
        )
        project.clarifications.append(clar_item)
        on_clarification_needed(clar_item)

    project.stage_outputs["stage_00"] = {
        "checksum": checksum,
        "total_characters": len(chars_list),
        "total_locations": len(locs_list),
        "total_events": len(global_events),
        "total_dialogues": len(global_dialogues),
        "total_facts": len(facts_list),
    }

    return project
