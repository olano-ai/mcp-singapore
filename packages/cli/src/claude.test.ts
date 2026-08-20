import { describe, expect, it, vi } from 'vitest';
import {
  claudePluginForProfile,
  claudeSetupCommands,
  doctorClaude,
  setupClaude,
} from './claude.js';

describe('Claude Code onboarding', () => {
  it('maps aggregate profiles to stable plugin identifiers', () => {
    expect(claudePluginForProfile().pluginId).toBe('olano-singapore@olano');
    expect(claudePluginForProfile('property').pluginId).toBe('olano-singapore-property@olano');
    expect(() => claudePluginForProfile('unknown')).toThrow('Unknown Singapore tool profile');
  });

  it('produces exact non-interactive Claude Code commands', () => {
    expect(claudeSetupCommands('mobility')).toEqual([
      {
        command: 'claude',
        args: ['plugin', 'marketplace', 'add', 'olano-ai/mcp-singapore', '--scope', 'user'],
      },
      {
        command: 'claude',
        args: ['plugin', 'install', 'olano-singapore-mobility@olano', '--scope', 'user'],
      },
    ]);
  });

  it('supports mutation-free setup previews', () => {
    const run = vi.fn();
    const result = setupClaude('finance', { dryRun: true, run });
    expect(result.dry_run).toBe(true);
    expect(result.plugin_id).toBe('olano-singapore-finance@olano');
    expect(run).not.toHaveBeenCalled();
  });

  it('adds and installs missing Claude components', () => {
    const run = vi.fn((_command: string, args: string[]) => {
      if (args.join(' ') === 'plugin marketplace list --json') return '[]';
      if (args.join(' ') === 'plugin list --json') return '[]';
      return 'ok';
    });
    const result = setupClaude('civic', { run });
    expect(result.actions).toEqual([
      'Added the Olano marketplace at user scope.',
      'Installed olano-singapore-civic@olano at user scope.',
    ]);
    expect(run).toHaveBeenCalledWith('claude', [
      'plugin',
      'install',
      'olano-singapore-civic@olano',
      '--scope',
      'user',
    ]);
  });

  it('reports marketplace and plugin status without changing either', () => {
    const run = vi.fn((_command: string, args: string[]) => {
      const joined = args.join(' ');
      if (joined === '--version') return '2.1.0';
      if (joined === 'plugin marketplace list --json') {
        return '[{"name":"olano","source":"olano-ai/mcp-singapore"}]';
      }
      return '[{"name":"olano-singapore-property","marketplace":"olano"}]';
    });
    expect(doctorClaude('property', run)).toMatchObject({
      claude_available: true,
      claude_version: '2.1.0',
      marketplace_configured: true,
      plugin_installed: true,
      errors: [],
    });
    expect(run).toHaveBeenCalledTimes(3);
  });
});
