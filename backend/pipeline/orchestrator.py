import asyncio
import json
from typing import Dict, Set, Optional, Any, List

from backend.models.schemas import (
    ClarificationItem,
    Project,
)
from backend.storage.project_store import project_store
from backend.pipeline.stage00_ground_truth import run_stage00_ground_truth
from backend.pipeline.stage01_split import run_stage01_split
from backend.pipeline.stage02_tone import run_stage02_tone
from backend.pipeline.stage03_story_bible import run_stage03_story_bible
from backend.pipeline.stage04_characters import run_stage04_profiles
from backend.pipeline.stage05_scenes import run_stage05_scenes
from backend.pipeline.stage06_timeline import run_stage06_timeline
from backend.pipeline.stage07_narration import run_stage07_narration
from backend.pipeline.stage08_prompts import run_stage08_prompts
from backend.pipeline.stage09_consistency import run_stage09_consistency
from backend.pipeline.stage10_translate import run_stage10_translate
from backend.pipeline.stage11_fidelity import run_stage11_fidelity

STAGES_CONFIG = [
    {"stage": 1, "id": "stage_01", "name": "Section Splitting & Language Detection", "requiresLLM": False},
    {"stage": 0, "id": "stage_00", "name": "Ground Truth Extraction & SHA-256 Lock", "requiresLLM": True},
    {"stage": 2, "id": "stage_02", "name": "Section Tone & Rhythm Extraction", "requiresLLM": True},
    {"stage": 3, "id": "stage_03", "name": "Story Bible & World Building", "requiresLLM": True},
    {"stage": 4, "id": "stage_04", "name": "Character & Location Profiles (Checkpoint)", "requiresLLM": True},
    {"stage": 5, "id": "stage_05", "name": "Scene Breakdown & Event Coverage", "requiresLLM": True},
    {"stage": 6, "id": "stage_06", "name": "Timeline & Scene Duration Normalization", "requiresLLM": False},
    {"stage": 7, "id": "stage_07", "name": "Narration & Locked Dialogue Writing", "requiresLLM": True},
    {"stage": 8, "id": "stage_08", "name": "Cinematic Image & Video Prompts", "requiresLLM": True},
    {"stage": 9, "id": "stage_09", "name": "Deterministic Consistency Validation", "requiresLLM": False},
    {"stage": 10, "id": "stage_10", "name": "Semantic Script Translation", "requiresLLM": True},
    {"stage": 11, "id": "stage_11", "name": "Screenplay Fidelity & Judge Audit", "requiresLLM": True},
]

class PipelineTaskState:
    def __init__(self):
        self.cancelled = False

