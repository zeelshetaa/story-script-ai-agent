import { callStructured } from '../llm/client.ts';
import { CharacterProfile, LocationProfile, Project } from '../types.ts';

interface CharacterLLMEnhancement {
  id: string;
  role: string;
  personality: string;
  traits: string[];
  voice_style: string;
  relationships: string[];
}

interface LocationLLMEnhancement {
  id: string;
  mood: string;
  time_of_day_default: string;
  visual_style: string;
}

export async function runStage04Profiles(project: Project): Promise<Project> {
  const sot = project.source_of_truth;
  if (!sot) throw new Error('Source of Truth missing before Stage 04');

  const characterProfiles: CharacterProfile[] = [];

  // Enhance each character with LLM while enforcing strict verbatim locking on physical traits
  for (const lockedChar of sot.characters) {
    const prompt = `You are a cinematic character designer. Enhance this character's psychological and performance profile without altering any physical appearance or attire.

LOCKED Character Base Data:
- ID: ${lockedChar.id}
- Name: ${lockedChar.name}
- Age: ${lockedChar.age}
- Gender: ${lockedChar.gender}
- Appearance: ${lockedChar.appearance}
- Clothing: ${lockedChar.clothing}
- Existing Relationships: ${lockedChar.relationships.join(', ')}

Return JSON with:
{
  "id": "${lockedChar.id}",
  "role": "e.g. Protagonist, Antagonist, Mentor, Sage, Catalyst, Loyal Companion, Narrator",
  "personality": "Psychological depth, core motivations, internal conflicts, temperament",
  "traits": ["trait 1", "trait 2", "trait 3", "trait 4"],
  "voice_style": "Vocal tone, cadence, rhythm, emotional resonance (e.g. deep baritone with quiet authority, rapid breathless whisper)",
  "relationships": ["List of dynamic relationships with specific context"]
}`;

    const enhanced = await callStructured<CharacterLLMEnhancement>({
      prompt,
      stage: 4,
      stageName: `Character Profile (${lockedChar.name})`,
      projectId: project.status.project_id,
      isLightTask: true,
    });

    // CRITICAL ENFORCEMENT: Locked fields are COPIED VERBATIM from Source of Truth
    // Diff vs generated and strictly restore locked fields
    const profile: CharacterProfile = {
      id: lockedChar.id,
      name: lockedChar.name,
      gender: lockedChar.gender, // Locked verbatim
      age: lockedChar.age,       // Locked verbatim
      appearance: lockedChar.appearance, // Locked verbatim
      clothing: lockedChar.clothing,     // Locked verbatim
      role: enhanced.role || 'Main Character',
      personality: enhanced.personality || 'Determined and courageous.',
      traits: Array.isArray(enhanced.traits) ? enhanced.traits : ['Focused', 'Resilient'],
      voice_style: enhanced.voice_style || 'Clear, natural delivery.',
      relationships: Array.isArray(enhanced.relationships) && enhanced.relationships.length > 0
        ? enhanced.relationships
        : lockedChar.relationships,
    };

    characterProfiles.push(profile);
  }

  const locationProfiles: LocationProfile[] = [];

  // Enhance locations
  for (const lockedLoc of sot.locations) {
    const prompt = `Enhance the visual cinematography profile for this story location.

LOCKED Location Base Data:
- ID: ${lockedLoc.id}
- Name: ${lockedLoc.name}
- Description: ${lockedLoc.description}

Return JSON with:
{
  "id": "${lockedLoc.id}",
  "mood": "Atmospheric mood (e.g. ancient mystical solitude, bustling marketplace energy, ominous gothic dread)",
  "time_of_day_default": "morning | afternoon | golden hour | sunset | night | blue hour",
  "visual_style": "Cinematography visual references, lighting setup, color palette, texture, lens choices"
}`;

    const enhancedLoc = await callStructured<LocationLLMEnhancement>({
      prompt,
      stage: 4,
      stageName: `Location Profile (${lockedLoc.name})`,
      projectId: project.status.project_id,
      isLightTask: true,
    });

    locationProfiles.push({
      id: lockedLoc.id,
      name: lockedLoc.name,
      description: lockedLoc.description, // Locked verbatim
      mood: enhancedLoc.mood || 'Atmospheric and rich in atmosphere.',
      time_of_day_default: enhancedLoc.time_of_day_default || 'day',
      visual_style: enhancedLoc.visual_style || 'Cinematic wide angles with natural lighting.',
    });
  }

  project.characters = characterProfiles;
  project.locations = locationProfiles;
  project.stage_outputs['stage_04'] = {
    characters_count: characterProfiles.length,
    locations_count: locationProfiles.length,
    checkpoint_pending: true,
  };

  return project;
}
