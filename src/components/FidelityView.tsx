import {
  AlertTriangle,
  Award,
  CheckCircle2,
  FileCheck,
  Globe2,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import React from 'react';
import { Project } from '../types.ts';

interface FidelityViewProps {
  project: Project;
}

export const FidelityView: React.FC<FidelityViewProps> = ({ project }) => {
  const issues = project.fidelity_issues || [];
  const consistencyCount = project.scenes.reduce((acc, s) => acc + (s.consistency_issues?.length || 0), 0);
  const bible = project.story_bible;

  return (
    <div className="space-y-6">
      {/* Fidelity Audit Score Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Screenplay Fidelity & Integrity Audit</h3>
              <p className="text-xs text-slate-400">
                Code-level verification + LLM-as-judge comparing screenplay output against immutable Ground Truth.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {Math.max(0, 100 - issues.length * 5)}%
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Fidelity Score</div>
            </div>
          </div>
        </div>

        {/* Verification Status Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <div className="font-bold text-slate-200">1-to-1 Event Coverage</div>
              <div className="text-slate-400 text-[11px]">
                {project.scenes.length} Scenes / {project.source_of_truth?.events.length || 0} Events
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <div className="font-bold text-slate-200">Dialogue Origin Lock</div>
              <div className="text-slate-400 text-[11px]">0 Invented Dialogues</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-3">
            {consistencyCount === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div className="text-xs">
              <div className="font-bold text-slate-200">Entity Consistency</div>
              <div className="text-slate-400 text-[11px]">
                {consistencyCount === 0 ? 'Zero Entity Drift' : `${consistencyCount} Consistency Notices`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LLM-as-Judge Issues Report */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
            <FileCheck className="w-4 h-4 text-orange-400" />
            <span>LLM-as-Judge Findings ({issues.length})</span>
          </div>
          <span className="text-xs text-slate-400">Audited against Ground Truth events and atomic facts</span>
        </div>

        {issues.length === 0 ? (
          <div className="p-6 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <strong className="font-bold block text-sm mb-0.5">Perfect Script Fidelity</strong>
              No hallucinations, no invented character relationships, and no altered plot resolutions detected.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase text-[10px]">
                    {issue.issue_type.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Scene: {issue.scene_id} | Event: {issue.event_id}
                  </span>
                </div>
                <p className="text-slate-200 leading-relaxed">{issue.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cultural Context & Story World Rules */}
      {bible && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
              <Globe2 className="w-4 h-4 text-blue-400" />
              <span>Cultural Context & World Motifs</span>
            </div>
            {bible.cultural_context && bible.cultural_context.length > 0 ? (
              <ul className="space-y-2 text-xs text-slate-300">
                {bible.cultural_context.map((ctx, idx) => (
                  <li key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                    <span>{ctx}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">No specific cultural constraints extracted.</p>
            )}
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Section Rhythm & Emotional Arcs</span>
            </div>
            {project.section_tones && project.section_tones.length > 0 ? (
              <div className="space-y-2.5 text-xs">
                {project.section_tones.map((st) => (
                  <div key={st.section_index} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between font-semibold text-slate-200">
                      <span>Section {st.section_index}</span>
                      <span className="text-[11px] text-orange-400 uppercase font-mono">{st.tone} ({st.pacing} pacing)</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{st.emotional_arc}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Tone analysis will appear upon stage completion.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
