import React, { useState } from 'react';
import {
  X,
  Key,
  Cpu,
  Brain,
  Layers,
  Terminal,
  Globe,
  FolderGit2,
  Palette,
  Keyboard,
  Shield,
  Info,
  Check,
  Loader2,
  Trash2,
  Plus
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ProviderConfig, MCPServerConfig, LLMProviderId } from '../../../../shared/types';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    settingsSection,
    closeSettings,
    providers,
    settings,
    mcpServers,
    projects,
    refreshProviders,
    refreshMCPServers
  } = useAppStore();

  const [activeSection, setActiveSection] = useState(settingsSection || 'providers');
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [apiKeysInput, setApiKeysInput] = useState<Record<string, string>>({});
  const [baseUrlsInput, setBaseUrlsInput] = useState<Record<string, string>>({});

  // MCP state
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpCommand, setNewMcpCommand] = useState('');
  const [newMcpArgs, setNewMcpArgs] = useState('');

  if (!isSettingsOpen) return null;

  const sections = [
    { id: 'providers', label: 'Providers', icon: <Key className="w-4 h-4" /> },
    { id: 'models', label: 'Models', icon: <Cpu className="w-4 h-4" /> },
    { id: 'memory', label: 'Memory', icon: <Brain className="w-4 h-4" /> },
    { id: 'mcp', label: 'MCP Servers', icon: <Layers className="w-4 h-4" /> },
    { id: 'terminal', label: 'Terminal', icon: <Terminal className="w-4 h-4" /> },
    { id: 'browser', label: 'Browser', icon: <Globe className="w-4 h-4" /> },
    { id: 'projects', label: 'Projects', icon: <FolderGit2 className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy', icon: <Shield className="w-4 h-4" /> },
    { id: 'about', label: 'About', icon: <Info className="w-4 h-4" /> }
  ];

  const handleTestConnection = async (provider: ProviderConfig) => {
    setTestingProvider(provider.id);
    setTestResult(null);
    try {
      const apiKey = apiKeysInput[provider.id] || undefined;
      const baseUrl = baseUrlsInput[provider.id] || undefined;
      const res = await window.antrorAPI?.testConnection(provider.id, apiKey, baseUrl);
      setTestResult({
        id: provider.id,
        success: Boolean(res?.success),
        message: res?.message || 'Done'
      });
    } catch (e: any) {
      setTestResult({ id: provider.id, success: false, message: e.message });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveProvider = async (provider: ProviderConfig) => {
    const updated: ProviderConfig = {
      ...provider,
      apiKey: apiKeysInput[provider.id] || provider.apiKey,
      baseUrl: baseUrlsInput[provider.id] || provider.baseUrl
    };
    await window.antrorAPI?.saveProvider(updated);
    await refreshProviders();
    alert(`Saved configuration for ${provider.name}`);
  };

  const handleAddMCPServer = async () => {
    if (!newMcpName || !newMcpCommand || !window.antrorAPI) return;
    const s: MCPServerConfig = {
      id: `mcp-${Date.now()}`,
      name: newMcpName,
      transport: 'stdio',
      command: newMcpCommand,
      args: newMcpArgs.split(' ').filter(Boolean),
      enabled: true
    };
    await window.antrorAPI.saveMCPServer(s);
    await refreshMCPServers();
    setNewMcpName('');
    setNewMcpCommand('');
    setNewMcpArgs('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-4xl h-[700px] bg-antror-900 border border-antror-750 rounded-2xl shadow-2xl flex overflow-hidden">
        {/* Settings Navigation Sidebar */}
        <div className="w-56 bg-antror-950 border-r border-antror-800/80 p-3 flex flex-col justify-between flex-shrink-0">
          <div>
            <div className="px-3 py-2 text-xs font-bold text-antror-300 uppercase tracking-wider">
              Settings
            </div>
            <div className="space-y-0.5 mt-1">
              {sections.map(s => {
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                      isActive ? 'bg-antror-800 text-brand-400' : 'text-antror-400 hover:bg-antror-900 hover:text-antror-200'
                    }`}
                  >
                    {s.icon}
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 text-[11px] text-antror-500 font-mono">
            Antror v1.0.0
          </div>
        </div>

        {/* Content Pane */}
        <div className="flex-1 flex flex-col overflow-hidden bg-antror-900">
          {/* Header */}
          <div className="h-14 px-6 border-b border-antror-800/80 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-antror-100 capitalize">
              {activeSection} Configuration
            </h2>
            <button
              onClick={closeSettings}
              className="p-1.5 text-antror-400 hover:text-antror-200 hover:bg-antror-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Section */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Providers Section */}
            {activeSection === 'providers' && (
              <div className="space-y-4">
                <p className="text-xs text-antror-400">
                  Antror stores your API keys encrypted in the operating system keychain (Electron safeStorage).
                </p>

                <div className="divide-y divide-antror-800/60">
                  {providers.map(p => (
                    <div key={p.id} className="py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-xs text-antror-200">{p.name}</span>
                          <span className="text-[10px] font-mono text-antror-500 bg-antror-950 px-1.5 py-0.5 rounded">
                            {p.id}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleTestConnection(p)}
                            disabled={testingProvider === p.id}
                            className="px-2.5 py-1 text-xs font-medium bg-antror-800 hover:bg-antror-750 text-antror-200 rounded-lg transition-colors flex items-center space-x-1"
                          >
                            {testingProvider === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            <span>Test Connection</span>
                          </button>
                          <button
                            onClick={() => handleSaveProvider(p)}
                            className="px-2.5 py-1 text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-antror-400 mb-1">API Key</label>
                          <input
                            type="password"
                            placeholder={p.apiKey || 'Enter API Key...'}
                            value={apiKeysInput[p.id] || ''}
                            onChange={e => setApiKeysInput({ ...apiKeysInput, [p.id]: e.target.value })}
                            className="w-full bg-antror-950 border border-antror-800 rounded-lg px-3 py-1.5 text-xs text-antror-200 focus:outline-none focus:border-brand-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-antror-400 mb-1">Base URL</label>
                          <input
                            type="text"
                            value={baseUrlsInput[p.id] !== undefined ? baseUrlsInput[p.id] : (p.baseUrl || '')}
                            onChange={e => setBaseUrlsInput({ ...baseUrlsInput, [p.id]: e.target.value })}
                            className="w-full bg-antror-950 border border-antror-800 rounded-lg px-3 py-1.5 text-xs text-antror-200 focus:outline-none focus:border-brand-500"
                          />
                        </div>
                      </div>

                      {testResult && testResult.id === p.id && (
                        <div className={`p-2.5 rounded-lg text-xs font-mono ${
                          testResult.success ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
                        }`}>
                          {testResult.message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MCP Section */}
            {activeSection === 'mcp' && (
              <div className="space-y-5">
                <p className="text-xs text-antror-400">
                  Connect Model Context Protocol (MCP) servers via stdio or SSE.
                </p>

                {/* Add Server Form */}
                <div className="p-4 bg-antror-950 rounded-xl border border-antror-800 space-y-3">
                  <div className="font-semibold text-xs text-antror-200">Add New MCP Server</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Server name (e.g. filesystem)"
                      value={newMcpName}
                      onChange={e => setNewMcpName(e.target.value)}
                      className="bg-antror-900 border border-antror-800 rounded px-2.5 py-1.5 text-xs text-antror-200 focus:outline-none focus:border-brand-500"
                    />
                    <input
                      type="text"
                      placeholder="Command (e.g. npx)"
                      value={newMcpCommand}
                      onChange={e => setNewMcpCommand(e.target.value)}
                      className="bg-antror-900 border border-antror-800 rounded px-2.5 py-1.5 text-xs text-antror-200 focus:outline-none focus:border-brand-500"
                    />
                    <input
                      type="text"
                      placeholder="Args (e.g. -y @modelcontextprotocol/server-filesystem)"
                      value={newMcpArgs}
                      onChange={e => setNewMcpArgs(e.target.value)}
                      className="bg-antror-900 border border-antror-800 rounded px-2.5 py-1.5 text-xs text-antror-200 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <button
                    onClick={handleAddMCPServer}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Server</span>
                  </button>
                </div>

                {/* Existing MCP Servers */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-antror-300 uppercase tracking-wider">Installed Servers</div>
                  {mcpServers.map(s => (
                    <div key={s.id} className="p-3 bg-antror-950 rounded-lg border border-antror-800 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-xs text-antror-200">{s.name}</div>
                        <div className="font-mono text-[10px] text-antror-500">{s.command} {s.args?.join(' ')}</div>
                      </div>
                      <button
                        onClick={async () => {
                          await window.antrorAPI?.deleteMCPServer(s.id);
                          refreshMCPServers();
                        }}
                        className="text-antror-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {mcpServers.length === 0 && (
                    <div className="p-4 text-center text-xs text-antror-500 bg-antror-950 rounded-lg">
                      No MCP servers configured yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Shortcuts Section */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-antror-950 rounded-lg border border-antror-800 flex justify-between items-center">
                    <span className="text-antror-300">Command Palette</span>
                    <kbd className="px-2 py-0.5 bg-antror-850 border border-antror-700 rounded font-mono text-[11px]">Ctrl/Cmd + K</kbd>
                  </div>
                  <div className="p-3 bg-antror-950 rounded-lg border border-antror-800 flex justify-between items-center">
                    <span className="text-antror-300">Quick Global Entry</span>
                    <kbd className="px-2 py-0.5 bg-antror-850 border border-antror-700 rounded font-mono text-[11px]">Ctrl+Shift+Space</kbd>
                  </div>
                  <div className="p-3 bg-antror-950 rounded-lg border border-antror-800 flex justify-between items-center">
                    <span className="text-antror-300">Send Message</span>
                    <kbd className="px-2 py-0.5 bg-antror-850 border border-antror-700 rounded font-mono text-[11px]">Enter</kbd>
                  </div>
                  <div className="p-3 bg-antror-950 rounded-lg border border-antror-800 flex justify-between items-center">
                    <span className="text-antror-300">New line in Composer</span>
                    <kbd className="px-2 py-0.5 bg-antror-850 border border-antror-700 rounded font-mono text-[11px]">Shift + Enter</kbd>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Section */}
            {activeSection === 'privacy' && (
              <div className="space-y-4 text-xs text-antror-300 leading-relaxed">
                <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-emerald-300">
                  <Shield className="w-5 h-5 mb-2 text-emerald-400" />
                  <div className="font-semibold text-sm mb-1">Local-First & Zero Telemetry</div>
                  <p>All chats, instructions, memories, and project files are saved strictly on your local disk in SQLite. No tracking or telemetry.</p>
                </div>
              </div>
            )}

            {/* About Section */}
            {activeSection === 'about' && (
              <div className="space-y-4 text-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center text-white text-2xl font-bold mx-auto shadow-xl shadow-brand-500/20">
                  A
                </div>
                <div>
                  <h3 className="text-lg font-bold text-antror-100">Antror Desktop</h3>
                  <p className="text-xs text-antror-400 mt-1">Version 1.0.0 (Production Release)</p>
                </div>
                <p className="text-xs text-antror-400 max-w-sm mx-auto">
                  Cross-platform desktop AI assistant replicating the UI/UX and feature set of Claude Desktop with multi-provider background execution.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
