import React, { useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Settings,
  FolderGit2,
  FileCode,
  Sparkles,
  Command,
  Loader2
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ChatSession } from '../../../../shared/types';

export const Sidebar: React.FC = () => {
  const {
    sessions,
    currentSessionId,
    activeRuns,
    searchQuery,
    searchResults,
    selectSession,
    createSession,
    deleteSession,
    openSettings,
    performSearch,
    toggleCommandPalette,
    setRightPanelTab
  } = useAppStore();

  const [localSearch, setLocalSearch] = useState('');

  // Group sessions by date
  const now = Date.now();
  const dayMs = 86400000;

  const todaySessions: ChatSession[] = [];
  const yesterdaySessions: ChatSession[] = [];
  const pastWeekSessions: ChatSession[] = [];
  const olderSessions: ChatSession[] = [];

  for (const s of sessions) {
    const diff = now - s.updatedAt;
    if (diff < dayMs) {
      todaySessions.push(s);
    } else if (diff < dayMs * 2) {
      yesterdaySessions.push(s);
    } else if (diff < dayMs * 7) {
      pastWeekSessions.push(s);
    } else {
      olderSessions.push(s);
    }
  }

  const renderSessionGroup = (title: string, list: ChatSession[]) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="px-3 mb-1.5 text-[11px] font-semibold text-antror-500 uppercase tracking-wider">
          {title}
        </div>
        <div className="space-y-0.5">
          {list.map(session => {
            const isSelected = session.id === currentSessionId;
            const isRunning = activeRuns.has(session.id);

            return (
              <div
                key={session.id}
                onClick={() => selectSession(session.id)}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-antror-800 text-antror-100 font-medium shadow-sm'
                    : 'text-antror-350 hover:bg-antror-850/80 hover:text-antror-200'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 pr-6">
                  {isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin flex-shrink-0" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 text-antror-500 group-hover:text-antror-400 flex-shrink-0" />
                  )}
                  <span className="truncate">{session.title}</span>
                </div>

                {isRunning && (
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping absolute right-8" />
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-antror-500 hover:text-rose-400 transition-opacity rounded"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-64 h-full bg-antror-950 border-r border-antror-800/80 flex flex-col flex-shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-antror-850/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-md shadow-brand-600/20 font-bold text-xs tracking-tight">
            A
          </div>
          <div>
            <span className="font-semibold text-sm text-antror-100 tracking-tight">Antror</span>
            <span className="ml-1.5 px-1.5 py-0.2 bg-antror-800 text-antror-400 rounded text-[9px] font-mono">v1.0</span>
          </div>
        </div>

        <button
          onClick={() => toggleCommandPalette(true)}
          className="p-1 text-antror-500 hover:text-antror-300 hover:bg-antror-850 rounded transition-colors text-[11px] flex items-center space-x-1"
          title="Command Palette (Ctrl+K)"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="font-mono text-[10px]">K</span>
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={() => createSession()}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-medium text-xs rounded-xl shadow-md shadow-brand-900/40 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New chat</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-3 pb-2">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-antror-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              performSearch(e.target.value);
            }}
            className="w-full bg-antror-900/90 border border-antror-800/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-antror-200 placeholder-antror-500 focus:outline-none focus:border-brand-500/70"
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {localSearch.trim() ? (
          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold text-antror-500 uppercase tracking-wider">
              Search Results ({searchResults.length})
            </div>
            {searchResults.map(res => (
              <div
                key={res.messageId}
                onClick={() => selectSession(res.chatId)}
                className="p-2.5 mb-1 bg-antror-900/50 hover:bg-antror-850 rounded-lg cursor-pointer border border-antror-800/50"
              >
                <div className="text-xs font-medium text-antror-200 truncate">{res.title}</div>
                <div className="text-[11px] text-antror-400 mt-1 line-clamp-2">{res.snippet}</div>
              </div>
            ))}
            {searchResults.length === 0 && (
              <div className="text-center py-6 text-xs text-antror-500">
                No matching messages found.
              </div>
            )}
          </div>
        ) : (
          <>
            {renderSessionGroup('Today', todaySessions)}
            {renderSessionGroup('Yesterday', yesterdaySessions)}
            {renderSessionGroup('Previous 7 Days', pastWeekSessions)}
            {renderSessionGroup('Older', olderSessions)}
          </>
        )}
      </div>

      {/* Bottom Nav / Settings */}
      <div className="p-2.5 border-t border-antror-850/80 bg-antror-950 flex items-center justify-between">
        <div
          onClick={() => openSettings('general')}
          className="flex items-center space-x-2.5 p-1.5 rounded-lg hover:bg-antror-850 cursor-pointer transition-colors flex-1 min-w-0"
        >
          <div className="w-6 h-6 rounded-full bg-antror-800 border border-antror-700 flex items-center justify-center text-[11px] font-semibold text-brand-400 flex-shrink-0">
            A
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-antror-200 truncate">Antror User</div>
            <div className="text-[10px] text-antror-500 truncate">Local / Offline</div>
          </div>
        </div>

        <button
          onClick={() => openSettings('providers')}
          className="p-2 text-antror-400 hover:text-antror-200 hover:bg-antror-850 rounded-lg transition-colors"
          title="Open Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
