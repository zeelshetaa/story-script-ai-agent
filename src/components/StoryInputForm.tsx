import { BookOpen, Clock, Globe, Lock, Play, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

interface SampleStory {
  id: string;
  title: string;
  language: string;
  languageName: string;
  story: string;
}

interface StoryInputFormProps {
  samples: SampleStory[];
  onSubmit: (data: { rawStory: string; targetLanguage: string; durationSeconds: number }) => void;
  isLoading: boolean;
}

export const StoryInputForm: React.FC<StoryInputFormProps> = ({ samples, onSubmit, isLoading }) => {
  const [rawStory, setRawStory] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);

  const handleSelectSample = (sample: SampleStory) => {
    setRawStory(sample.story);
    setSelectedSample(sample.id);
    // If Hindi or Gujarati sample, default target language can be English or same
    setTargetLanguage('en');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawStory.trim() || isLoading) return;

    onSubmit({
      rawStory: rawStory.trim(),
      targetLanguage,
      durationSeconds: durationMinutes * 60,
    });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 lg:p-8 shadow-xl">
      <div className="mb-6">
        <div className="flex items-center space-x-2 text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
          <BookOpen className="w-4 h-4" />
          <span>Stage 00/01 Initiation</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Convert Raw Story to Video Script</h2>
        <p className="text-sm text-slate-400 mt-1">
          Input your narrative in any language (Hindi, Gujarati, English, etc.). The engine creates a locked Ground
          Truth, calculates scene timelines, writes narration, and crafts AI visual prompts.
        </p>
      </div>

      {/* Preset Story Pickers */}
      <div className="mb-6">
        <div className="text-xs font-semibold text-slate-400 mb-2.5 flex items-center justify-between">
          <span>TRY SAMPLE STORIES (1-CLICK LOAD):</span>
          <span className="text-[11px] text-slate-500 font-normal">Multi-lingual presets</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {samples.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleSelectSample(sample)}
              className={`p-3 text-left rounded-xl border transition-all ${
                selectedSample === sample.id
                  ? 'bg-orange-500/10 border-orange-500/50 text-orange-200 ring-1 ring-orange-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-100 truncate">{sample.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-orange-400 font-medium">
                  {sample.languageName}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">{sample.story}</p>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center space-x-1.5">
              <span>RAW STORY TEXT</span>
              <span className="text-rose-400">*</span>
            </label>
            <span className="text-xs text-slate-400">{rawStory.trim().split(/\s+/).filter(Boolean).length} words</span>
          </div>
          <textarea
            value={rawStory}
            onChange={(e) => {
              setRawStory(e.target.value);
              setSelectedSample(null);
            }}
            placeholder="Paste your story here in Hindi, Gujarati, English, or any other language... (e.g. mythology, folk tale, novel chapter, screenplay concept)"
            rows={7}
            required
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-sm leading-relaxed"
          />
        </div>

        {/* Configuration Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Target Language */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Target Script Language</span>
            </label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="en">English (Global Standard)</option>
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="gu">Gujarati (ગુજરાતી)</option>
              <option value="mr">Marathi (मराठी)</option>
              <option value="bn">Bengali (বাংলা)</option>
              <option value="es">Spanish (Español)</option>
              <option value="fr">French (Français)</option>
              <option value="de">German (Deutsch)</option>
              <option value="ja">Japanese (日本語)</option>
            </select>
          </div>

          {/* Requested Video Duration */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Target Video Runtime</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[2, 5, 10, 15].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                    durationMinutes === mins
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-400">
          <div className="flex items-start space-x-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-300">Locked Ground Truth:</strong> SHA-256 integrity prevents character &
              location hallucination.
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-300">Weighted Timeline:</strong> Proportional scene timing, 150wpm narration,
              emotion bonuses.
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-300">AI Visual Prompts:</strong> Production-ready image and video motion
              prompts.
            </span>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!rawStory.trim() || isLoading}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-bold text-base shadow-lg shadow-orange-500/25 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.99]"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>{isLoading ? 'INITIALIZING ENGINE...' : 'START VIDEO SCRIPT PIPELINE'}</span>
        </button>
      </form>
    </div>
  );
};