class PipelineOrchestrator:
    _instance: Optional["PipelineOrchestrator"] = None

    def __init__(self):
        self.sse_subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self.running_tasks: Dict[str, PipelineTaskState] = {}

    @classmethod
    def get_instance(cls) -> "PipelineOrchestrator":
        if cls._instance is None:
            cls._instance = PipelineOrchestrator()
        return cls._instance

    def subscribe_sse(self, project_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        if project_id not in self.sse_subscribers:
            self.sse_subscribers[project_id] = set()
        self.sse_subscribers[project_id].add(queue)
        
        # Send initial connected message
        queue.put_nowait({
            "event": "connected",
            "data": {"project_id": project_id, "message": "Connected to Python pipeline stream"}
        })
        return queue

    def unsubscribe_sse(self, project_id: str, queue: asyncio.Queue):
        if project_id in self.sse_subscribers:
            self.sse_subscribers[project_id].discard(queue)
            if not self.sse_subscribers[project_id]:
                del self.sse_subscribers[project_id]

    def broadcast_sse(self, project_id: str, event: str, data: Any):
        subscribers = self.sse_subscribers.get(project_id, set())
        for q in list(subscribers):
            try:
                q.put_nowait({"event": event, "data": data})
            except Exception:
                pass

    def cancel_pipeline(self, project_id: str) -> bool:
        task = self.running_tasks.get(project_id)
        if task:
            task.cancelled = True

        project = project_store.get_project(project_id)
        if project:
            project.status.status = "cancelled"
            project.status.stage_running = None
            project_store.save_project(project)

            self.broadcast_sse(
                project_id,
                "cancelled",
                {"project_id": project_id, "status": "cancelled", "message": "Pipeline execution was cancelled by user"}
            )
            return True
        return False

    async def resume_pipeline(self, project_id: str, updated_data: Optional[Dict[str, Any]] = None):
        project = project_store.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        if project.status.status not in ["paused_checkpoint", "paused_clarification", "error"]:
            raise ValueError(f"Project cannot be resumed from current status: {project.status.status}")

        if updated_data:
            if "characters" in updated_data and updated_data["characters"] is not None:
                # Merge or replace character profiles
                from backend.models.schemas import CharacterProfile
                chars_list = []
                for c in updated_data["characters"]:
                    if isinstance(c, dict):
                        chars_list.append(CharacterProfile(**c))
                    elif isinstance(c, CharacterProfile):
                        chars_list.append(c)
                project.characters = chars_list

            if "locations" in updated_data and updated_data["locations"] is not None:
                from backend.models.schemas import LocationProfile
                locs_list = []
                for l in updated_data["locations"]:
                    if isinstance(l, dict):
                        locs_list.append(LocationProfile(**l))
                    elif isinstance(l, LocationProfile):
                        locs_list.append(l)
                project.locations = locs_list

        project.status.status = "running"
        project.status.error_message = None
        project_store.save_project(project)

        self.broadcast_sse(
            project_id,
            "resumed",
            {"project_id": project_id, "status": "running", "message": "Pipeline resumed by user"}
        )

        asyncio.create_task(self._run_pipeline_async(project_id, is_fresh_start=False))

    async def submit_clarification(self, project_id: str, clarification_id: str, answer: str):
        project = project_store.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        for clar in project.clarifications:
            if clar.id == clarification_id:
                clar.answer = answer
                clar.answered_at = f"{json.loads(json.dumps(project.created_at))}"

        project.status.status = "running"
        project_store.save_project(project)

        self.broadcast_sse(
            project_id,
            "resumed",
            {"project_id": project_id, "status": "running", "message": f'Clarification answered: "{answer}"'}
        )

        asyncio.create_task(self._run_pipeline_async(project_id, is_fresh_start=False))

    async def start_pipeline(self, project_id: str):
        project = project_store.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        project.status.status = "running"
        project.status.error_message = None
        project_store.save_project(project)

        asyncio.create_task(self._run_pipeline_async(project_id, is_fresh_start=True))

    async def _run_pipeline_async(self, project_id: str, is_fresh_start: bool):
        task = PipelineTaskState()
        self.running_tasks[project_id] = task

        try:
            project = project_store.get_project(project_id)
            if not project:
                return

            stage_idx_map = {cfg["stage"]: idx for idx, cfg in enumerate(STAGES_CONFIG)}

            start_config_idx = 0
            if not is_fresh_start and project.status.stage_completed >= 0:
                last_completed = project.status.stage_completed
                if last_completed in stage_idx_map:
                    start_config_idx = stage_idx_map[last_completed] + 1

            for i in range(start_config_idx, len(STAGES_CONFIG)):
                if task.cancelled:
                    print(f"[Orchestrator] Project {project_id} aborted due to cancellation.")
                    return

                stage_config = STAGES_CONFIG[i]
                stage_num = stage_config["stage"]
                stage_name = stage_config["name"]
                progress_percent = int(round((i / len(STAGES_CONFIG)) * 100))

                project.status.stage_running = stage_num
                project.status.stage_name = stage_name
                project.status.progress_percent = progress_percent
                project_store.save_project(project)

                self.broadcast_sse(
                    project_id,
                    "stage_start",
                    {
                        "project_id": project_id,
                        "stage": stage_num,
                        "stage_name": stage_name,
                        "status": "running",
                        "progress_percent": progress_percent,
                        "message": f"Starting {stage_name}...",
                    }
                )

                # Execute Stage in threadpool to prevent blocking async event loop
                if stage_num == 1:
                    project = await asyncio.to_thread(run_stage01_split, project)
                elif stage_num == 0:
                    clar_found = False

                    def handle_clar(clar_item: ClarificationItem):
                        nonlocal clar_found
                        clar_found = True
                        project.status.status = "paused_clarification"
                        project.status.stage_running = None
                        project_store.save_project(project)
                        self.broadcast_sse(
                            project_id,
                            "paused_clarification",
                            {
                                "project_id": project_id,
                                "stage": 0,
                                "status": "paused_clarification",
                                "clarification": clar_item.model_dump(),
                                "message": "Pipeline paused: Clarification needed from user.",
                            }
                        )

                    project = await asyncio.to_thread(run_stage00_ground_truth, project, handle_clar)
                    if clar_found or project.status.status == "paused_clarification":
                        return  # Halt until user clarifies
                elif stage_num == 2:
                    project = await asyncio.to_thread(run_stage02_tone, project)
                elif stage_num == 3:
                    project = await asyncio.to_thread(run_stage03_story_bible, project)
                elif stage_num == 4:
                    project = await asyncio.to_thread(run_stage04_profiles, project)
                    project.status.stage_completed = 4
                    project.status.status = "paused_checkpoint"
                    project.status.stage_running = None
                    project.status.progress_percent = int(round((5 / len(STAGES_CONFIG)) * 100))
                    project_store.save_project(project)

                    self.broadcast_sse(
                        project_id,
                        "paused_checkpoint",
                        {
                            "project_id": project_id,
                            "stage": 4,
                            "stage_name": stage_name,
                            "status": "paused_checkpoint",
                            "project": {
                                "characters": [c.model_dump() for c in project.characters],
                                "locations": [l.model_dump() for l in project.locations],
                                "source_of_truth": project.source_of_truth.model_dump() if project.source_of_truth else None,
                                "story_bible": project.story_bible.model_dump() if project.story_bible else None,
                            },
                            "progress_percent": project.status.progress_percent,
                            "message": "Human Checkpoint: Please review and verify characters and locations before continuing.",
                        }
                    )
                    return  # Halt at Human Checkpoint!

                elif stage_num == 5:
                    project = await asyncio.to_thread(run_stage05_scenes, project)
                elif stage_num == 6:
                    project = await asyncio.to_thread(run_stage06_timeline, project)
                elif stage_num == 7:
                    project = await asyncio.to_thread(run_stage07_narration, project)
                elif stage_num == 8:
                    project = await asyncio.to_thread(run_stage08_prompts, project)
                elif stage_num == 9:
                    project = await asyncio.to_thread(run_stage09_consistency, project)
                elif stage_num == 10:
                    project = await asyncio.to_thread(run_stage10_translate, project)
                elif stage_num == 11:
                    project = await asyncio.to_thread(run_stage11_fidelity, project)

                # Mark stage completed
                project.status.stage_completed = stage_num
                project.status.stage_running = None
                project.status.progress_percent = int(round(((i + 1) / len(STAGES_CONFIG)) * 100))
                project_store.save_project(project)

                self.broadcast_sse(
                    project_id,
                    "stage_complete",
                    {
                        "project_id": project_id,
                        "stage": stage_num,
                        "stage_name": stage_name,
                        "status": "running",
                        "progress_percent": project.status.progress_percent,
                        "project": project.model_dump(),
                        "message": f"Completed {stage_name}.",
                    }
                )

            # Mark Entire Pipeline Completed
            project.status.status = "completed"
            project.status.stage_running = None
            project.status.progress_percent = 100
            project_store.save_project(project)

            self.broadcast_sse(
                project_id,
                "completed",
                {
                    "project_id": project_id,
                    "status": "completed",
                    "progress_percent": 100,
                    "project": project.model_dump(),
                    "message": "All 12 pipeline stages completed successfully! Script and visual prompts are ready.",
                }
            )

        except Exception as err:
            print(f"[Orchestrator] Error executing project {project_id}: {err}")
            project = project_store.get_project(project_id)
            if project:
                project.status.status = "error"
                project.status.stage_running = None
                project.status.error_message = str(err)
                project_store.save_project(project)

                self.broadcast_sse(
                    project_id,
                    "error",
                    {
                        "project_id": project_id,
                        "status": "error",
                        "message": str(err),
                    }
                )
        finally:
            if project_id in self.running_tasks:
                del self.running_tasks[project_id]

pipeline_orchestrator = PipelineOrchestrator.get_instance()
