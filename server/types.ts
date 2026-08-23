/**
 * Data Models and Types for Story to Video Script AI Engine
 * Strict matching of Ground Truth, Locked Entities, Scenes, and Pipeline States
 */

export interface LockedCharacter {
  id: string;
  name: string;
  age: string;
  gender: string;
  appearance: string;
  clothing: string;
  relationships: string[];
}

export interface LockedLocation {
  id: string;
  name: string;
  description: string;
}

export interface LockedEvent {
  id: string;
  order_index: number;
  description: string;
  characters_involved: string[];
  location_id: string;
  time_of_day: string;
  emotion: string;
}

export interface LockedDialogueLine {
  event_id: string;
  speaker: string; // character id or name
  text: string;
}

export interface SourceOfTruth {
  checksum: string;
  detected_language: string;
  characters: LockedCharacter[];
  locations: LockedLocation[];
  events: LockedEvent[];
  dialogue_lines: LockedDialogueLine[];
  facts: string[];
  locked_at: string;
}

export interface SectionTone {
  section_index: number;
  tone: string; // e.g. tense, dramatic, peaceful, mysterious
  pacing: string; // slow, medium, fast
  emotional_arc: string;
  key_themes: string[];
}

export interface StoryBible {
  title: string;
  summary: string;
  genre: string;
  theme: string;
  important_facts: string[];
  cultural_context: string[];
  language: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  gender: string;
  age: string;
  appearance: string; // LOCKED from SoT
  clothing: string;   // LOCKED from SoT
  role: string;
  personality: string;
  traits: string[];
  voice_style: string;
  relationships: string[];
}

export interface LocationProfile {
  id: string;
  name: string;
  description: string; // LOCKED from SoT
  mood: string;
  time_of_day_default: string;
  visual_style: string;
}

export interface SceneDialogue {
  speaker: string;
  text: string;
  emotion?: string;
}

export interface Scene {
  id: string;
  event_id: string;
  scene_title: string;
  story_section_index: number;
  characters_present: string[];
  location_id: string;
  time_of_day: string;
  what_happens: string;
  emotion: string;
  duration_seconds: number;
  narration: string;
  dialogue: SceneDialogue[];
  image_prompt: string;
  video_prompt: string;
  consistency_issues: string[];
  transition: string;
}

export type ProjectStatusType =
  | 'pending'
  | 'running'
  | 'paused_clarification'
  | 'paused_checkpoint'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface ProjectStatus {
  project_id: string;
  status: ProjectStatusType;
  stage_completed: number; // -1 = none, 0..11
  stage_running: number | null;
  stage_name?: string;
  requested_duration_seconds: number;
  target_language: string;
  detected_language?: string;
  error_message: string | null;
  progress_percent: number;
}

export interface ClarificationItem {
  id: string;
  stage: number;
  question: string;
  context: string;
  options?: string[];
  answer?: string;
  created_at: string;
  answered_at?: string;
}

export interface FidelityIssue {
  scene_id?: string;
  event_id?: string;
  issue_type: 'hallucination' | 'wrong_relationship' | 'altered_event' | 'missing_character' | 'unsupported_fact';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface LLMCallLog {
  timestamp: string;
  stage: number;
  stage_name: string;
  attempt: number;
  provider: 'groq' | 'gemini';
  model: string;
  status: 'success' | 'failed';
  error?: string;
  duration_ms?: number;
}

export interface Project {
  status: ProjectStatus;
  raw_story: string;
  sections: string[];
  section_tones?: SectionTone[];
  source_of_truth: SourceOfTruth | null;
  story_bible: StoryBible | null;
  characters: CharacterProfile[];
  locations: LocationProfile[];
  scenes: Scene[];
  clarifications: ClarificationItem[];
  fidelity_issues: FidelityIssue[];
  stage_outputs: Record<string, any>;
  logs: LLMCallLog[];
  created_at: string;
  updated_at: string;
}

export interface PipelineSSEEvent {
  event:
    | 'connected'
    | 'stage_start'
    | 'stage_progress'
    | 'stage_complete'
    | 'paused_checkpoint'
    | 'paused_clarification'
    | 'resumed'
    | 'completed'
    | 'error'
    | 'cancelled'
    | 'log';
  data: {
    project_id: string;
    stage?: number;
    stage_name?: string;
    status?: ProjectStatusType;
    message?: string;
    project?: Partial<Project>;
    clarification?: ClarificationItem;
    timestamp?: string;
    progress_percent?: number;
    log?: LLMCallLog;
  };
}
