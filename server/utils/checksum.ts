import crypto from 'crypto';
import { LockedCharacter, LockedDialogueLine, LockedEvent, LockedLocation } from '../types.ts';

export function computeSourceOfTruthChecksum(data: {
  detected_language: string;
  characters: LockedCharacter[];
  locations: LockedLocation[];
  events: LockedEvent[];
  dialogue_lines: LockedDialogueLine[];
  facts: string[];
}): string {
  // Sort keys canonically to ensure deterministic hash
  const canonicalData = {
    detected_language: data.detected_language,
    characters: [...data.characters].sort((a, b) => a.id.localeCompare(b.id)),
    locations: [...data.locations].sort((a, b) => a.id.localeCompare(b.id)),
    events: [...data.events].sort((a, b) => a.order_index - b.order_index),
    dialogue_lines: [...data.dialogue_lines].sort((a, b) => `${a.event_id}_${a.speaker}`.localeCompare(`${b.event_id}_${b.speaker}`)),
    facts: [...data.facts].sort(),
  };

  const jsonStr = JSON.stringify(canonicalData);
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

export function verifySourceOfTruthChecksum(
  checksum: string,
  data: {
    detected_language: string;
    characters: LockedCharacter[];
    locations: LockedLocation[];
    events: LockedEvent[];
    dialogue_lines: LockedDialogueLine[];
    facts: string[];
  }
): boolean {
  const recalculated = computeSourceOfTruthChecksum(data);
  return recalculated === checksum;
}
