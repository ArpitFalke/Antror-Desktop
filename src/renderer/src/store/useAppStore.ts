import { create } from 'zustand';
import {
  ChatSession,
  ChatMessage,
  Artifact,
  Project,
  AppSettings,
  ProviderConfig,
  MCPServerConfig,
  PermissionRequest,
  ActiveRun,
  PermissionDecision,
  LLMProviderId
} from '../../../../shared/types';

export type RightPanelTab = 'artifacts' | 'terminal' | 'browser' | 'projects';

interface AppState {
  // Navigation & Sessions
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  activeRuns: Map<string, ActiveRun>; // chatId -> ActiveRun
  searchQuery: string;
  searchResults: { chatId: string; title: string; snippet: string; messageId: string }[];
  isSearching: boolean;

  // Right Panel
  isRightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  currentArtifact: Artifact | null;
  artifactsList: Artifact[];

  // Modals
  isSettingsOpen: boolean;
  settingsSection: string;
  isCommandPaletteOpen: boolean;
  pendingPermission: PermissionRequest | null;

  // Settings & Config
  settings: AppSettings | null;
  providers: ProviderConfig[];
  projects: Project[];
  currentProject: Project | null;
  mcpServers: MCPServerConfig[];

  // Actions
  init: () => Promise<void>;
  loadSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  createSession: (provider?: string, model?: string) => Promise<string>;
  deleteSession: (sessionId: string) => Promise<void>;
  sendMessage: (text: string, images?: string[]) => Promise<void>;
  stopCurrentRun: () => Promise<void>;
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleRightPanel: (open?: boolean) => void;
  selectArtifact: (artifact: Artifact | null) => void;
  openSettings: (section?: string) => void;
  closeSettings: () => void;
  toggleCommandPalette: (open?: boolean) => void;
  respondPermission: (decision: PermissionDecision) => Promise<void>;
  performSearch: (query: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshMCPServers: () => Promise<void>;
  refreshProviders: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  activeRuns: new Map(),
  searchQuery: '',
  searchResults: [],
  isSearching: false,

  isRightPanelOpen: false,
  rightPanelTab: 'artifacts',
  currentArtifact: null,
  artifactsList: [],

  isSettingsOpen: false,
  settingsSection: 'providers',
  isCommandPaletteOpen: false,
  pendingPermission: null,

  settings: null,
  providers: [],
  projects: [],
  currentProject: null,
  mcpServers: [],

  init: async () => {
    if (!window.antrorAPI) return;

    try {
      const [settings, sessions, providers, projects, mcpServers, activeRunsList] = await Promise.all([
        window.antrorAPI.getSettings(),
        window.antrorAPI.getSessions(),
        window.antrorAPI.getProviders(),
        window.antrorAPI.getProjects(),
        window.antrorAPI.getMCPServers(),
        window.antrorAPI.getActiveRuns()
      ]);

      const runsMap = new Map<string, ActiveRun>();
      for (const r of activeRunsList) {
        runsMap.set(r.chatId, r);
      }

      set({
        settings,
        sessions,
        providers,
        projects,
        mcpServers,
        activeRuns: runsMap
      });

      // Select first session or create initial session if none
      if (sessions.length > 0) {
        await get().selectSession(sessions[0].id);
      } else {
        await get().createSession();
      }

      // Subscribe to real-time Run events from main process!
      window.antrorAPI.onRunEvent((event) => {
        const { type, chatId, payload } = event;
        const currentRuns = new Map(get().activeRuns);

        if (type === 'run_started') {
          currentRuns.set(chatId, payload.run);
          set({ activeRuns: currentRuns });
        } else if (type === 'permission_required') {
          set({ pendingPermission: payload.request });
        } else if (type === 'run_completed' || type === 'run_stopped' || type === 'run_error') {
          currentRuns.delete(chatId);
          set({ activeRuns: currentRuns, pendingPermission: null });
          // If viewing this chat, refresh messages from DB to get final blocks
          if (get().currentSessionId === chatId) {
            window.antrorAPI.getMessages(chatId).then(messages => set({ messages }));
            window.antrorAPI.getArtifacts(chatId).then(artifactsList => {
              set({ artifactsList });
              if (artifactsList.length > 0 && !get().currentArtifact) {
                set({ currentArtifact: artifactsList[0], isRightPanelOpen: true });
              }
            });
          }
        } else if (type === 'artifact_created') {
          const arts = [payload.artifact, ...get().artifactsList];
          set({
            artifactsList: arts,
            currentArtifact: payload.artifact,
            isRightPanelOpen: true,
            rightPanelTab: 'artifacts'
          });
        }

        // Live stream update for active view
        if (get().currentSessionId === chatId) {
          if (type === 'text_delta' || type === 'thinking_delta' || type === 'tool_call_start' || type === 'tool_call_ready' || type === 'tool_call_running' || type === 'tool_call_completed') {
            // Debounced or live refresh from DB
            window.antrorAPI.getMessages(chatId).then(messages => set({ messages }));
          }
        }
      });
    } catch (e) {
      console.error('Failed to initialize app state:', e);
    }
  },

  loadSessions: async () => {
    if (!window.antrorAPI) return;
    const sessions = await window.antrorAPI.getSessions();
    set({ sessions });
  },

  selectSession: async (sessionId: string) => {
    if (!window.antrorAPI) return;
    set({ currentSessionId: sessionId });
    const [messages, artifactsList] = await Promise.all([
      window.antrorAPI.getMessages(sessionId),
      window.antrorAPI.getArtifacts(sessionId)
    ]);
    set({
      messages,
      artifactsList,
      currentArtifact: artifactsList[0] || null
    });
  },

  createSession: async (provider?: string, model?: string) => {
    if (!window.antrorAPI) return '';
    const newSession = await window.antrorAPI.createSession({
      provider: provider || 'anthropic',
      model: model || 'claude-3-7-sonnet-20250219'
    });
    const sessions = [newSession, ...get().sessions];
    set({ sessions });
    await get().selectSession(newSession.id);
    return newSession.id;
  },

  deleteSession: async (sessionId: string) => {
    if (!window.antrorAPI) return;
    await window.antrorAPI.deleteSession(sessionId);
    const sessions = get().sessions.filter(s => s.id !== sessionId);
    set({ sessions });
    if (get().currentSessionId === sessionId) {
      if (sessions.length > 0) {
        await get().selectSession(sessions[0].id);
      } else {
        await get().createSession();
      }
    }
  },

  sendMessage: async (text: string, images?: string[]) => {
    const chatId = get().currentSessionId;
    if (!chatId || !window.antrorAPI) return;

    // Immediately trigger startRun on main process RunManager
    await window.antrorAPI.startRun(chatId, { text, images });
    // Reload messages to show user prompt and empty assistant placeholder
    const messages = await window.antrorAPI.getMessages(chatId);
    set({ messages });
  },

  stopCurrentRun: async () => {
    const chatId = get().currentSessionId;
    if (!chatId || !window.antrorAPI) return;
    await window.antrorAPI.stopRun(chatId);
  },

  setRightPanelTab: (tab: RightPanelTab) => {
    set({ rightPanelTab: tab, isRightPanelOpen: true });
  },

  toggleRightPanel: (open?: boolean) => {
    set((state) => ({ isRightPanelOpen: open !== undefined ? open : !state.isRightPanelOpen }));
  },

  selectArtifact: (artifact: Artifact | null) => {
    set({
      currentArtifact: artifact,
      isRightPanelOpen: true,
      rightPanelTab: 'artifacts'
    });
  },

  openSettings: (section: string = 'providers') => {
    set({ isSettingsOpen: true, settingsSection: section });
  },

  closeSettings: () => {
    set({ isSettingsOpen: false });
  },

  toggleCommandPalette: (open?: boolean) => {
    set((state) => ({ isCommandPaletteOpen: open !== undefined ? open : !state.isCommandPaletteOpen }));
  },

  respondPermission: async (decision: PermissionDecision) => {
    const pending = get().pendingPermission;
    if (!pending || !window.antrorAPI) return;
    await window.antrorAPI.respondPermission(pending.id, decision);
    set({ pendingPermission: null });
  },

  performSearch: async (query: string) => {
    if (!window.antrorAPI || !query.trim()) {
      set({ searchQuery: query, searchResults: [], isSearching: false });
      return;
    }
    set({ searchQuery: query, isSearching: true });
    const results = await window.antrorAPI.searchChats(query);
    set({ searchResults: results, isSearching: false });
  },

  refreshProjects: async () => {
    if (!window.antrorAPI) return;
    const projects = await window.antrorAPI.getProjects();
    set({ projects });
  },

  refreshMCPServers: async () => {
    if (!window.antrorAPI) return;
    const mcpServers = await window.antrorAPI.getMCPServers();
    set({ mcpServers });
  },

  refreshProviders: async () => {
    if (!window.antrorAPI) return;
    const providers = await window.antrorAPI.getProviders();
    set({ providers });
  }
}));
