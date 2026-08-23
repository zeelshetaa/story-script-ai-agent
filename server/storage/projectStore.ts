import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.ts';
import { LLMCallLog, Project } from '../types.ts';
import { verifySourceOfTruthChecksum } from '../utils/checksum.ts';

const STORAGE_ROOT = config.storagePath;

async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    // ignore if already exists
  }
}

export class ProjectStore {
  private static instance: ProjectStore;

  private constructor() {}

  public static getInstance(): ProjectStore {
    if (!ProjectStore.instance) {
      ProjectStore.instance = new ProjectStore();
    }
    return ProjectStore.instance;
  }

  private getProjectDir(projectId: string): string {
    return path.join(STORAGE_ROOT, 'projects', projectId);
  }

  private getProjectFilePath(projectId: string): string {
    return path.join(this.getProjectDir(projectId), 'project.json');
  }

  private getLogsDir(projectId: string): string {
    return path.join(this.getProjectDir(projectId), 'logs');
  }

  public async saveProject(project: Project): Promise<void> {
    project.updated_at = new Date().toISOString();

    // Verify Source of Truth checksum if present
    if (project.source_of_truth) {
      const isValid = verifySourceOfTruthChecksum(project.source_of_truth.checksum, {
        detected_language: project.source_of_truth.detected_language,
        characters: project.source_of_truth.characters,
        locations: project.source_of_truth.locations,
        events: project.source_of_truth.events,
        dialogue_lines: project.source_of_truth.dialogue_lines,
        facts: project.source_of_truth.facts,
      });

      if (!isValid) {
        console.warn(`[ProjectStore] Warning: Checksum mismatch detected for project ${project.status.project_id}!`);
      }
    }

    const projectDir = this.getProjectDir(project.status.project_id);
    await ensureDir(projectDir);

    const filePath = this.getProjectFilePath(project.status.project_id);
    await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8');
  }

  public async getProject(projectId: string): Promise<Project | null> {
    try {
      const filePath = this.getProjectFilePath(projectId);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as Project;
    } catch (err) {
      return null;
    }
  }

  public async listProjects(): Promise<Project[]> {
    try {
      const projectsDir = path.join(STORAGE_ROOT, 'projects');
      await ensureDir(projectsDir);
      const entries = await fs.readdir(projectsDir, { withFileTypes: true });
      const projects: Project[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const project = await this.getProject(entry.name);
          if (project) {
            projects.push(project);
          }
        }
      }

      // Sort newest first
      return projects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (err) {
      return [];
    }
  }

  public async deleteProject(projectId: string): Promise<boolean> {
    try {
      const projectDir = this.getProjectDir(projectId);
      await fs.rm(projectDir, { recursive: true, force: true });
      return true;
    } catch (err) {
      return false;
    }
  }

  public async logLLMCall(projectId: string, log: LLMCallLog, rawPayload?: any): Promise<void> {
    try {
      const logsDir = this.getLogsDir(projectId);
      await ensureDir(logsDir);

      const fileName = `stage_${String(log.stage).padStart(2, '0')}_attempt_${log.attempt}_${Date.now()}.json`;
      const filePath = path.join(logsDir, fileName);

      const logData = {
        ...log,
        raw_payload: rawPayload,
      };

      await fs.writeFile(filePath, JSON.stringify(logData, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ProjectStore] Failed to write LLM log file:', err);
    }
  }
}

export const projectStore = ProjectStore.getInstance();
