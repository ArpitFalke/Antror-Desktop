import { describe, it, expect } from 'vitest';
import { PermissionEngine } from '../src/main/permissions/engine';

describe('PermissionEngine', () => {
  it('assesses critical risk for destructive terminal commands', () => {
    const engine = new PermissionEngine('ask_every_time');
    const risk = engine.assessRisk('terminal_execute', { command: 'rm -rf /' });
    expect(risk).toBe('critical');
  });

  it('assesses low risk for read-only tools', () => {
    const engine = new PermissionEngine('ask_every_time');
    const risk = engine.assessRisk('file_read', { path: 'README.md' });
    expect(risk).toBe('low');
  });

  it('auto-approves in full_auto mode for non-critical commands', async () => {
    const engine = new PermissionEngine('full_auto');
    const allowed = await engine.requestPermission(
      'run-1',
      'chat-1',
      'file_write',
      { path: 'test.txt', content: 'hello' }
    );
    expect(allowed).toBe(true);
  });

  it('denies write actions in plan_mode', async () => {
    const engine = new PermissionEngine('plan_mode');
    const allowed = await engine.requestPermission(
      'run-1',
      'chat-1',
      'file_write',
      { path: 'test.txt', content: 'hello' }
    );
    expect(allowed).toBe(false);
  });

  it('allows read actions in plan_mode', async () => {
    const engine = new PermissionEngine('plan_mode');
    const allowed = await engine.requestPermission(
      'run-1',
      'chat-1',
      'file_read',
      { path: 'test.txt' }
    );
    expect(allowed).toBe(true);
  });
});
