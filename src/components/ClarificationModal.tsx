import { HelpCircle, MessageSquare, Send } from 'lucide-react';
import React, { useState } from 'react';
import { ClarificationItem } from '../types.ts';

interface ClarificationModalProps {
  clarification: ClarificationItem;
  onSubmit: (clarificationId: string, answer: string) => void;
  isLoading: boolean;
}

export const ClarificationModal: React.FC<ClarificationModalProps> = ({
  clarification,
  onSubmit,
  isLoading,
}) => {
  const [answer, setAnswer] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || isLoading) return;
    onSubmit(clarification.id, answer.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Story Clarification Required</h3>
            <p className="text-xs text-slate-400">Ground Truth Engine encountered an ambiguity</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-purple-200 text-sm">
            <div className="font-semibold mb-1 text-purple-300">Question:</div>
            <p className="text-xs text-slate-300 leading-relaxed">{clarification.question}</p>
          </div>

          {clarification.context && (
            <div className="text-xs text-slate-400">
              <strong className="text-slate-300">Context:</strong> {clarification.context}
            </div>
          )}

          {clarification.options && clarification.options.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">Suggested Options:</label>
              <div className="space-y-1.5">
                {clarification.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAnswer(opt)}
                    className={`w-full text-left text-xs p-2.5 rounded-lg border transition-all ${
                      answer === opt
                        ? 'bg-purple-500/20 border-purple-500 text-purple-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center space-x-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
              <span>Your Clarification:</span>
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              placeholder="Type your clarification or choose one of the options above..."
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 placeholder:text-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={!answer.trim() || isLoading}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-purple-600/30 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>SUBMIT & RESUME</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
