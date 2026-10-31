import React, { useState } from 'react';
import {
  Wrench,
  Terminal,
  FileCode,
  Globe,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { ToolCallBlock, ToolResultBlock } from '../../../../shared/types';

interface ToolCallCardProps {
  toolCall: ToolCallBlock;
  result?: ToolResultBlock;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall, result }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getToolIcon = (name: string) => {
    if (name.includes('terminal') || name.includes('bash')) return <Terminal className="w-3.5 h-3.5 text-amber-500" />;
    if (name.includes('file')) return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
    if (name.includes('web') || name.includes('browser')) return <Globe className="w-3.5 h-3.5 text-emerald-400" />;
    if (name.includes('memory')) return <Database className="w-3.5 h-3.5 text-purple-400" />;
    return <Wrench className="w-3.5 h-3.5 text-antror-400" />;
  };

  const getStatusBadge = () => {
    if (toolCall.status === 'running') {
      return (
        <span className="flex items-center space-x-1 text-brand-500 font-medium text-[11px]">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Running...</span>
        </span>
      );
    }
    if (toolCall.status === 'completed') {
      return (
        <span className="flex items-center space-x-1 text-emerald-400 font-medium text-[11px]">
          <CheckCircle2 className="w-3 h-3" />
          <span>Completed {toolCall.executionTimeMs ? `(${toolCall.executionTimeMs}ms)` : ''}</span>
        </span>
      );
    }
    if (toolCall.status === 'denied') {
      return (
        <span className="flex items-center space-x-1 text-rose-400 font-medium text-[11px]">
          <XCircle className="w-3 h-3" />
          <span>Denied</span>
        </span>
      );
    }
    return (
      <span className="text-antror-400 text-[11px]">Pending</span>
    );
  };

  const outputContent = result?.content || toolCall.output;

  return (
    <div className="my-2 border border-antror-700/60 bg-antror-850/80 rounded-lg overflow-hidden text-xs">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-antror-800/40 transition-colors"
      >
        <div className="flex items-center space-x-2.5">
          {getToolIcon(toolCall.name)}
          <span className="font-mono font-medium text-antror-200">{toolCall.name}</span>
        </div>
        <div className="flex items-center space-x-3">
          {getStatusBadge()}
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-antror-400" /> : <ChevronRight className="w-3.5 h-3.5 text-antror-400" />}
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-antror-700/40 p-3 space-y-2 bg-antror-900/40">
          <div>
            <div className="text-[10px] uppercase font-semibold text-antror-500 mb-1 tracking-wider">Arguments</div>
            <pre className="p-2 bg-antror-950 rounded border border-antror-800 font-mono text-[11px] text-antror-300 overflow-x-auto max-h-40">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {outputContent && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-antror-500 mb-1 tracking-wider">Output</div>
              <pre className="p-2 bg-antror-950 rounded border border-antror-800 font-mono text-[11px] text-antror-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                {outputContent}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
