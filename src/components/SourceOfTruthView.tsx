import { CheckCircle, Database, Hash, Lock, MapPin, MessageSquare, ShieldCheck, User } from 'lucide-react';
import React, { useState } from 'react';
import { SourceOfTruth } from '../types.ts';

interface SourceOfTruthViewProps {
  sourceOfTruth: SourceOfTruth | null;
}

export const SourceOfTruthView: React.FC<SourceOfTruthViewProps> = ({ sourceOfTruth }) => {
  const [activeSection, setActiveSection] = useState<'all' | 'characters' | 'locations' | 'events' | 'facts'>('all');

  if (!sourceOfTruth) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <Lock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm font-semibold">Source of Truth will be generated and locked in Stage 00.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Integrity Card */}
      <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base">Locked Source of Truth</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase border border-emerald-500/30">
                  WRITE-ONCE VERIFIED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Extracted before scene generation to strictly prevent character and location drift or hallucination.
              </p>
            </div>
          </div>

          <div className="text-xs text-right font-mono text-slate-400">
            <div>Locked: {new Date(sourceOfTruth.locked_at).toLocaleTimeString()}</div>
            <div className="text-emerald-400 font-semibold">Language: {sourceOfTruth.detected_language}</div>
          </div>
        </div>

        {/* Checksum Badge */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-xs text-slate-300 font-mono">
            <Hash className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold text-slate-400 uppercase">SHA-256 HASH:</span>
            <span className="text-emerald-300 select-all break-all">{sourceOfTruth.checksum}</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1 shrink-0 self-start sm:self-auto">
            <CheckCircle className="w-3 h-3" />
            <span>INTEGRITY VERIFIED</span>
          </span>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
            <div className="text-lg font-bold text-white font-mono">{sourceOfTruth.characters.length}</div>
            <div className="text-[11px] text-slate-400 font-medium">Characters</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
            <div className="text-lg font-bold text-white font-mono">{sourceOfTruth.locations.length}</div>
            <div className="text-[11px] text-slate-400 font-medium">Locations</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
            <div className="text-lg font-bold text-white font-mono">{sourceOfTruth.events.length}</div>
            <div className="text-[11px] text-slate-400 font-medium">Events (1-to-1)</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
            <div className="text-lg font-bold text-white font-mono">{sourceOfTruth.dialogue_lines.length}</div>
            <div className="text-[11px] text-slate-400 font-medium">Source Dialogues</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center col-span-2 sm:col-span-1">
            <div className="text-lg font-bold text-white font-mono">{sourceOfTruth.facts.length}</div>
            <div className="text-[11px] text-slate-400 font-medium">Atomic Facts</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-xs font-semibold">
        {(['all', 'characters', 'locations', 'events', 'facts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
              activeSection === tab
                ? 'bg-orange-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Breakdown */}
      <div className="space-y-6">
        {/* Characters */}
        {(activeSection === 'all' || activeSection === 'characters') && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
              <User className="w-4 h-4 text-orange-400" />
              <span>Locked Characters ({sourceOfTruth.characters.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sourceOfTruth.characters.map((c) => (
                <div key={c.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <span className="font-bold text-slate-100 text-sm">{c.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-2">[{c.id}]</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                      {c.gender}, {c.age}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-300">
                    <p>
                      <strong className="text-slate-400">Appearance:</strong> {c.appearance}
                    </p>
                    <p>
                      <strong className="text-slate-400">Clothing:</strong> {c.clothing}
                    </p>
                    {c.relationships.length > 0 && (
                      <p>
                        <strong className="text-slate-400">Relationships:</strong> {c.relationships.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locations */}
        {(activeSection === 'all' || activeSection === 'locations') && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span>Locked Locations ({sourceOfTruth.locations.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sourceOfTruth.locations.map((l) => (
                <div key={l.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <span className="font-bold text-slate-100 text-sm">{l.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">[{l.id}]</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{l.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events */}
        {(activeSection === 'all' || activeSection === 'events') && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Locked Chronological Events ({sourceOfTruth.events.length})</span>
            </div>
            <div className="space-y-3">
              {sourceOfTruth.events.map((e) => (
                <div key={e.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold font-mono text-[10px]">
                        EVENT {e.order_index} [{e.id}]
                      </span>
                      <span className="text-slate-400 capitalize">
                        {e.time_of_day} • {e.location_id}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium text-[11px]">
                      {e.emotion}
                    </span>
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed">{e.description}</p>
                  <div className="text-[11px] text-slate-400">
                    <strong className="text-slate-400">Characters:</strong> {e.characters_involved.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Atomic Facts */}
        {(activeSection === 'all' || activeSection === 'facts') && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Atomic Verified Facts ({sourceOfTruth.facts.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {sourceOfTruth.facts.map((fact, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-300 flex items-start space-x-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                  <span>{fact}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
