import { execFileSync } from 'node:child_process';
import { resolveSingaporeToolProfile, type SingaporeToolProfile } from '@olano/mcp-singapore';

export const CLAUDE_MARKETPLACE = 'olano';
export const CLAUDE_MARKETPLACE_SOURCE = 'olano-ai/mcp-singapore';

const pluginByProfile: Readonly<Record<SingaporeToolProfile, string>> = Object.freeze({
  all: 'olano-singapore',
  mobility: 'olano-singapore-mobility',
  property: 'olano-singapore-property',
  business: 'olano-singapore-business',
  economy: 'olano-singapore-economy',
  civic: 'olano-singapore-civic',
  finance: 'olano-singapore-finance',
});

export interface ClaudeCommand {
  command: string;
  args: string[];
}

export type ClaudeCommandRunner = (command: string, args: string[]) => string;

export interface ClaudeSetupResult {
  profile: SingaporeToolProfile;
  plugin: string;
  plugin_id: string;
  dry_run: boolean;
  actions: string[];
  commands: ClaudeCommand[];
}

export interface ClaudeDoctorResult {
  profile: SingaporeToolProfile;
  plugin: string;
  plugin_id: string;
  claude_available: boolean;
  claude_version?: string;
  marketplace_configured: boolean;
  plugin_installed: boolean;
  errors: string[];
}

function defaultRunner(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function claudePluginForProfile(value?: string): {
  profile: SingaporeToolProfile;
  plugin: string;
  pluginId: string;
} {
  const profile = resolveSingaporeToolProfile(value);
  const plugin = pluginByProfile[profile];
  return { profile, plugin, pluginId: `${plugin}@${CLAUDE_MARKETPLACE}` };
}

export function claudeSetupCommands(value?: string): ClaudeCommand[] {
  const { pluginId } = claudePluginForProfile(value);
  return [
    {
      command: 'claude',
      args: ['plugin', 'marketplace', 'add', CLAUDE_MARKETPLACE_SOURCE, '--scope', 'user'],
    },
    { command: 'claude', args: ['plugin', 'install', pluginId, '--scope', 'user'] },
  ];
}

function containsMarketplace(output: string): boolean {
  const normalized = output.toLowerCase();
  return (
    normalized.includes(`"name":"${CLAUDE_MARKETPLACE}"`) ||
    normalized.includes(`"name": "${CLAUDE_MARKETPLACE}"`) ||
    normalized.includes(CLAUDE_MARKETPLACE_SOURCE) ||
    normalized.split(/\s+/).includes(CLAUDE_MARKETPLACE)
  );
}

function containsPlugin(output: string, plugin: string, pluginId: string): boolean {
  const normalized = output.toLowerCase();
  return (
    normalized.includes(pluginId) ||
    normalized.includes(`"name":"${plugin}"`) ||
    normalized.includes(`"name": "${plugin}"`)
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function setupClaude(
  value?: string,
  options: { dryRun?: boolean; run?: ClaudeCommandRunner } = {},
): ClaudeSetupResult {
  const { profile, plugin, pluginId } = claudePluginForProfile(value);
  const commands = claudeSetupCommands(profile);
  const marketplaceCommand = commands[0]!;
  const installCommand = commands[1]!;
  if (options.dryRun) {
    return {
      profile,
      plugin,
      plugin_id: pluginId,
      dry_run: true,
      actions: ['Would add or refresh the Olano marketplace.', `Would install ${pluginId}.`],
      commands,
    };
  }

  const run = options.run ?? defaultRunner;
  run('claude', ['--version']);
  const actions: string[] = [];
  let marketplaces = '';
  try {
    marketplaces = run('claude', ['plugin', 'marketplace', 'list', '--json']);
  } catch {
    // Older Claude Code builds may not support JSON listing; the add command remains authoritative.
  }
  if (!containsMarketplace(marketplaces)) {
    run(marketplaceCommand.command, marketplaceCommand.args);
    actions.push('Added the Olano marketplace at user scope.');
  } else {
    run('claude', ['plugin', 'marketplace', 'update', CLAUDE_MARKETPLACE]);
    actions.push('Refreshed the existing Olano marketplace.');
  }

  let plugins = '';
  try {
    plugins = run('claude', ['plugin', 'list', '--json']);
  } catch {
    // Installation below is safe to repeat and returns the CLI's own actionable error if unsupported.
  }
  if (!containsPlugin(plugins, plugin, pluginId)) {
    run(installCommand.command, installCommand.args);
    actions.push(`Installed ${pluginId} at user scope.`);
  } else {
    actions.push(`${pluginId} is already installed.`);
  }

  return { profile, plugin, plugin_id: pluginId, dry_run: false, actions, commands };
}

export function doctorClaude(
  value?: string,
  run: ClaudeCommandRunner = defaultRunner,
): ClaudeDoctorResult {
  const { profile, plugin, pluginId } = claudePluginForProfile(value);
  const result: ClaudeDoctorResult = {
    profile,
    plugin,
    plugin_id: pluginId,
    claude_available: false,
    marketplace_configured: false,
    plugin_installed: false,
    errors: [],
  };

  try {
    result.claude_version = run('claude', ['--version']);
    result.claude_available = true;
  } catch (error) {
    result.errors.push(`Claude Code is unavailable: ${message(error)}`);
    return result;
  }

  try {
    result.marketplace_configured = containsMarketplace(
      run('claude', ['plugin', 'marketplace', 'list', '--json']),
    );
  } catch (error) {
    result.errors.push(`Could not list Claude marketplaces: ${message(error)}`);
  }

  try {
    result.plugin_installed = containsPlugin(
      run('claude', ['plugin', 'list', '--json']),
      plugin,
      pluginId,
    );
  } catch (error) {
    result.errors.push(`Could not list Claude plugins: ${message(error)}`);
  }
  return result;
}
