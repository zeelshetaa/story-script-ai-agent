import { Clapperboard, Film, ShieldCheck, Sparkles } from 'lucide-react';
import React from 'react';

interface HeaderProps {
  serverStatus: {
    hasGeminiKey: boolean;
    hasGroqKey: boolean;
    provider: string;
  } | null;
  onReset: () => void;
  activeProjectTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ serverStatus, onReset, activeProjectTitle }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onReset}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Clapperboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-slate-100 text-lg tracking-tight">StoryScript AI</h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Ground Truth Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">Multi-Lingual Video Script & Prompts Pipeline</p>
          </div>
        </div>

        {activeProjectTitle && (
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 max-w-md truncate">
            <Film className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="font-medium truncate">{activeProjectTitle}</span>
          </div>
        )}

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-medium">Locked Truth: SHA-256</span>
          </div>

          <div className="flex items-center space-x-1.5 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">LLM:</span>
            <span className="text-slate-200 font-semibold uppercase">
              {serverStatus?.hasGroqKey ? 'Groq (Llama 3.3)' : 'Gemini 3.7'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
