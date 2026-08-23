import { CheckCircle2, ChevronDown, ChevronRight, Clock, Cpu, RefreshCw, Terminal, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import { LLMCallLog } from '../types.ts';

interface ActivityLogsProps {
  logs: LLMCallLog[];
}

export const ActivityLogs: React.FC<ActivityLogsProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden mt-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 bg-slate-950/80 hover:bg-slate-950 flex items-center justify-between text-xs text-slate-300 font-semibold transition-all"
      >
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-orange-400" />
          <span>LLM Execution & Retry Audit Logs</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px]">
            {logs.length} Calls
          </span>
        </div>
        <div className="flex items-center space-x-1 text-slate-400 text-xs">
          <span>{isOpen ? 'Hide Stream' : 'View Stream'}</span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 bg-slate-950 border-t border-slate-800 max-h-72 overflow-y-auto space-y-2 font-mono text-[11px]">
          {logs.length === 0 ? (
            <div className="text-slate-500 text-center py-4">No LLM execution events recorded yet.</div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center space-x-2">
                  {log.status === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span className="text-orange-400 font-bold">Stage {log.stage}</span>
                  <span className="text-slate-300 font-sans">{log.stage_name}</span>
                </div>

                <div className="flex items-center space-x-3 text-slate-400 text-[10px]">
                  <span className="uppercase text-purple-300 font-semibold">{log.provider}</span>
                  <span>{log.model}</span>
                  <span>Attempt {log.attempt}</span>
                  {log.duration_ms && (
                    <span className="text-cyan-300 flex items-center space-x-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{log.duration_ms}ms</span>
                    </span>
                  )}
                  <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
