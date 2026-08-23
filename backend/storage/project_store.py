import json
import os
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from backend.config import settings
from backend.models.schemas import Project, LLMCallLog
from backend.utils.checksum import verify_source_of_truth_checksum

class ProjectStore:
    _instance: Optional["ProjectStore"] = None

    def __init__(self):
        self.storage_root = Path(settings.STORAGE_PATH)
        self.projects_dir = self.storage_root / "projects"
        self.projects_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def get_instance(cls) -> "ProjectStore":
        if cls._instance is None:
            cls._instance = ProjectStore()
        return cls._instance

    def _get_project_dir(self, project_id: str) -> Path:
        return self.projects_dir / project_id

    def _get_project_file(self, project_id: str) -> Path:
        return self._get_project_dir(project_id) / "project.json"

    def _get_logs_dir(self, project_id: str) -> Path:
        return self._get_project_dir(project_id) / "logs"

    def save_project(self, project: Project) -> None:
        project.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Verify Source of Truth checksum if present
        if project.source_of_truth:
            sot = project.source_of_truth
            is_valid = verify_source_of_truth_checksum(
                sot.checksum,
                {
                    "detected_language": sot.detected_language,
                    "characters": sot.characters,
                    "locations": sot.locations,
                    "events": sot.events,
                    "dialogue_lines": sot.dialogue_lines,
                    "facts": sot.facts,
                }
            )
            if not is_valid:
                print(f"[ProjectStore] Warning: Checksum mismatch detected for project {project.status.project_id}!")

        p_dir = self._get_project_dir(project.status.project_id)
        p_dir.mkdir(parents=True, exist_ok=True)
        
        p_file = self._get_project_file(project.status.project_id)
        temp_file = p_dir / f"project.json.tmp.{int(time.time() * 1000)}"
        
        # Atomic write
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(project.model_dump(), f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
            
        temp_file.replace(p_file)

    def get_project(self, project_id: str) -> Optional[Project]:
        p_file = self._get_project_file(project_id)
        if not p_file.exists():
            return None
        try:
            with open(p_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return Project(**data)
        except Exception as e:
            print(f"[ProjectStore] Error loading project {project_id}: {e}")
            return None

    def list_projects(self) -> List[Project]:
        projects: List[Project] = []
        if not self.projects_dir.exists():
            return []

        for entry in self.projects_dir.iterdir():
            if entry.is_dir():
                p = self.get_project(entry.name)
                if p:
                    projects.append(p)

        # Sort newest first
        projects.sort(key=lambda x: x.created_at, reverse=True)
        return projects

    def delete_project(self, project_id: str) -> bool:
        p_dir = self._get_project_dir(project_id)
        if p_dir.exists():
            try:
                shutil.rmtree(p_dir)
                return True
            except Exception as e:
                print(f"[ProjectStore] Error deleting project {project_id}: {e}")
                return False
        return False

    def log_llm_call(self, project_id: str, log: LLMCallLog, raw_payload: Optional[Any] = None) -> None:
        try:
            logs_dir = self._get_logs_dir(project_id)
            logs_dir.mkdir(parents=True, exist_ok=True)

            file_name = f"stage_{str(log.stage).zfill(2)}_attempt_{log.attempt}_{int(time.time() * 1000)}.json"
            file_path = logs_dir / file_name

            log_data = log.model_dump()
            log_data["raw_payload"] = raw_payload

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(log_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[ProjectStore] Failed to write LLM log file: {e}")

project_store = ProjectStore.get_instance()
