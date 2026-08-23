import { Check, Edit3, Lock, MapPin, Play, ShieldAlert, User, Users } from 'lucide-react';
import React, { useState } from 'react';
import { CharacterProfile, LocationProfile } from '../types.ts';

interface CheckpointModalProps {
  characters: CharacterProfile[];
  locations: LocationProfile[];
  onConfirm: (updated: { characters: CharacterProfile[]; locations: LocationProfile[] }) => void;
  isLoading: boolean;
}

export const CheckpointModal: React.FC<CheckpointModalProps> = ({
  characters: initialChars,
  locations: initialLocs,
  onConfirm,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'characters' | 'locations'>('characters');
  const [characters, setCharacters] = useState<CharacterProfile[]>(initialChars);
  const [locations, setLocations] = useState<LocationProfile[]>(initialLocs);
  const [editingCharId, setEditingCharId] = useState<string | null>(null);

  const handleCharacterChange = (index: number, field: keyof CharacterProfile, value: any) => {
    const updated = [...characters];
    updated[index] = { ...updated[index], [field]: value };
    setCharacters(updated);
  };

  const handleLocationChange = (index: number, field: keyof LocationProfile, value: any) => {
    const updated = [...locations];
    updated[index] = { ...updated[index], [field]: value };
    setLocations(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({ characters, locations });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
              <ShieldAlert className="w-4 h-4" />
              <span>Stage 04 Human Checkpoint</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Review Cast & Location Profiles</h2>
            <p className="text-xs text-slate-400 mt-1">
              Physical appearance and attire are locked to Ground Truth. Review psychological traits, voice style, and
              world aesthetics before scene generation commences.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('characters')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'characters'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Characters ({characters.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('locations')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'locations'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Locations ({locations.length})</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'characters' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {characters.map((char, idx) => (
                <div key={char.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{char.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{char.id}</span>
                      </div>
                    </div>

                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-medium">
                      {char.role}
                    </span>
                  </div>

                  {/* Locked Base Traits */}
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-400 font-semibold text-[11px]">
                      <span className="flex items-center space-x-1 text-emerald-400">
                        <Lock className="w-3 h-3" />
                        <span>LOCKED PHYSICAL IDENTITY (SOURCE TRUTH)</span>
                      </span>
                      <span>{char.gender}, {char.age}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      <strong className="text-slate-400">Appearance:</strong> {char.appearance}
                    </p>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      <strong className="text-slate-400">Attire:</strong> {char.clothing}
                    </p>
                  </div>

                  {/* Editable Fields */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Role in Script:</label>
                      <input
                        type="text"
                        value={char.role}
                        onChange={(e) => handleCharacterChange(idx, 'role', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Personality & Tone:</label>
                      <textarea
                        value={char.personality}
                        onChange={(e) => handleCharacterChange(idx, 'personality', e.target.value)}
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Voice & Delivery Style:</label>
                      <input
                        type="text"
                        value={char.voice_style}
                        onChange={(e) => handleCharacterChange(idx, 'voice_style', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'locations' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locations.map((loc, idx) => (
                <div key={loc.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{loc.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{loc.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center space-x-1 text-emerald-400 font-semibold text-[11px]">
                      <Lock className="w-3 h-3" />
                      <span>LOCKED DESCRIPTION (SOURCE TRUTH)</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">{loc.description}</p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Atmospheric Mood:</label>
                      <input
                        type="text"
                        value={loc.mood}
                        onChange={(e) => handleLocationChange(idx, 'mood', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Visual Cinematography Style:</label>
                      <textarea
                        value={loc.visual_style}
                        onChange={(e) => handleLocationChange(idx, 'visual_style', e.target.value)}
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Locked items cannot be altered to prevent hallucination.</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold text-xs flex items-center space-x-2 shadow-lg shadow-orange-500/20 disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>CONFIRM & RESUME PIPELINE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
