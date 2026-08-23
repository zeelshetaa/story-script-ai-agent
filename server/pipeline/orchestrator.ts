import { Response } from 'express';
import { projectStore } from '../storage/projectStore.ts';
import { PipelineSSEEvent, Project, ProjectStatusType } from '../types.ts';
import { runStage00GroundTruth } from './stage00GroundTruth.ts';
import { runStage01Split } from './stage01Split.ts';
import { runStage02Tone } from './stage02Tone.ts';
import { runStage03StoryBible } from './stage03StoryBible.ts';
import { runStage04Profiles } from './stage04Characters.ts';
import { runStage05Scenes } from './stage05Scenes.ts';
import { runStage06Timeline } from './stage06Timeline.ts';
import { runStage07Narration } from './stage07Narration.ts';
import { runStage08Prompts } from './stage08Prompts.ts';
import { runStage09Consistency } from './stage09Consistency.ts';
import { runStage10Translate } from './stage10Translate.ts';
import { runStage11Fidelity } from './stage11Fidelity.ts';

export const STAGES_CONFIG = [
  { stage: 1, id: 'stage_01', name: 'Section Splitting & Language Detection', requiresLLM: false },
  { stage: 0, id: 'stage_00', name: 'Ground Truth Extraction & SHA-256 Lock', requiresLLM: true },
  { stage: 2, id: 'stage_02', name: 'Section Tone & Rhythm Extraction', requiresLLM: true },
  { stage: 3, id: 'stage_03', name: 'Story Bible & World Building', requiresLLM: true },
  { stage: 4, id: 'stage_04', name: 'Character & Location Profiles (Checkpoint)', requiresLLM: true },
  { stage: 5, id: 'stage_05', name: 'Scene Breakdown & Event Coverage', requiresLLM: true },
  { stage: 6, id: 'stage_06', name: 'Timeline & Scene Duration Normalization', requiresLLM: false },
  { stage: 7, id: 'stage_07', name: 'Narration & Locked Dialogue Writing', requiresLLM: true },
  { stage: 8, id: 'stage_08', name: 'Cinematic Image & Video Prompts', requiresLLM: true },
  { stage: 9, id: 'stage_09', name: 'Deterministic Consistency Validation', requiresLLM: false },
  { stage: 10, id: 'stage_10', name: 'Semantic Script Translation', requiresLLM: true },
  { stage: 11, id: 'stage_11', name: 'Screenplay Fidelity & Judge Audit', requiresLLM: true },
];

export class PipelineOrchestrator {
  private static instance: PipelineOrchestrator;
  private sseClients = new Map<string, Set<Response>>();
  private runningTasks = new Map<string, { cancelled: boolean }>();

  private constructor() {}

  public static getInstance(): PipelineOrchestrator {
    if (!PipelineOrchestrator.instance) {
      PipelineOrchestrator.instance = new PipelineOrchestrator();
    }
    return PipelineOrchestrator.instance;
  }

  public registerSSEClient(projectId: string, res: Response) {
    if (!this.sseClients.has(projectId)) {
      this.sseClients.set(projectId, new Set());
    }
    this.sseClients.get(projectId)!.add(res);

    res.on('close', () => {
      const clients = this.sseClients.get(projectId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
          this.sseClients.delete(projectId);
        }
      }
    });

