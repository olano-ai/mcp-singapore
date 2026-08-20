#!/usr/bin/env node
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createSingaporeServer, resolveSingaporeToolProfile } from '@olano/mcp-singapore';
import {
  askArguments,
  askQuestion,
  profileToolNames,
  renderExamples,
  selectAskTool,
} from './helpers.js';
import { doctorClaude, setupClaude } from './claude.js';

async function main(): Promise<void> {
  const [command = 'help', ...args] = process.argv.slice(2);

  if (command === 'setup' && args[0] === 'claude') {
    const profile = args.find((argument) => !argument.startsWith('--') && argument !== 'claude');
    const result = setupClaude(profile, { dryRun: args.includes('--dry-run') });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === 'doctor' && args[0] === 'claude') {
    const profile = args.find((argument) => !argument.startsWith('--') && argument !== 'claude');
    const result = doctorClaude(profile);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.claude_available || !result.marketplace_configured || !result.plugin_installed) {
      process.exitCode = 1;
    }
    return;
  }

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSingaporeServer();
  const client = new Client({ name: '@olano/sg-cli', version: '0.3.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    if (command === 'list' || command === 'search') {
      const query = command === 'search' ? args.join(' ').toLowerCase() : '';
      const { tools } = await client.listTools();
      const matches = tools.filter((tool) =>
        `${tool.name} ${tool.title ?? ''} ${tool.description ?? ''}`.toLowerCase().includes(query),
      );
      process.stdout.write(
        `${matches.map((tool) => `${tool.name}\t${tool.description ?? ''}`).join('\n')}\n`,
      );
      return;
    }

    if (command === 'ask' || command === 'query') {
      const question = askQuestion(args);
      const { tools } = await client.listTools();
      const askTool = selectAskTool(tools);
      const result = await client.callTool({
        name: askTool.name,
        arguments: askArguments(askTool, question),
      });
      process.stdout.write(
        `${JSON.stringify(result.structuredContent ?? result.content, null, 2)}\n`,
      );
      if (result.isError) process.exitCode = 1;
      return;
    }

    if (command === 'datasets') {
      const category = args.join(' ').trim();
      const { tools } = await client.listTools();
      const catalogue = tools.find((tool) => tool.name === 'singapore_catalog_list');
      const fallback = tools.find((tool) => tool.name === 'sg_list_datasets');
      const selected = catalogue ?? fallback;
      if (!selected) throw new Error('This server does not expose a dataset catalogue tool.');
      const result = await client.callTool({
        name: selected.name,
        arguments: category && selected.name === 'singapore_catalog_list' ? { category } : {},
      });
      process.stdout.write(
        `${JSON.stringify(result.structuredContent ?? result.content, null, 2)}\n`,
      );
      if (result.isError) process.exitCode = 1;
      return;
    }

    if (command === 'examples') {
      process.stdout.write(`${renderExamples(args[0])}\n`);
      return;
    }

    if (command === 'prompts') {
      const { prompts } = await client.listPrompts();
      process.stdout.write(
        `${prompts
          .map((item) => `${item.name}\t${item.title ?? ''}\t${item.description ?? ''}`)
          .join('\n')}\n`,
      );
      return;
    }

    if (command === 'profiles') {
      const result = await client.callTool({
        name: 'singapore_tool_profiles',
        arguments: {},
      });
      process.stdout.write(
        `${JSON.stringify(result.structuredContent ?? result.content, null, 2)}\n`,
      );
      if (result.isError) process.exitCode = 1;
      return;
    }

    if (command === 'profile') {
      if (!args[0]) throw new Error('Usage: olano-sg profile <name>');
      const selected = resolveSingaporeToolProfile(args[0]);
      const { tools } = await client.listTools();
      const names = profileToolNames(tools, selected);
      process.stdout.write(`${names.join('\n')}\n`);
      return;
    }

    if (command === 'tool') {
      const [name, rawArguments = '{}'] = args;
      if (!name) throw new Error('Usage: olano-sg tool <tool-name> [JSON-arguments]');
      const parsed = JSON.parse(rawArguments) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('Tool arguments must be a JSON object.');
      const result = await client.callTool({ name, arguments: parsed as Record<string, unknown> });
      process.stdout.write(
        `${JSON.stringify(result.structuredContent ?? result.content, null, 2)}\n`,
      );
      if (result.isError) process.exitCode = 1;
      return;
    }

    process.stdout.write(
      `Olano Singapore CLI\n\nCommands:\n  list\n  search <text>\n  ask <natural-language question>\n  query <natural-language question>  Alias for ask\n  datasets [category]\n  examples [category]\n  prompts\n  profiles\n  profile <name>\n  tool <name> [JSON]\n  setup claude [profile] [--dry-run]\n  doctor claude [profile]\n`,
    );
  } finally {
    await client.close();
    await server.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
