import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Copy,
  Check,
  RotateCw,
  GitBranch,
  FileCode,
  Sparkles,
  User
} from 'lucide-react';
import { ChatMessage, ToolCallBlock, ToolResultBlock } from '../../../../shared/types';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';
import { useAppStore } from '../../store/useAppStore';

interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const selectArtifact = useAppStore(state => state.selectArtifact);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract blocks if available
  const blocks = message.blocks || [];
  const thinkingBlocks = blocks.filter(b => b.type === 'thinking') as any[];
  const toolCallBlocks = blocks.filter(b => b.type === 'tool_call') as ToolCallBlock[];
  const toolResultBlocks = blocks.filter(b => b.type === 'tool_result') as ToolResultBlock[];
  const imageBlocks = blocks.filter(b => b.type === 'image') as any[];

  return (
    <div className={`py-5 px-6 group transition-colors ${isUser ? 'bg-transparent' : 'bg-antror-850/40 border-y border-antror-800/20'}`}>
      <div className="max-w-4xl mx-auto flex items-start space-x-4">
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-full bg-antror-700 flex items-center justify-center text-antror-200">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand-600/90 flex items-center justify-center text-white shadow-sm ring-1 ring-brand-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="font-semibold text-xs text-antror-200">
              {isUser ? 'You' : 'Antror'}
            </span>
            {message.model && !isUser && (
              <span className="text-[10px] text-antror-500 font-mono bg-antror-800/80 px-1.5 py-0.5 rounded">
                {message.model}
              </span>
            )}
            <span className="text-[10px] text-antror-500">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* User Images */}
          {imageBlocks.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {imageBlocks.map((img, i) => (
                <img
                  key={i}
                  src={img.data}
                  alt="attachment"
                  className="max-w-xs max-h-48 rounded-lg border border-antror-700 object-cover"
                />
              ))}
            </div>
          )}

          {/* Thinking Blocks */}
          {thinkingBlocks.map((tb, idx) => (
            <ThinkingBlock key={idx} text={tb.text} />
          ))}

          {/* Tool Calls Cards */}
          {toolCallBlocks.map((tc) => {
            const result = toolResultBlocks.find(r => r.toolCallId === tc.id);
            return <ToolCallCard key={tc.id} toolCall={tc} result={result} />;
          })}

          {/* Main Markdown Text */}
          {message.content && (
            <div className="prose-chat text-sm text-antror-200 leading-relaxed break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeText = String(children).replace(/\n$/, '');

                    if (!inline && match) {
                      return (
                        <div className="relative group/code my-3 rounded-lg overflow-hidden border border-antror-700/60 bg-antror-950">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-antror-900 border-b border-antror-800 text-[11px] text-antror-400 font-mono">
                            <span>{match[1]}</span>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  selectArtifact({
                                    id: `art-${Date.now()}`,
                                    chatId: message.chatId,
                                    title: `${match[1].toUpperCase()} Snippet`,
                                    type: 'code',
                                    content: codeText,
                                    language: match[1],
                                    version: 1,
                                    createdAt: Date.now(),
                                    updatedAt: Date.now()
                                  });
                                }}
                                className="flex items-center space-x-1 hover:text-antror-200 transition-colors"
                                title="Open as Artifact"
                              >
                                <FileCode className="w-3 h-3" />
                                <span>Artifact</span>
                              </button>
                              <button
                                onClick={() => navigator.clipboard.writeText(codeText)}
                                className="hover:text-antror-200 transition-colors"
                                title="Copy code"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <pre className="p-3 overflow-x-auto font-mono text-xs text-antror-200 bg-antror-950">
                            <code>{children}</code>
                          </pre>
                        </div>
                      );
                    }
                    return (
                      <code className="px-1.5 py-0.5 rounded bg-antror-800/80 font-mono text-xs text-brand-300" {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Actions on hover */}
          <div className="mt-2.5 flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="text-antror-500 hover:text-antror-300 transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {!isUser && (
              <button
                onClick={() => {
                  useAppStore.getState().sendMessage('Please retry your previous answer with more detail.');
                }}
                className="text-antror-500 hover:text-antror-300 transition-colors"
                title="Retry response"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
