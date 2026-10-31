import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Plus, X, Terminal as TermIcon } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

interface TerminalTab {
  id: string;
  name: string;
}

export const TerminalPanel: React.FC = () => {
  const [tabs, setTabs] = useState<TerminalTab[]>([{ id: 'term-1', name: 'Terminal 1' }]);
  const [activeTabId, setActiveTabId] = useState<string>('term-1');
  const termContainerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!termContainerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", Consolas, monospace',
      fontSize: 13,
      theme: {
        background: '#0e0e0d',
        foreground: '#e6e4df',
        cursor: '#d96b36',
        selectionBackground: 'rgba(217, 107, 54, 0.3)',
        black: '#141413',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#faf9f5'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termContainerRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    if (window.antrorAPI) {
      // Create session
      window.antrorAPI.createTerminal(activeTabId);

      // Listen for data
      const unsub = window.antrorAPI.onTerminalData(activeTabId, (data) => {
        term.write(data);
      });

      // Send keystrokes
      term.onData((data) => {
        window.antrorAPI.sendTerminalInput(activeTabId, data);
      });

      // Resize
      const handleResize = () => {
        fitAddon.fit();
        window.antrorAPI.resizeTerminal(activeTabId, term.cols, term.rows);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        unsub();
        term.dispose();
      };
    }
  }, [activeTabId]);

  const addTab = () => {
    const newId = `term-${Date.now()}`;
    const newTabs = [...tabs, { id: newId, name: `Terminal ${tabs.length + 1}` }];
    setTabs(newTabs);
    setActiveTabId(newId);
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    if (window.antrorAPI) {
      window.antrorAPI.closeTerminal(id);
    }
    const filtered = tabs.filter(t => t.id !== id);
    setTabs(filtered);
    if (activeTabId === id) {
      setActiveTabId(filtered[0].id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0e0e0d] border-l border-antror-800/80">
      {/* Terminal Tabs Header */}
      <div className="h-10 border-b border-antror-800/80 px-3 bg-antror-950 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center space-x-2 px-2.5 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                  isActive ? 'bg-antror-850 text-antror-100 font-medium' : 'text-antror-400 hover:text-antror-200'
                }`}
              >
                <TermIcon className="w-3 h-3 text-brand-500" />
                <span>{tab.name}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => closeTab(tab.id, e)}
                    className="p-0.5 hover:text-rose-400 rounded transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={addTab}
            className="p-1 text-antror-500 hover:text-antror-200 hover:bg-antror-850 rounded transition-colors"
            title="Open new terminal tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 p-2 overflow-hidden" ref={termContainerRef} />
    </div>
  );
};