    // Send initial connected event
    this.sendSSE(projectId, {
      event: 'connected',
      data: { project_id: projectId, message: 'Connected to pipeline stream' },
    });
  }

  public sendSSE(projectId: string, event: PipelineSSEEvent) {
    const clients = this.sseClients.get(projectId);
    if (!clients || clients.size === 0) return;

    const payload = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const client of clients) {
      try {
        client.write(payload);
      } catch (err) {
        // client disconnected
      }
    }
  }

  public async cancelPipeline(projectId: string): Promise<boolean> {
    const task = this.runningTasks.get(projectId);
    if (task) {
      task.cancelled = true;
    }

    const project = await projectStore.getProject(projectId);
    if (project) {
      project.status.status = 'cancelled';
      project.status.stage_running = null;
      await projectStore.saveProject(project);

      this.sendSSE(projectId, {
        event: 'cancelled',
        data: { project_id: projectId, status: 'cancelled', message: 'Pipeline execution was cancelled by user' },
      });
      return true;
    }
    return false;
  }

  public async resumePipeline(projectId: string, updatedData?: { characters?: any[]; locations?: any[] }): Promise<void> {
    const project = await projectStore.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    if (
      project.status.status !== 'paused_checkpoint' &&
      project.status.status !== 'paused_clarification' &&
      project.status.status !== 'error'
    ) {
      throw new Error(`Project cannot be resumed from current status: ${project.status.status}`);
    }

    // Apply user updates if provided
    if (updatedData?.characters) {
      project.characters = updatedData.characters;
    }
    if (updatedData?.locations) {
      project.locations = updatedData.locations;
    }

    project.status.status = 'running';
    project.status.error_message = null;
    await projectStore.saveProject(project);

    this.sendSSE(projectId, {
      event: 'resumed',
      data: { project_id: projectId, status: 'running', message: 'Pipeline resumed by user' },
    });

    // Continue execution from next stage
    this.runPipeline(projectId, false);
  }

  public async submitClarification(projectId: string, clarificationId: string, answer: string): Promise<void> {
    const project = await projectStore.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const clar = project.clarifications.find((c) => c.id === clarificationId);
    if (clar) {
      clar.answer = answer;
      clar.answered_at = new Date().toISOString();
    }

    project.status.status = 'running';
    await projectStore.saveProject(project);

    this.sendSSE(projectId, {
      event: 'resumed',
      data: { project_id: projectId, status: 'running', message: `Clarification answered: "${answer}"` },
    });

    this.runPipeline(projectId, false);
  }

  public async startPipeline(projectId: string): Promise<void> {
    const project = await projectStore.getProject(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    project.status.status = 'running';
    project.status.error_message = null;
    await projectStore.saveProject(project);

    this.runPipeline(projectId, true);
  }

  private async runPipeline(projectId: string, isFreshStart: boolean): Promise<void> {
    const task = { cancelled: false };
    this.runningTasks.set(projectId, task);

    try {
      let project = await projectStore.getProject(projectId);
      if (!project) return;

      const stageIndexMap = new Map<number, number>();
      STAGES_CONFIG.forEach((cfg, idx) => stageIndexMap.set(cfg.stage, idx));

      // Determine starting index
      let startConfigIndex = 0;
      if (!isFreshStart && project.status.stage_completed >= 0) {
        const lastCompletedStage = project.status.stage_completed;
        const lastIdx = stageIndexMap.get(lastCompletedStage);
        if (lastIdx !== undefined) {
          startConfigIndex = lastIdx + 1;
        }
      }

      for (let i = startConfigIndex; i < STAGES_CONFIG.length; i++) {
        if (task.cancelled) {
          console.log(`[Orchestrator] Project ${projectId} pipeline aborted due to cancellation.`);
          return;
        }

        const stageConfig = STAGES_CONFIG[i];
        const stageNum = stageConfig.stage;
        const progressPercent = Math.round((i / STAGES_CONFIG.length) * 100);

        project.status.stage_running = stageNum;
        project.status.stage_name = stageConfig.name;
        project.status.progress_percent = progressPercent;
        await projectStore.saveProject(project);

        this.sendSSE(projectId, {
          event: 'stage_start',
          data: {
            project_id: projectId,
            stage: stageNum,
            stage_name: stageConfig.name,
            status: 'running',
            progress_percent: progressPercent,
            message: `Starting ${stageConfig.name}...`,
          },
        });

        // Run Stage Logic
        switch (stageNum) {
          case 1:
            project = await runStage01Split(project);
            break;
          case 0:
            project = await runStage00GroundTruth(project, async (clarification) => {
              // Pause for clarification if needed
              project.status.status = 'paused_clarification';
              project.status.stage_running = null;
              await projectStore.saveProject(project);

              this.sendSSE(projectId, {
                event: 'paused_clarification',
                data: {
                  project_id: projectId,
                  stage: 0,
                  status: 'paused_clarification',
                  clarification,
                  message: 'Pipeline paused: Clarification needed from user.',
                },
              });
            });

            if (project.status.status === 'paused_clarification') {
              return; // Halt until user answers
            }
            break;
          case 2:
            project = await runStage02Tone(project);
            break;
          case 3:
            project = await runStage03StoryBible(project);
            break;
          case 4:
            project = await runStage04Profiles(project);
            project.status.stage_completed = 4;
            project.status.status = 'paused_checkpoint';
            project.status.stage_running = null;
            project.status.progress_percent = Math.round((5 / STAGES_CONFIG.length) * 100);
            await projectStore.saveProject(project);

            this.sendSSE(projectId, {
              event: 'paused_checkpoint',
              data: {
                project_id: projectId,
                stage: 4,
                stage_name: stageConfig.name,
                status: 'paused_checkpoint',
                project: {
                  characters: project.characters,
                  locations: project.locations,
                  source_of_truth: project.source_of_truth,
                  story_bible: project.story_bible,
                },
                progress_percent: project.status.progress_percent,
                message: 'Human Checkpoint: Please review and verify characters and locations before continuing.',
              },
            });
            return; // Halt at Checkpoint!

          case 5:
            project = await runStage05Scenes(project);
            break;
          case 6:
            project = await runStage06Timeline(project);
            break;
          case 7:
            project = await runStage07Narration(project);
            break;
          case 8:
            project = await runStage08Prompts(project);
            break;
          case 9:
            project = await runStage09Consistency(project);
            break;
          case 10:
            project = await runStage10Translate(project);
            break;
          case 11:
            project = await runStage11Fidelity(project);
            break;
        }

        // Mark stage completed
        project.status.stage_completed = stageNum;
        project.status.stage_running = null;
        project.status.progress_percent = Math.round(((i + 1) / STAGES_CONFIG.length) * 100);
        await projectStore.saveProject(project);

        this.sendSSE(projectId, {
          event: 'stage_complete',
          data: {
            project_id: projectId,
            stage: stageNum,
            stage_name: stageConfig.name,
            status: 'running',
            progress_percent: project.status.progress_percent,
            project: {
              status: project.status,
              source_of_truth: project.source_of_truth,
              story_bible: project.story_bible,
              characters: project.characters,
              locations: project.locations,
              scenes: project.scenes,
              stage_outputs: project.stage_outputs,
            },
            message: `Completed ${stageConfig.name}.`,
          },
        });
      }

      // Mark Entire Pipeline Completed
      project.status.status = 'completed';
      project.status.stage_running = null;
      project.status.progress_percent = 100;
      await projectStore.saveProject(project);

      this.sendSSE(projectId, {
        event: 'completed',
        data: {
          project_id: projectId,
          status: 'completed',
          progress_percent: 100,
          project,
          message: 'All 12 pipeline stages completed successfully! Script and visual prompts are ready.',
        },
      });
    } catch (err: any) {
      console.error(`[Orchestrator] Error executing project ${projectId}:`, err);
      const project = await projectStore.getProject(projectId);
      if (project) {
        project.status.status = 'error';
        project.status.stage_running = null;
        project.status.error_message = err.message || String(err);
        await projectStore.saveProject(project);

        this.sendSSE(projectId, {
          event: 'error',
          data: {
            project_id: projectId,
            status: 'error',
            message: err.message || 'An error occurred during pipeline execution.',
          },
        });
      }
    } finally {
      this.runningTasks.delete(projectId);
    }
  }
}

export const pipelineOrchestrator = PipelineOrchestrator.getInstance();
