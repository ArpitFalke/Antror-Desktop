import React, { useRef, useEffect } from 'react';
import {
  FileCode,
  Terminal,
  Globe,
  FolderGit2,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Zap,
  Code,
  Compass
} from 'lucide-react';
import { useAppStore, RightPanelTab } from '../../store/useAppStore';
import { MessageItem } from './MessageItem';
import { Composer } from './Composer';

export const ChatPane: React.FC = () => {
  const {
    currentSessionId,
    sessions,
    messages,
    isRightPanelOpen,
    rightPanelTab,
    toggleRightPanel,
    setRightPanelTab,
    sendMessage
  } = useAppStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const session = sessions.find(s => s.id === currentSessionId);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleTabToggle = (tab: RightPanelTab) => {
    if (isRightPanelOpen && rightPanelTab === tab) {
      toggleRightPanel(false);
    } else {
      setRightPanelTab(tab);
    }
  };

  const starterPrompts = [
    {
      icon: <Code className="w-4 h-4 text-brand-400" />,
      title: 'Generate React Dashboard',
      subtitle: 'Create an interactive analytics card artifact'
    },
    {
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      title: 'Run Terminal Command',
      subtitle: 'Check system info or install a package'
    },
    {
      icon: <Globe className="w-4 h-4 text-emerald-400" />,
      title: 'Browse and summarize',
      subtitle: 'Inspect live web page text in browser'
    },
    {
      icon: <Compass className="w-4 h-4 text-blue-400" />,
      title: 'Analyze Project Code',
      subtitle: 'Scan repository files and explain architecture'
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-antror-900 overflow-hidden relative">
      {/* Top Bar */}
      <header className="h-12 border-b border-antror-800/60 px-5 flex items-center justify-between bg-antror-900/80 backdrop-blur z-10 flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <h2 className="text-sm font-semibold text-antror-200 truncate">
            {session?.title || 'New Conversation'}
          </h2>
          {session?.model && (
            <span className="text-[11px] text-antror-500 font-mono hidden sm:inline">
              · {session.model}
            </span>
          )}
        </div>

        {/* Right Panel Toggles */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleTabToggle('artifacts')}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors ${
              isRightPanelOpen && rightPanelTab === 'artifacts'
                ? 'bg-brand-500/20 text-brand-400'
                : 'text-antror-400 hover:text-antror-200 hover:bg-antror-800'
            }`}
            title="Toggle Artifacts Panel"
          >
            <FileCode className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleTabToggle('terminal')}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors ${
              isRightPanelOpen && rightPanelTab === 'terminal'
                ? 'bg-brand-500/20 text-brand-400'
                : 'text-antror-400 hover:text-antror-200 hover:bg-antror-800'
            }`}
            title="Toggle Built-in Terminal"
          >
            <Terminal className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleTabToggle('browser')}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors ${
              isRightPanelOpen && rightPanelTab === 'browser'
                ? 'bg-brand-500/20 text-brand-400'
                : 'text-antror-400 hover:text-antror-200 hover:bg-antror-800'
            }`}
            title="Toggle Built-in Browser"
          >
            <Globe className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleTabToggle('projects')}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors ${
              isRightPanelOpen && rightPanelTab === 'projects'
                ? 'bg-brand-500/20 text-brand-400'
                : 'text-antror-400 hover:text-antror-200 hover:bg-antror-800'
            }`}
            title="Toggle Project Workspace"
          >
            <FolderGit2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-antror-800 mx-1" />

          <button
            onClick={() => toggleRightPanel()}
            className="p-1.5 text-antror-400 hover:text-antror-200 hover:bg-antror-800 rounded-lg transition-colors"
            title={isRightPanelOpen ? 'Collapse side panel' : 'Open side panel'}
          >
            {isRightPanelOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center mb-4 text-brand-500 shadow-lg shadow-brand-500/10">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-antror-100 mb-2">
              How can Antror help today?
            </h1>
            <p className="text-sm text-antror-400 mb-8 max-w-md">
              A cross-platform assistant for coding, project reasoning, tools, and background execution.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
              {starterPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(p.title)}
                  className="p-3.5 bg-antror-850/60 hover:bg-antror-800/80 border border-antror-800/80 hover:border-antror-700 rounded-xl transition-all group"
                >
                  <div className="flex items-center space-x-2.5 mb-1">
                    {p.icon}
                    <div className="font-medium text-xs text-antror-200 group-hover:text-brand-400 transition-colors">
                      {p.title}
                    </div>
                  </div>
                  <div className="text-[11px] text-antror-500 line-clamp-1">
                    {p.subtitle}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map(msg => (
              <MessageItem key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Composer at Bottom */}
      <Composer />
    </div>
  );
};
