import {
  PermissionMode,
  PermissionRequest,
  PermissionDecision,
  PermissionRiskLevel
} from '../../shared/types';

export class PermissionEngine {
  private mode: PermissionMode = 'ask_every_time';
  private projectRules: Map<string, Set<string>> = new Map(); // projectId -> Set of allowed tools/patterns
  private pendingRequests: Map<string, {
    request: PermissionRequest;
    resolve: (decision: PermissionDecision) => void;
  }> = new Map();

  constructor(defaultMode: PermissionMode = 'ask_every_time') {
    this.mode = defaultMode;
  }

  public setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  public getMode(): PermissionMode {
    return this.mode;
  }

  public assessRisk(toolName: string, params: Record<string, any>): PermissionRiskLevel {
    // Dangerous terminal commands or system modifications
    if (toolName === 'terminal_execute' || toolName === 'bash') {
      const cmd = (params.command || '').toLowerCase();
      if (
        cmd.includes('rm -rf') ||
        cmd.includes('format') ||
        cmd.includes('del /f') ||
        cmd.includes('mkfs') ||
        cmd.includes('dd if=') ||
        cmd.includes(':(){ :|:& };:')
      ) {
        return 'critical';
      }
      return 'high';
    }

    // File writing / deletion
    if (toolName === 'file_write' || toolName === 'file_edit' || toolName === 'file_delete') {
      return 'medium';
    }

    // Read-only filesystem, web, memory, search
    return 'low';
  }

  public async requestPermission(
    runId: string,
    chatId: string,
    toolName: string,
    params: Record<string, any>,
    projectId?: string,
    onPromptNeeded?: (req: PermissionRequest) => void
  ): Promise<boolean> {
    const risk = this.assessRisk(toolName, params);

    // 1. Full auto: allow everything except critical destructive commands
    if (this.mode === 'full_auto' && risk !== 'critical') {
      return true;
    }

    // 2. Plan mode: allow only low risk (read-only)
    if (this.mode === 'plan_mode') {
      if (risk === 'low') return true;
      return false; // Denied by plan mode
    }

    // 3. Auto-approve edits: allow low and medium (file edits), prompt on high/critical
    if (this.mode === 'auto_approve_edits') {
      if (risk === 'low' || risk === 'medium') return true;
    }

    // 4. Check project-level remembered rules
    if (projectId) {
      const allowed = this.projectRules.get(projectId);
      if (allowed?.has(toolName) && risk !== 'critical') {
        return true;
      }
    }

    // Otherwise, create a pending permission request and prompt UI
    const requestId = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const request: PermissionRequest = {
      id: requestId,
      runId,
      chatId,
      toolName,
      description: `Agent requested to run "${toolName}"`,
      params,
      riskLevel: risk,
      timestamp: Date.now()
    };

    return new Promise<boolean>((resolve) => {
      this.pendingRequests.set(requestId, {
        request,
        resolve: (decision: PermissionDecision) => {
          this.pendingRequests.delete(requestId);
          if (decision === 'allow_always_project' && projectId) {
            if (!this.projectRules.has(projectId)) {
              this.projectRules.set(projectId, new Set());
            }
            this.projectRules.get(projectId)!.add(toolName);
            resolve(true);
          } else if (decision === 'allow_once') {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });

      if (onPromptNeeded) {
        onPromptNeeded(request);
      }
    });
  }

  public respondPermission(requestId: string, decision: PermissionDecision): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      pending.resolve(decision);
    }
  }

  public getPendingRequest(requestId: string): PermissionRequest | undefined {
    return this.pendingRequests.get(requestId)?.request;
  }
}
