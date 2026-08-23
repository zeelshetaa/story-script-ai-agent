import {
  AlertCircle,
  Award,
  BookOpen,
  Clapperboard,
  Database,
  Download,
  Film,
  FolderOpen,
  History,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityLogs } from './components/ActivityLogs.tsx';
import { CheckpointModal } from './components/CheckpointModal.tsx';
import { ClarificationModal } from './components/ClarificationModal.tsx';
import { FidelityView } from './components/FidelityView.tsx';
import { Header } from './components/Header.tsx';
import { PipelineTracker } from './components/PipelineTracker.tsx';
import { ScenesView } from './components/ScenesView.tsx';
import { ScriptView } from './components/ScriptView.tsx';
import { SourceOfTruthView } from './components/SourceOfTruthView.tsx';
import { StoryInputForm } from './components/StoryInputForm.tsx';
import { ClarificationItem, LLMCallLog, PipelineSSEEvent, Project } from './types.ts';

interface SampleStory {
  id: string;
  title: string;
  language: string;
  languageName: string;
  story: string;
}

export default function App() {
  const [serverStatus, setServerStatus] = useState<{
    hasGeminiKey: boolean;
    hasGroqKey: boolean;
    provider: string;
  } | null>(null);

  const [samples, setSamples] = useState<SampleStory[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'script' | 'scenes' | 'truth' | 'fidelity'>('script');

  const [isLoading, setIsLoading] = useState(false);
  const [showProjectsDrawer, setShowProjectsDrawer] = useState(false);

  // Checkpoint & Clarification Modal States
  const [checkpointData, setCheckpointData] = useState<{
    characters: any[];
    locations: any[];
  } | null>(null);

  const [activeClarification, setActiveClarification] = useState<ClarificationItem | null>(null);
  const [recentLogs, setRecentLogs] = useState<LLMCallLog[]>([]);

  const sseRef = useRef<EventSource | null>(null);

  // Initial Load: Health, Samples, and Projects
  useEffect(() => {
    fetchHealth();
    fetchSamples();
    fetchProjects();

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setServerStatus(data);
    } catch (err) {
      console.warn('Failed to fetch server health:', err);
    }
  };

  const fetchSamples = async () => {
    try {
      const res = await fetch('/api/samples');
      const data = await res.json();
      if (data.samples) {
        setSamples(data.samples);
      }
    } catch (err) {
      console.warn('Failed to load sample stories:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) {
        setProjectsList(data.projects);
      }
    } catch (err) {
      console.warn('Failed to fetch projects list:', err);
    }
  };

  // Subscribe to SSE for the active project
  const connectSSE = (projectId: string) => {
    if (sseRef.current) {
      sseRef.current.close();
    }

    const sse = new EventSource(`/api/projects/${projectId}/events`);
    sseRef.current = sse;

    const handleEvent = (e: MessageEvent, eventType: string) => {
      try {
        if (!e.data || e.data === 'undefined' || e.data === 'null') {
          return;
        }
        const payload: PipelineSSEEvent['data'] = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!payload) return;

        // Update active project state
        setActiveProject((prev) => {
          if (!prev || prev.status.project_id !== projectId) return prev;

          const updated = { ...prev };
          if (payload.status) {
            updated.status.status = payload.status;
          }
          if (payload.stage !== undefined) {
            updated.status.stage_running = payload.stage;
          }
          if (payload.stage_name) {
            updated.status.stage_name = payload.stage_name;
          }
          if (payload.progress_percent !== undefined) {
            updated.status.progress_percent = payload.progress_percent;
          }
          if (payload.project) {
            Object.assign(updated, payload.project);
          }
          return updated;
        });

        if (eventType === 'paused_checkpoint') {
          if (payload.project?.characters && payload.project?.locations) {
            setCheckpointData({
              characters: payload.project.characters,
              locations: payload.project.locations,
            });
          }
          reloadActiveProject(projectId);
        } else if (eventType === 'paused_clarification') {
          if (payload.clarification) {
            setActiveClarification(payload.clarification);
          }
        } else if (eventType === 'completed' || eventType === 'error' || eventType === 'cancelled') {
          reloadActiveProject(projectId);
          fetchProjects();
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    sse.addEventListener('stage_start', (e) => handleEvent(e as MessageEvent, 'stage_start'));
    sse.addEventListener('stage_complete', (e) => handleEvent(e as MessageEvent, 'stage_complete'));
    sse.addEventListener('paused_checkpoint', (e) => handleEvent(e as MessageEvent, 'paused_checkpoint'));
    sse.addEventListener('paused_clarification', (e) => handleEvent(e as MessageEvent, 'paused_clarification'));
    sse.addEventListener('resumed', (e) => {
      setCheckpointData(null);
      setActiveClarification(null);
      handleEvent(e as MessageEvent, 'resumed');
    });
    sse.addEventListener('completed', (e) => handleEvent(e as MessageEvent, 'completed'));
    sse.addEventListener('error', (e) => handleEvent(e as MessageEvent, 'error'));
    sse.addEventListener('cancelled', (e) => handleEvent(e as MessageEvent, 'cancelled'));

    sse.onerror = () => {
      // Reconnection handled automatically by EventSource
    };
  };

  const reloadActiveProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const full = await res.json();
        setActiveProject(full);
        if (full.logs) {
          setRecentLogs(full.logs);
        }
        if (full.status.status === 'paused_checkpoint') {
          setCheckpointData({
            characters: full.characters,
            locations: full.locations,
          });
        }
        if (full.status.status === 'paused_clarification') {
          const pendingClar = full.clarifications?.find((c: any) => !c.answer);
          if (pendingClar) {
            setActiveClarification(pendingClar);
          }
        }
      }
    } catch (err) {
      console.error('Failed to reload project:', err);
    }
  };

  const handleCreateAndStartProject = async (data: {
    rawStory: string;
    targetLanguage: string;
    durationSeconds: number;
  }) => {
    setIsLoading(true);
    try {
      // 1. Create project
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_story: data.rawStory,
          target_language: data.targetLanguage,
          requested_duration_seconds: data.durationSeconds,
        }),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json();
        throw new Error(errJson.error || 'Failed to create project');
      }

      const newProject = await createRes.json();
      setActiveProject(newProject);
      fetchProjects();

      // 2. Connect SSE
      connectSSE(newProject.status.project_id);

      // 3. Start execution
      await fetch(`/api/projects/${newProject.status.project_id}/start`, {
        method: 'POST',
      });
    } catch (err: any) {
      alert(`Error starting pipeline: ${err.message || String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProject = async (projectId: string) => {
    setIsLoading(true);
    setShowProjectsDrawer(false);
    try {
      await reloadActiveProject(projectId);
      connectSSE(projectId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelPipeline = async () => {
    if (!activeProject) return;
    try {
      await fetch(`/api/projects/${activeProject.status.project_id}/cancel`, { method: 'POST' });
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  const handleRetryPipeline = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      connectSSE(activeProject.status.project_id);
      const res = await fetch(`/api/projects/${activeProject.status.project_id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        // Fallback to start if resume is not applicable
        await fetch(`/api/projects/${activeProject.status.project_id}/start`, { method: 'POST' });
      }
      await reloadActiveProject(activeProject.status.project_id);
    } catch (err: any) {
      console.error('Retry failed:', err);
      alert(`Retry failed: ${err.message || String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeCheckpoint = async (updated: { characters: any[]; locations: any[] }) => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${activeProject.status.project_id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setCheckpointData(null);
      }
    } catch (err) {
      console.error('Resume failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitClarification = async (clarificationId: string, answer: string) => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${activeProject.status.project_id}/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clarification_id: clarificationId, answer }),
      });
      if (res.ok) {
        setActiveClarification(null);
      }
    } catch (err) {
      console.error('Clarification failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToNew = () => {
    if (sseRef.current) {
      sseRef.current.close();
    }
    setActiveProject(null);
    setCheckpointData(null);
    setActiveClarification(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Header */}
      <Header
        serverStatus={serverStatus}
        onReset={handleResetToNew}
        activeProjectTitle={activeProject?.story_bible?.title}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {/* Navigation Bar / History Switcher */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            {activeProject && (
              <button
                onClick={handleResetToNew}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-orange-400" />
                <span>New Story</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowProjectsDrawer(!showProjectsDrawer)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-all"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>Project History ({projectsList.length})</span>
            </button>
          </div>
        </div>

        {/* Project History Drawer / Dropdown */}
        {showProjectsDrawer && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">Saved Screenplay Projects</span>
              <span className="text-xs text-slate-500">{projectsList.length} total</span>
            </div>

            {projectsList.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No previous projects found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {projectsList.map((p) => (
                  <button
                    key={p.project_id}
                    onClick={() => handleSelectProject(p.project_id)}
                    className={`p-3 text-left rounded-xl border text-xs transition-all ${
                      activeProject?.status.project_id === p.project_id
                        ? 'bg-orange-500/10 border-orange-500/50 text-orange-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-slate-100 truncate mb-1">{p.title}</div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="capitalize">{p.status}</span>
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* View Mode: If No Active Project -> Show Input Form */}
        {!activeProject ? (
          <StoryInputForm samples={samples} onSubmit={handleCreateAndStartProject} isLoading={isLoading} />
        ) : (
          <div className="space-y-6">
            {/* Real-time Pipeline Tracker (12 Stages) */}
            <PipelineTracker
              status={activeProject.status}
              onCancel={handleCancelPipeline}
              onRetry={handleRetryPipeline}
              onResume={() =>
                setCheckpointData({
                  characters: activeProject.characters,
                  locations: activeProject.locations,
                })
              }
            />

            {/* Error Notification Banner if any */}
            {activeProject.status.error_message && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between space-x-3">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <strong className="font-bold block mb-0.5">Pipeline Execution Notice:</strong>
                    {activeProject.status.error_message}
                  </div>
                </div>
                <button
                  onClick={handleRetryPipeline}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs shrink-0 flex items-center space-x-1.5 transition-all shadow-md shadow-orange-500/20"
                >
                  <span>Retry from failed stage</span>
                </button>
              </div>
            )}

            {/* Main Tabs Navigation */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('script')}
                className={`px-4 py-2 rounded-xl flex items-center space-x-2 transition-all ${
                  activeTab === 'script'
                    ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Film className="w-4 h-4" />
                <span>Screenplay Script</span>
              </button>

              <button
                onClick={() => setActiveTab('scenes')}
                className={`px-4 py-2 rounded-xl flex items-center space-x-2 transition-all ${
                  activeTab === 'scenes'
                    ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Clapperboard className="w-4 h-4" />
                <span>Scenes & AI Prompts ({activeProject.scenes.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('truth')}
                className={`px-4 py-2 rounded-xl flex items-center space-x-2 transition-all ${
                  activeTab === 'truth'
                    ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Locked Ground Truth</span>
              </button>

              <button
                onClick={() => setActiveTab('fidelity')}
                className={`px-4 py-2 rounded-xl flex items-center space-x-2 transition-all ${
                  activeTab === 'fidelity'
                    ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Award className="w-4 h-4 text-purple-400" />
                <span>Fidelity Audit</span>
              </button>

              <div className="flex-1" />

              {/* Export Button */}
              <a
                href={`/api/projects/${activeProject.status.project_id}/export/json`}
                download
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center space-x-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export JSON</span>
              </a>
            </div>

            {/* Active Tab View */}
            {activeTab === 'script' && <ScriptView project={activeProject} />}
            {activeTab === 'scenes' && <ScenesView project={activeProject} />}
            {activeTab === 'truth' && <SourceOfTruthView sourceOfTruth={activeProject.source_of_truth} />}
            {activeTab === 'fidelity' && <FidelityView project={activeProject} />}

            {/* Terminal Activity Logs */}
            <ActivityLogs logs={activeProject.logs || recentLogs} />
          </div>
        )}
      </main>

      {/* Human Checkpoint Modal (Stage 04) */}
      {checkpointData && (
        <CheckpointModal
          characters={checkpointData.characters}
          locations={checkpointData.locations}
          onConfirm={handleResumeCheckpoint}
          isLoading={isLoading}
        />
      )}

      {/* Ambiguity Clarification Modal */}
      {activeClarification && (
        <ClarificationModal
          clarification={activeClarification}
          onSubmit={handleSubmitClarification}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
