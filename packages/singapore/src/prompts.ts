import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

function prompt(text: string) {
  return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
}

export function registerSingaporePrompts(server: McpServer): void {
  server.registerPrompt(
    'research-singapore',
    {
      title: 'Research Singapore',
      description: 'Research a Singapore question with authoritative sources and freshness checks.',
      argsSchema: z.object({ question: z.string().trim().min(2).max(2_000) }),
    },
    ({ question }) =>
      prompt(
        `Research this Singapore question: ${question}\n\nUse the smallest relevant Olano tools, check dataset freshness, preserve units and observation periods, attribute the original government agency, and distinguish observed data from derived analysis.`,
      ),
  );

  server.registerPrompt(
    'research-neighbourhood',
    {
      title: 'Research a Singapore neighbourhood',
      description:
        'Build a location brief using mapping, mobility, amenities, property and weather.',
      argsSchema: z.object({ location: z.string().trim().min(2).max(200) }),
    },
    ({ location }) =>
      prompt(
        `Research ${location}, Singapore. Resolve the place with OneMap, then examine relevant transport, nearby public services, property evidence and current weather. State dates, distances, sources and missing credentials. Do not infer resident attributes from area-level data.`,
      ),
  );

  server.registerPrompt(
    'research-company',
    {
      title: 'Research a Singapore company',
      description: 'Verify a company match and add carefully separated market context.',
      argsSchema: z.object({ company: z.string().trim().min(2).max(200) }),
    },
    ({ company }) =>
      prompt(
        `Research the Singapore company ${company}. Resolve the legal entity or UEN across ACRA shards, make match uncertainty explicit, and add only relevant official sector context. Do not infer ownership, solvency, licensing or trustworthiness from the public record.`,
      ),
  );

  server.registerPrompt(
    'analyze-property',
    {
      title: 'Analyze Singapore property evidence',
      description:
        'Analyze HDB or private-property transactions and an area without giving advice.',
      argsSchema: z.object({ request: z.string().trim().min(2).max(2_000) }),
    },
    ({ request }) =>
      prompt(
        `Analyze this Singapore property request: ${request}\n\nSeparate comparable transaction evidence, location context and calculations. Explain comparability limits. Do not present the result as a valuation, lender approval or personal financial advice.`,
      ),
  );

  server.registerPrompt(
    'analyze-mobility',
    {
      title: 'Analyze Singapore mobility',
      description: 'Investigate buses, rail, traffic, parking, taxis or routes.',
      argsSchema: z.object({ request: z.string().trim().min(2).max(2_000) }),
    },
    ({ request }) =>
      prompt(
        `Analyze this Singapore mobility request: ${request}\n\nUse live LTA or OneMap data where available, identify timestamps and credentials, and distinguish live conditions from static station or route information.`,
      ),
  );
}
