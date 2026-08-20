import { createServer as createHttpServer } from 'node:http';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, type McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

export type ServerFactory = () => McpServer;

interface CliOptions {
  transport: 'stdio' | 'http';
  host: string;
  port: number;
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseOptions(): CliOptions {
  const transport = readArg('--transport') ?? 'stdio';
  if (transport !== 'stdio' && transport !== 'http') {
    throw new Error('--transport must be stdio or http');
  }
  const port = Number(readArg('--port') ?? process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('--port must be an integer from 1 to 65535');
  }
  return { transport, host: readArg('--host') ?? '127.0.0.1', port };
}

export async function runServer(factory: ServerFactory): Promise<void> {
  const options = parseOptions();
  if (options.transport === 'stdio') {
    await serveStdio(factory);
    return;
  }

  const mcpHandler = createMcpHandler(factory);
  const nodeHandler = toNodeHandler(mcpHandler);
  const server = createHttpServer((request, response) => {
    if (request.url !== '/mcp') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Not found. MCP endpoint: /mcp' }));
      return;
    }
    // The SDK adapter intentionally uses a small structural Node interface. Node's own
    // IncomingMessage declares some equivalent fields as `T | undefined` instead of optional.
    void nodeHandler(
      request as unknown as Parameters<typeof nodeHandler>[0],
      response as unknown as Parameters<typeof nodeHandler>[1],
    );
  });
  await new Promise<void>((resolve) => server.listen(options.port, options.host, resolve));
  console.error(`MCP server listening on http://${options.host}:${options.port}/mcp`);
}
