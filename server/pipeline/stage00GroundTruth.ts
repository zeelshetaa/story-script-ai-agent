import { callStructured } from '../llm/client.ts';
import {
  ClarificationItem,
  LockedCharacter,
  LockedDialogueLine,
  LockedEvent,
  LockedLocation,
  Project,
  SourceOfTruth,
} from '../types.ts';
import { computeSourceOfTruthChecksum } from '../utils/checksum.ts';

interface SectionExtractionResult {
  characters: Array<{
    id: string;
    name: string;
    age?: string;
    gender?: string;
    appearance?: string;
    clothing?: string;
    relationships?: string[];
  }>;
  locations: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  events: Array<{
    id: string;
    order_index: number;
    description: string;
    characters_involved: string[];
    location_id: string;
    time_of_day?: string;
    emotion?: string;
  }>;
  dialogue_lines: Array<{
    event_id: string;
    speaker: string;
    text: string;
  }>;
  facts: string[];
  ambiguities?: string[];
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function areNamesFuzzyMatch(nameA: string, nameB: string): boolean {
  const cleanA = normalizeKey(nameA);
  const cleanB = normalizeKey(nameB);
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB) return true;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
  return false;
}

export async function runStage00GroundTruth(
  project: Project,
  onClarificationNeeded?: (clarification: ClarificationItem) => Promise<void>
): Promise<Project> {
  const sections = project.sections && project.sections.length > 0 ? project.sections : [project.raw_story];
  const sectionExtractions: SectionExtractionResult[] = [];

  for (let i = 0; i < sections.length; i++) {
    const sectionText = sections[i];
    const prompt = `You are extracting the immutable Ground Truth facts from Section ${i + 1} of ${sections.length} of a story.
The story may be in any language (e.g. Hindi, Gujarati, English). Preserve original character names and cultural nuances.

Story Section Text:
"""
${sectionText}
"""

Extract structured JSON strictly following this schema:
{
  "characters": [
    {
      "id": "unique_char_id",
      "name": "Full character name (original language / script or faithful transliteration)",
      "age": "age or age range (e.g. 'approx 35', 'elderly', 'young adult', 'child')",
      "gender": "male | female | non-binary | animal | unknown",
      "appearance": "concrete physical description (height, build, hair, facial features, distinctive marks)",
      "clothing": "specific garments, traditional attire, accessories, colors",
      "relationships": ["relationship to other characters, e.g., 'elder brother of Arjun', 'enemy of Kansa'"]
    }
  ],
  "locations": [
    {
      "id": "unique_loc_id",
      "name": "Location name",
      "description": "Architectural/environmental visual details, sensory details, weather, era"
    }
  ],
  "events": [
    {
      "id": "sec_${i + 1}_evt_1",
      "order_index": 1,
      "description": "Concrete action/event happening in this section",
      "characters_involved": ["list of character ids/names"],
      "location_id": "location id",
      "time_of_day": "morning | afternoon | sunset | night | twilight",
      "emotion": "dominant emotion (e.g. tense, joyful, grieving, determined, suspenseful)"
    }
  ],
  "dialogue_lines": [
    {
      "event_id": "sec_${i + 1}_evt_1",
      "speaker": "character id or name who spoke",
      "text": "Exact direct speech spoken in the story (verbatim from text)"
    }
  ],
  "facts": [
    "Atomic verified factual statements derived strictly from this section"
  ],
  "ambiguities": [
    "Any critical plot contradiction or unclear character identity that makes script writing impossible (empty list if clear)"
  ]
}`;

    const extraction = await callStructured<SectionExtractionResult>({
      prompt,
      stage: 0,
      stageName: `Ground Truth Extraction (Section ${i + 1}/${sections.length})`,
      projectId: project.status.project_id,
      isLightTask: false,
    });

    sectionExtractions.push(extraction);
  }

  // MERGE ALL SECTIONS WITH FUZZY DEDUPLICATION ("most-detailed wins")
  const mergedCharactersMap = new Map<string, LockedCharacter>();
  const charIdRemap = new Map<string, string>(); // oldId/rawName -> mergedId

  for (const ext of sectionExtractions) {
    if (!ext.characters) continue;
    for (const char of ext.characters) {
      if (!char || !char.name) continue;

      let matchedCharId: string | null = null;
      for (const [existingId, existingChar] of mergedCharactersMap.entries()) {
        if (areNamesFuzzyMatch(char.name, existingChar.name)) {
          matchedCharId = existingId;
          break;
        }
      }

      const rawId = char.id || `char_${normalizeKey(char.name)}`;
      const safeId = matchedCharId || rawId;

      if (!matchedCharId) {
        // New character
        const newChar: LockedCharacter = {
          id: safeId,
          name: char.name,
          age: char.age || 'unknown',
          gender: char.gender || 'unknown',
          appearance: char.appearance || 'Standard human appearance',
          clothing: char.clothing || 'Standard clothing',
          relationships: Array.isArray(char.relationships) ? char.relationships : [],
        };
        mergedCharactersMap.set(safeId, newChar);
      } else {
        // Merge with existing ("most detailed wins")
        const existing = mergedCharactersMap.get(matchedCharId)!;
        if ((char.appearance?.length || 0) > (existing.appearance?.length || 0)) {
          existing.appearance = char.appearance!;
        }
        if ((char.clothing?.length || 0) > (existing.clothing?.length || 0)) {
          existing.clothing = char.clothing!;
        }
        if (existing.age === 'unknown' && char.age && char.age !== 'unknown') {
          existing.age = char.age;
        }
        if (existing.gender === 'unknown' && char.gender && char.gender !== 'unknown') {
          existing.gender = char.gender;
        }
        if (char.relationships) {
          const set = new Set([...existing.relationships, ...char.relationships]);
          existing.relationships = Array.from(set);
        }
        // If newer name has more title/detail, update name
        if (char.name.length > existing.name.length) {
          existing.name = char.name;
        }
      }

      charIdRemap.set(char.id, safeId);
      charIdRemap.set(char.name, safeId);
      charIdRemap.set(char.name.toLowerCase(), safeId);
    }
  }

  // Fallback if no characters extracted
  if (mergedCharactersMap.size === 0) {
    mergedCharactersMap.set('char_protagonist', {
      id: 'char_protagonist',
      name: 'Protagonist',
      age: 'Adult',
      gender: 'unknown',
      appearance: 'Main character in the story',
      clothing: 'Appropriate period attire',
      relationships: [],
    });
  }

  // Merge Locations
  const mergedLocationsMap = new Map<string, LockedLocation>();
  const locIdRemap = new Map<string, string>();

  for (const ext of sectionExtractions) {
    if (!ext.locations) continue;
    for (const loc of ext.locations) {
      if (!loc || !loc.name) continue;

      let matchedLocId: string | null = null;
      for (const [existingId, existingLoc] of mergedLocationsMap.entries()) {
        if (areNamesFuzzyMatch(loc.name, existingLoc.name)) {
          matchedLocId = existingId;
          break;
        }
      }

      const rawId = loc.id || `loc_${normalizeKey(loc.name)}`;
      const safeId = matchedLocId || rawId;

      if (!matchedLocId) {
        mergedLocationsMap.set(safeId, {
          id: safeId,
          name: loc.name,
          description: loc.description || 'Story environment',
        });
      } else {
        const existing = mergedLocationsMap.get(matchedLocId)!;
        if ((loc.description?.length || 0) > (existing.description?.length || 0)) {
          existing.description = loc.description;
        }
      }

      locIdRemap.set(loc.id, safeId);
      locIdRemap.set(loc.name, safeId);
    }
  }

  if (mergedLocationsMap.size === 0) {
    mergedLocationsMap.set('loc_main', {
      id: 'loc_main',
      name: 'Main Setting',
      description: 'Primary environment of the story',
    });
  }

  // Merge Events globally and re-index 1..N
  const rawEvents: Array<{
    description: string;
    characters_involved: string[];
    location_id: string;
    time_of_day: string;
    emotion: string;
    original_id?: string;
  }> = [];

  const rawDialogueLines: Array<{
    original_event_id: string;
    speaker: string;
    text: string;
  }> = [];

  for (const ext of sectionExtractions) {
    if (ext.events) {
      for (const evt of ext.events) {
        if (!evt || !evt.description) continue;
        const normalizedChars = (evt.characters_involved || []).map(
          (c) => charIdRemap.get(c) || charIdRemap.get(c.toLowerCase()) || c
        );
        const normalizedLoc = locIdRemap.get(evt.location_id) || Array.from(mergedLocationsMap.keys())[0] || 'loc_main';

        rawEvents.push({
          description: evt.description,
          characters_involved: normalizedChars,
          location_id: normalizedLoc,
          time_of_day: evt.time_of_day || 'day',
          emotion: evt.emotion || 'dramatic',
          original_id: evt.id,
        });
      }
    }

    if (ext.dialogue_lines) {
      for (const d of ext.dialogue_lines) {
        if (d && d.text) {
          rawDialogueLines.push({
            original_event_id: d.event_id,
            speaker: charIdRemap.get(d.speaker) || d.speaker,
            text: d.text,
          });
        }
      }
    }
  }

  // If no events extracted, create a single overarching event
  if (rawEvents.length === 0) {
    rawEvents.push({
      description: project.raw_story.slice(0, 200),
      characters_involved: Array.from(mergedCharactersMap.keys()),
      location_id: Array.from(mergedLocationsMap.keys())[0],
      time_of_day: 'day',
      emotion: 'dramatic',
      original_id: 'sec_1_evt_1',
    });
  }

  // Global Re-indexing of events
  const globalEvents: LockedEvent[] = [];
  const eventIdMap = new Map<string, string>(); // original_id -> event_01

  rawEvents.forEach((evt, idx) => {
    const globalId = `event_${String(idx + 1).padStart(2, '0')}`;
    if (evt.original_id) {
      eventIdMap.set(evt.original_id, globalId);
    }
    globalEvents.push({
      id: globalId,
      order_index: idx + 1,
      description: evt.description,
      characters_involved: evt.characters_involved,
      location_id: evt.location_id,
      time_of_day: evt.time_of_day,
      emotion: evt.emotion,
    });
  });

  // Re-map Dialogue Lines to global event IDs
  const globalDialogueLines: LockedDialogueLine[] = [];
  for (const d of rawDialogueLines) {
    const mappedEventId = eventIdMap.get(d.original_event_id) || globalEvents[0].id;
    globalDialogueLines.push({
      event_id: mappedEventId,
      speaker: d.speaker,
      text: d.text,
    });
  }

  // Merge atomic facts
  const factsSet = new Set<string>();
  for (const ext of sectionExtractions) {
    if (ext.facts) {
      for (const f of ext.facts) {
        if (f && f.trim().length > 3) {
          factsSet.add(f.trim());
        }
      }
    }
  }

  const detectedLang = project.status.detected_language || 'en';
  const charactersArray = Array.from(mergedCharactersMap.values());
  const locationsArray = Array.from(mergedLocationsMap.values());
  const factsArray = Array.from(factsSet);

  // Compute Checksum & Lock
  const checksum = computeSourceOfTruthChecksum({
    detected_language: detectedLang,
    characters: charactersArray,
    locations: locationsArray,
    events: globalEvents,
    dialogue_lines: globalDialogueLines,
    facts: factsArray,
  });

  const sourceOfTruth: SourceOfTruth = {
    checksum,
    detected_language: detectedLang,
    characters: charactersArray,
    locations: locationsArray,
    events: globalEvents,
    dialogue_lines: globalDialogueLines,
    facts: factsArray,
    locked_at: new Date().toISOString(),
  };

  project.source_of_truth = sourceOfTruth;

  // Check for critical ambiguities (only if no clarification was already recorded)
  const hasExistingClarification = project.clarifications && project.clarifications.length > 0;
  const allAmbiguities: string[] = [];
  for (const ext of sectionExtractions) {
    if (ext.ambiguities) {
      for (const a of ext.ambiguities) {
        if (a && a.trim().length > 10) {
          allAmbiguities.push(a.trim());
        }
      }
    }
  }

  if (allAmbiguities.length > 0 && onClarificationNeeded && !hasExistingClarification) {
    const clarItem: ClarificationItem = {
      id: `clar_${Date.now()}`,
      stage: 0,
      question: `Ground Truth clarification needed: ${allAmbiguities[0]}`,
      context: `The story has ambiguity regarding key details: ${allAmbiguities.join('; ')}`,
      options: ['Proceed with default interpretation', 'Custom clarify in text'],
      created_at: new Date().toISOString(),
    };
    project.clarifications.push(clarItem);
    await onClarificationNeeded(clarItem);
  }

  project.stage_outputs['stage_00'] = {
    checksum,
    total_characters: charactersArray.length,
    total_locations: locationsArray.length,
    total_events: globalEvents.length,
    total_dialogues: globalDialogueLines.length,
    total_facts: factsArray.length,
  };

  return project;
}
