from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

# -----------------------------------------------------------------------------
# Ground Truth & Locked Entity Models
# -----------------------------------------------------------------------------

class LockedCharacter(BaseModel):
    id: str
    name: str
    age: str = "unknown"
    gender: str = "unknown"
    appearance: str = "Standard appearance"
    clothing: str = "Standard clothing"
    relationships: List[str] = Field(default_factory=list)

class LockedLocation(BaseModel):
    id: str
    name: str
    description: str

class LockedEvent(BaseModel):
    id: str
    order_index: int
    description: str
    characters_involved: List[str] = Field(default_factory=list)
    location_id: str
    time_of_day: str = "day"
    emotion: str = "dramatic"

class LockedDialogueLine(BaseModel):
    event_id: str
    speaker: str
    text: str

class SourceOfTruth(BaseModel):
    checksum: str
    detected_language: str
    characters: List[LockedCharacter] = Field(default_factory=list)
    locations: List[LockedLocation] = Field(default_factory=list)
    events: List[LockedEvent] = Field(default_factory=list)
    dialogue_lines: List[LockedDialogueLine] = Field(default_factory=list)
    facts: List[str] = Field(default_factory=list)
    locked_at: str

# -----------------------------------------------------------------------------
# Story Bible & Profiles
# -----------------------------------------------------------------------------

class SectionTone(BaseModel):
    section_index: int
    tone: str
    pacing: str
    emotional_arc: str
    key_themes: List[str] = Field(default_factory=list)

class StoryBible(BaseModel):
    title: str
    summary: str
    genre: str
    theme: str
    important_facts: List[str] = Field(default_factory=list)
    cultural_context: List[str] = Field(default_factory=list)
    language: str

class CharacterProfile(BaseModel):
    id: str
    name: str
    gender: str
    age: str
    appearance: str
    clothing: str
    role: str = "Main Character"
    personality: str = "Determined and focused"
    traits: List[str] = Field(default_factory=list)
    voice_style: str = "Clear and natural delivery"
    relationships: List[str] = Field(default_factory=list)

class LocationProfile(BaseModel):
    id: str
    name: str
    description: str
    mood: str = "Atmospheric"
    time_of_day_default: str = "day"
    visual_style: str = "Cinematic"

# -----------------------------------------------------------------------------
# Scene Breakdown & Narration
# -----------------------------------------------------------------------------

class SceneDialogue(BaseModel):
    speaker: str
    text: str
    emotion: Optional[str] = "neutral"

class Scene(BaseModel):
    id: str
    event_id: str
    scene_title: str
    story_section_index: int = 1
    characters_present: List[str] = Field(default_factory=list)
    location_id: str
    time_of_day: str = "day"
    what_happens: str
    emotion: str = "dramatic"
    duration_seconds: int = 0
    narration: str = ""
    dialogue: List[SceneDialogue] = Field(default_factory=list)
    image_prompt: str = ""
    video_prompt: str = ""
    consistency_issues: List[str] = Field(default_factory=list)
    transition: str = "CUT TO:"

# -----------------------------------------------------------------------------
# Project State & Logging
# -----------------------------------------------------------------------------

ProjectStatusType = Literal[
    "pending",
    "running",
    "paused_clarification",
    "paused_checkpoint",
    "completed",
    "error",
    "cancelled",
]

class ProjectStatus(BaseModel):
    project_id: str
    status: ProjectStatusType = "pending"
    stage_completed: int = -1
    stage_running: Optional[int] = None
    stage_name: Optional[str] = None
    requested_duration_seconds: int = 600
    target_language: str = "en"
    detected_language: Optional[str] = None
    error_message: Optional[str] = None
    progress_percent: int = 0

class ClarificationItem(BaseModel):
    id: str
    stage: int
    question: str
    context: str
    options: Optional[List[str]] = Field(default_factory=list)
    answer: Optional[str] = None
    created_at: str
    answered_at: Optional[str] = None

class FidelityIssue(BaseModel):
    scene_id: Optional[str] = None
    event_id: Optional[str] = None
    issue_type: Literal[
        "hallucination",
        "wrong_relationship",
        "altered_event",
        "missing_character",
        "unsupported_fact",
    ] = "unsupported_fact"
    description: str
    severity: Literal["low", "medium", "high"] = "low"

class LLMCallLog(BaseModel):
    timestamp: str
    stage: int
    stage_name: str
    attempt: int
    provider: Literal["groq", "gemini"]
    model: str
    status: Literal["success", "failed"]
    error: Optional[str] = None
    duration_ms: Optional[int] = None

class Project(BaseModel):
    status: ProjectStatus
    raw_story: str
    sections: List[str] = Field(default_factory=list)
    section_tones: Optional[List[SectionTone]] = None
    source_of_truth: Optional[SourceOfTruth] = None
    story_bible: Optional[StoryBible] = None
    characters: List[CharacterProfile] = Field(default_factory=list)
    locations: List[LocationProfile] = Field(default_factory=list)
    scenes: List[Scene] = Field(default_factory=list)
    clarifications: List[ClarificationItem] = Field(default_factory=list)
    fidelity_issues: List[FidelityIssue] = Field(default_factory=list)
    stage_outputs: Dict[str, Any] = Field(default_factory=dict)
    logs: List[LLMCallLog] = Field(default_factory=list)
    created_at: str
    updated_at: str

# -----------------------------------------------------------------------------
# API Request / Response Models
# -----------------------------------------------------------------------------

class CreateProjectRequest(BaseModel):
    raw_story: str
    target_language: Optional[str] = "en"
    requested_duration_seconds: Optional[int] = 600

class ResumeProjectRequest(BaseModel):
    characters: Optional[List[Dict[str, Any]]] = None
    locations: Optional[List[Dict[str, Any]]] = None

class SubmitClarificationRequest(BaseModel):
    clarification_id: str
    answer: str
