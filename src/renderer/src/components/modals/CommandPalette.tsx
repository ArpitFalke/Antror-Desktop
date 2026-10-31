import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Settings,
  Terminal,
  FileCode,
  Globe,
  FolderGit2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const CommandPalette: React.FC = () => {
  const [query, setQuery] = useState('');
  const {
    isCommandPaletteOpen,
    toggleCommandPalette,
    createSession,
    openSettings,
    setRightPanelTab,
    sessions,
    selectSession
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        toggleCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const defaultCommands = [
    {
      id: 'new_chat',
      title: 'Start New Chat',
      subtitle: 'Create a new conversation session',
      icon: <Plus className="w-4 h-4 text-brand-400" />,
      action: () => {
        createSession();
        toggleCommandPalette(false);
      }
    },
    {
      id: 'open_settings',
      title: 'Open Settings',
      subtitle: 'Configure Providers, Keys, MCP, Memory',
      icon: <Settings className="w-4 h-4 text-antror-400" />,
      action: () => {
        openSettings();
        toggleCommandPalette(false);
      }
    },
    {
      id: 'tab_artifacts',
      title: 'View Artifacts',
      subtitle: 'Open the Artifacts side panel',
      icon: <FileCode className="w-4 h-4 text-blue-400" />,
      action: () => {
        setRightPanelTab('artifacts');
        toggleCommandPalette(false);
      }
    },
    {
      id: 'tab_terminal',
      title: 'Open Terminal',
      subtitle: 'Switch to the built-in command line terminal',
      icon: <Terminal className="w-4 h-4 text-amber-400" />,
      action: () => {
        setRightPanelTab('terminal');
        toggleCommandPalette(false);
      }
    },
    {
      id: 'tab_browser',
      title: 'Open Browser',
      subtitle: 'Switch to the built-in web browser panel',
      icon: <Globe className="w-4 h-4 text-emerald-400" />,
      action: () => {
        setRightPanelTab('browser');
        toggleCommandPalette(false);
      }
    },
    {
      id: 'tab_projects',
      title: 'Open Project Workspace',
      subtitle: 'Inspect files in ~/Antror/Projects',
      icon: <FolderGit2 className="w-4 h-4 text-purple-400" />,
      action: () => {
        setRightPanelTab('projects');
        toggleCommandPalette(false);
      }
    }
  ];

  const filteredCommands = defaultCommands.filter(c =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const matchedSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-xl bg-antror-850 border border-antror-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="p-3.5 border-b border-antror-750 flex items-center space-x-3">
          <Search className="w-4 h-4 text-antror-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search chats..."
            className="w-full bg-transparent text-sm text-antror-100 placeholder-antror-500 focus:outline-none"
            autoFocus
          />
          <kbd className="px-1.5 py-0.5 text-[10px] bg-antror-800 text-antror-400 rounded border border-antror-700 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-antror-800/40">
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] uppercase font-semibold text-antror-500 tracking-wider">
              Actions
            </div>
            {filteredCommands.map(cmd => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className="w-full px-3 py-2 text-left rounded-xl flex items-center justify-between text-xs text-antror-300 hover:bg-antror-800 hover:text-antror-100 transition-colors group"
              >
                <div className="flex items-center space-x-2.5">
                  {cmd.icon}
                  <div>
                    <div className="font-medium">{cmd.title}</div>
                    <div className="text-[10px] text-antror-500">{cmd.subtitle}</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-antror-600 group-hover:text-antror-300 transition-colors" />
              </button>
            ))}
          </div>

          {matchedSessions.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="px-2 py-1 text-[10px] uppercase font-semibold text-antror-500 tracking-wider">
                Chats
              </div>
              {matchedSessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    selectSession(s.id);
                    toggleCommandPalette(false);
                  }}
                  className="w-full px-3 py-2 text-left rounded-xl flex items-center justify-between text-xs text-antror-300 hover:bg-antror-800 hover:text-antror-100 transition-colors"
                >
                  <span className="truncate">{s.title}</span>
                  <span className="text-[10px] text-antror-500 font-mono">{s.model}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
