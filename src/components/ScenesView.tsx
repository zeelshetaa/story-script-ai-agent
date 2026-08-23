import {
  Check,
  Clapperboard,
  Clock,
  Copy,
  Download,
  Eye,
  ImageIcon,
  Sparkles,
  Users,
  Video,
  Volume2,
} from 'lucide-react';
import React, { useState } from 'react';
import { Project, Scene } from '../types.ts';

interface ScenesViewProps {
  project: Project;
}

export const ScenesView: React.FC<ScenesViewProps> = ({ project }) => {
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const handleExportCSV = () => {
    window.location.href = `/api/projects/${project.status.project_id}/export/prompts`;
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">
            <Clapperboard className="w-3.5 h-3.5" />
            <span>AI Production Shot List</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Scene Breakdown & AI Prompts ({project.scenes.length} Scenes)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Photorealistic English image prompts & cinematic video camera directions derived deterministically from
            locked Ground Truth.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center space-x-1.5 border border-slate-700 transition-all"
        >
          <Download className="w-4 h-4 text-orange-400" />
          <span>EXPORT PROMPTS (.CSV)</span>
        </button>
      </div>

      {/* Grid of Scene Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {project.scenes.map((scene, idx) => {
          const imageKey = `img_${scene.id}`;
          const videoKey = `vid_${scene.id}`;

          return (
            <div
              key={scene.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4 transition-all"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 font-bold text-xs flex items-center justify-center font-mono">
                      #{idx + 1}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm leading-tight">{scene.scene_title}</h3>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">Event: {scene.event_id}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono font-bold flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{scene.duration_seconds}s</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-medium capitalize">
                      {scene.time_of_day}
                    </span>
                  </div>
                </div>

                {/* Character and Location Meta */}
                <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
                    Emotion: {scene.emotion}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                    Loc: {scene.location_id}
                  </span>
                  {scene.characters_present.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium flex items-center space-x-1"
                    >
                      <Users className="w-2.5 h-2.5 text-slate-400" />
                      <span>{c}</span>
                    </span>
                  ))}
                </div>

                {/* Action & Narration */}
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-300 leading-relaxed">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">ACTION BEAT:</span>
                    {scene.what_happens}
                  </div>

                  {scene.narration && (
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-200 leading-relaxed italic">
                      <span className="text-[10px] font-bold text-amber-400 uppercase not-italic block mb-0.5 flex items-center space-x-1">
                        <Volume2 className="w-3 h-3" />
                        <span>NARRATION (V.O.):</span>
                      </span>
                      "{scene.narration}"
                    </div>
                  )}

                  {scene.dialogue.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-bold text-orange-400 uppercase block mb-0.5">
                        SOURCE DIALOGUE:
                      </span>
                      {scene.dialogue.map((d, dIdx) => (
                        <div key={dIdx} className="text-[11px] text-slate-300 font-mono">
                          <strong className="text-slate-100">{d.speaker}:</strong> "{d.text}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* AI Prompts Section */}
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                {/* Image Prompt */}
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-purple-300 uppercase tracking-wide">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Midjourney / Flux Image Prompt</span>
                    </div>
                    <button
                      onClick={() => handleCopyText(scene.image_prompt, imageKey)}
                      className="px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-[10px] font-bold flex items-center space-x-1 transition-all"
                    >
                      {copiedPromptId === imageKey ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>COPY</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-mono select-all">
                    {scene.image_prompt}
                  </p>
                </div>

                {/* Video Prompt */}
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-cyan-300 uppercase tracking-wide">
                      <Video className="w-3.5 h-3.5" />
                      <span>Runway / Veo Video Motion Prompt</span>
                    </div>
                    <button
                      onClick={() => handleCopyText(scene.video_prompt, videoKey)}
                      className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-[10px] font-bold flex items-center space-x-1 transition-all"
                    >
                      {copiedPromptId === videoKey ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>COPY</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-mono select-all">
                    {scene.video_prompt}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
