import { Check, Clock, Copy, Download, FileText, Film, Volume2 } from 'lucide-react';
import React, { useState } from 'react';
import { Project } from '../types.ts';

interface ScriptViewProps {
  project: Project;
}

export const ScriptView: React.FC<ScriptViewProps> = ({ project }) => {
  const [copied, setCopied] = useState(false);
  const bible = project.story_bible;

  const handleCopyScript = () => {
    const scriptUrl = `/api/projects/${project.status.project_id}/export/script`;
    fetch(scriptUrl)
      .then((res) => res.text())
      .then((text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  const handleDownload = () => {
    window.location.href = `/api/projects/${project.status.project_id}/export/script`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Script Metadata */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">
            <Film className="w-3.5 h-3.5" />
            <span>Master Production Screenplay</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{bible?.title || 'Cinematic Video Script'}</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
            <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">{bible?.genre}</span>
            <span>•</span>
            <span className="flex items-center space-x-1 text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {project.status.requested_duration_seconds}s Total ({project.scenes.length} Scenes)
              </span>
            </span>
            <span>•</span>
            <span className="text-emerald-400 font-mono text-[11px]">
              SHA-256: {project.source_of_truth?.checksum.slice(0, 10)}...
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyScript}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center space-x-1.5 border border-slate-700 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'COPIED!' : 'COPY SCREENPLAY'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-orange-500/20"
          >
            <Download className="w-4 h-4" />
            <span>DOWNLOAD .TXT</span>
          </button>
        </div>
      </div>

      {/* Story Bible Summary */}
      {bible?.summary && (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs leading-relaxed text-slate-300">
          <strong className="text-orange-400 font-bold uppercase tracking-wide block mb-1">
            LOGLINE & SYNOPSIS:
          </strong>
          {bible.summary}
        </div>
      )}

      {/* Screenplay Script Flow */}
      <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-6 lg:p-10 font-mono text-xs shadow-2xl space-y-10">
        {project.scenes.map((scene, idx) => (
          <div key={scene.id} className="space-y-4 pb-8 border-b border-slate-900 last:border-0 last:pb-0">
            {/* Scene Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-200">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-orange-500 text-slate-950 font-bold text-[10px]">
                  SCENE {idx + 1}
                </span>
                <span className="font-bold text-sm tracking-tight text-white uppercase">{scene.scene_title}</span>
              </div>

              <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-sans">
                <span className="uppercase text-amber-300 font-semibold">{scene.time_of_day}</span>
                <span>•</span>
                <span className="text-cyan-300 font-mono">{scene.duration_seconds}s</span>
                <span>•</span>
                <span className="text-purple-300">{scene.emotion}</span>
              </div>
            </div>

            {/* Action Paragraph */}
            <div className="pl-4 border-l-2 border-slate-800 text-slate-300 leading-relaxed font-sans text-xs">
              <span className="text-slate-500 font-mono text-[10px] uppercase block mb-1">ACTION / VISUAL BEAT:</span>
              {scene.what_happens}
            </div>

            {/* Voice-Over Narration */}
            {scene.narration && (
              <div className="pl-8 pr-4 py-3 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-1 font-sans">
                <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-[11px] uppercase tracking-wide">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>NARRATOR (V.O.) [~{Math.round(scene.duration_seconds * 2.2)} words]:</span>
                </div>
                <p className="text-slate-100 text-xs italic leading-relaxed pl-2 border-l-2 border-amber-500/40">
                  "{scene.narration}"
                </p>
              </div>
            )}

            {/* Dialogue Lines */}
            {scene.dialogue && scene.dialogue.length > 0 && (
              <div className="space-y-3 pt-1">
                {scene.dialogue.map((d, dIdx) => (
                  <div key={dIdx} className="max-w-lg mx-auto text-center space-y-0.5 font-mono">
                    <div className="font-bold text-orange-400 text-xs uppercase tracking-wider">
                      {d.speaker}
                      {d.emotion && <span className="text-[10px] text-slate-500 font-normal ml-1">({d.emotion})</span>}
                    </div>
                    <div className="text-slate-200 text-xs font-sans tracking-wide">"{d.text}"</div>
                  </div>
                ))}
              </div>
            )}

            {/* Scene Transition */}
            <div className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-2">
              {scene.transition}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
