import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { Sidebar } from './components/sidebar/Sidebar';
import { ChatPane } from './components/chat/ChatPane';
import { ArtifactPanel } from './components/artifacts/ArtifactPanel';
import { TerminalPanel } from './components/terminal/TerminalPanel';
import { BrowserPanel } from './components/browser/BrowserPanel';
import { ProjectPanel } from './components/projects/ProjectPanel';
import { CommandPalette } from './components/modals/CommandPalette';
import { PermissionModal } from './components/modals/PermissionModal';
import { SettingsModal } from './components/settings/SettingsModal';

export const App: React.FC = () => {
  const {
    init,
    isRightPanelOpen,
    rightPanelTab
  } = useAppStore();

  useEffect(() => {
    init();
  }, []);

  const renderRightPanelContent = () => {
    switch (rightPanelTab) {
      case 'artifacts':
        return <ArtifactPanel />;
      case 'terminal':
        return <TerminalPanel />;
      case 'browser':
        return <BrowserPanel />;
      case 'projects':
        return <ProjectPanel />;
      default:
        return <ArtifactPanel />;
    }
  };

  return (
    <div className="h-screen w-screen flex bg-antror-900 text-antror-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Chat Pane */}
      <main className="flex-1 flex flex-col h-full min-w-0">
        <ChatPane />
      </main>

      {/* Right Side Panel (Collapsible) */}
      {isRightPanelOpen && (
        <aside className="w-[480px] xl:w-[560px] h-full flex-shrink-0 transition-all">
          {renderRightPanelContent()}
        </aside>
      )}

      {/* Modals & Overlays */}
      <CommandPalette />
      <PermissionModal />
      <SettingsModal />
    </div>
  );
};

export default App;
