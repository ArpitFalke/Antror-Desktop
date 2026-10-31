import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';

interface ThinkingBlockProps {
  text: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  return (
    <div className="my-2 border border-antror-700/60 bg-antror-850/50 rounded-lg overflow-hidden transition-all text-xs">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-antror-400 hover:text-antror-200 hover:bg-antror-800/40 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Brain className="w-3.5 h-3.5 text-brand-500 animate-pulse" />
          <span className="font-medium text-antror-300">Thinking process</span>
          <span className="text-antror-500">({text.length} chars)</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3.5 py-2.5 border-t border-antror-700/40 bg-antror-900/60 font-mono text-[11px] leading-relaxed text-antror-400 whitespace-pre-wrap max-h-72 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  );
};
