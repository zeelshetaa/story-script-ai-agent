import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  Lock,
  PauseCircle,
  RotateCcw,
  Sparkles,
  StopCircle,
} from 'lucide-react';
import React from 'react';
import { ProjectStatus } from '../types.ts';

interface PipelineTrackerProps {
  status: ProjectStatus;
  onCancel: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  hasCheckpointPending?: boolean;
}

export const STAGES_UI_LIST = [
  { stage: 1, label: '01: Split & Detect', name: 'Section Splitting & Language Detection', llm: false },
  { stage: 0, label: '00: Ground Truth', name: 'Ground Truth Extraction & SHA-256 Lock', llm: true, critical: true },
  { stage: 2, label: '02: Tone & Arc', name: 'Section Tone & Rhythm Extraction', llm: true },
  { stage: 3, label: '03: Story Bible', name: 'Story Bible & World Building', llm: true },
  { stage: 4, label: '04: Profiles & Checkpoint', name: 'Character & Location Profiles (Checkpoint)', llm: true, checkpoint: true },
  { stage: 5, label: '05: Scene Breakdown', name: 'Scene Generation (1-to-1 Event Map)', llm: true },
  { stage: 6, label: '06: Timeline Math', name: 'Weighted Scene Duration Calculation', llm: false },
  { stage: 7, label: '07: Narration & Dialogue', name: 'Narration & Locked Dialogue Delivery', llm: true },
  { stage: 8, label: '08: AI Prompts', name: 'Image & Video Camera Motion Prompts', llm: true },
  { stage: 9, label: '09: Consistency', name: 'Deterministic Consistency Validation', llm: false },
  { stage: 10, label: '10: Translation', name: 'Semantic Cross-Lingual Translation', llm: true },
  { stage: 11, label: '11: Fidelity Judge', name: 'Screenplay Fidelity & LLM-as-Judge', llm: true },
];

export const PipelineTracker: React.FC<PipelineTrackerProps> = ({
  status,
  onCancel,
  onResume,
  onRetry,
  hasCheckpointPending,
}) => {
  const getStageState = (stageNum: number, index: number) => {
    // Determine if completed based on order in sequence
    const stageOrderIndexMap = new Map([
      [1, 0],
      [0, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
      [7, 7],
      [8, 8],
      [9, 9],
      [10, 10],
      [11, 11],
    ]);

    const lastCompletedOrder = status.stage_completed >= 0 ? stageOrderIndexMap.get(status.stage_completed) ?? -1 : -1;
    const thisOrder = stageOrderIndexMap.get(stageNum) ?? 0;

    if (status.status === 'completed') return 'completed';
    if (status.stage_running === stageNum) return 'running';
    if (thisOrder <= lastCompletedOrder) return 'completed';
    if (stageNum === 4 && status.status === 'paused_checkpoint') return 'paused';
    if (stageNum === 0 && status.status === 'paused_clarification') return 'clarification';
    if (status.status === 'error' && thisOrder === lastCompletedOrder + 1) return 'error';

    return 'pending';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 lg:p-6 shadow-xl mb-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <h3 className="font-bold text-white text-base">Pipeline Execution Stream</h3>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                status.status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : status.status === 'running'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse'
                  : status.status === 'paused_checkpoint'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : status.status === 'paused_clarification'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : status.status === 'error'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {status.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {status.stage_name ? `Active: ${status.stage_name}` : 'Multi-stage deterministic screenplay pipeline'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          {status.status === 'paused_checkpoint' && onResume && (
            <button
              onClick={onResume}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-amber-500/20"
            >
              <PauseCircle className="w-4 h-4" />
              <span>Review Checkpoint</span>
            </button>
          )}

          {status.status === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-orange-500/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Pipeline</span>
            </button>
          )}

          {status.status === 'running' && (
            <button
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center space-x-1.5 transition-all"
            >
              <StopCircle className="w-4 h-4 text-rose-400" />
              <span>Cancel Pipeline</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 mb-5">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-slate-300">Overall Stage Progress</span>
          <span className="font-mono text-orange-400 font-bold">{status.progress_percent}%</span>
        </div>
        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 transition-all duration-500 ease-out"
            style={{ width: `${status.progress_percent}%` }}
          />
        </div>
      </div>

      {/* 12-Stage Visual Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {STAGES_UI_LIST.map((stage, idx) => {
          const state = getStageState(stage.stage, idx);

          return (
            <div
              key={stage.stage}
              className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between ${
                state === 'completed'
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : state === 'running'
                  ? 'bg-orange-950/30 border-orange-500/60 text-orange-200 shadow-md shadow-orange-500/10 ring-1 ring-orange-500/40'
                  : state === 'paused'
                  ? 'bg-amber-950/30 border-amber-500/50 text-amber-200 animate-pulse'
                  : state === 'clarification'
                  ? 'bg-purple-950/30 border-purple-500/50 text-purple-200 animate-pulse'
                  : state === 'error'
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold font-mono uppercase tracking-tight">{stage.label}</span>
                {state === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {state === 'running' && <Loader2 className="w-4 h-4 text-orange-400 animate-spin shrink-0" />}
                {state === 'paused' && <PauseCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                {state === 'clarification' && <AlertCircle className="w-4 h-4 text-purple-400 shrink-0" />}
                {state === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                {state === 'pending' && <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
              </div>

              <div className="text-xs font-semibold text-slate-200 truncate mb-1">{stage.name}</div>

              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-1">
                {stage.llm ? (
                  <span className="flex items-center space-x-1 text-slate-400">
                    <Sparkles className="w-3 h-3 text-amber-400/80" />
                    <span>LLM</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-slate-400">
                    <Cpu className="w-3 h-3 text-cyan-400/80" />
                    <span>Deterministic</span>
                  </span>
                )}
                {stage.critical && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[9px] flex items-center space-x-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    <span>SHA-256</span>
                  </span>
                )}
                {stage.checkpoint && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold text-[9px]">
                    HUMAN REVIEW
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
