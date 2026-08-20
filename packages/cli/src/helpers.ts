import {
  SINGAPORE_TOOL_PROFILES,
  toolMatchesSingaporeProfile,
  type SingaporeToolProfile,
} from '@olano/mcp-singapore';

export const profiles = Object.freeze({
  all: Object.freeze({
    description: 'Every tool in the aggregate Singapore MCP server.',
    prefixes: Object.freeze(['*']),
  }),
  ...SINGAPORE_TOOL_PROFILES,
});

export function profileToolNames(
  tools: { name: string }[],
  profile: SingaporeToolProfile,
): string[] {
  return tools
    .filter((tool) => toolMatchesSingaporeProfile(tool.name, profile))
    .map((tool) => tool.name);
}

export interface CliExample {
  category: string;
  prompt: string;
}

export const cliExamples: CliExample[] = [
  { category: 'locations', prompt: 'Find the postal code and coordinates for Marina Bay Sands.' },
  { category: 'locations', prompt: 'Give me a current location brief for Raffles Place.' },
  { category: 'rail', prompt: 'List every station on the Downtown Line in station order.' },
  { category: 'rail', prompt: 'Which MRT or LRT stations are closest to this Singapore address?' },
  { category: 'rail', prompt: 'Show the lines and interchange codes for Paya Lebar station.' },
  { category: 'mobility', prompt: 'When are the next buses arriving at bus stop 01012?' },
  { category: 'mobility', prompt: 'Are there traffic incidents in Singapore right now?' },
  { category: 'mobility', prompt: 'Compare bids received with quota for COE Category A.' },
  { category: 'weather', prompt: 'What is the two-hour weather forecast across Singapore?' },
  { category: 'weather', prompt: 'Show current PSI and PM2.5 readings.' },
  { category: 'property', prompt: 'Summarise recent 4-room HDB resale prices in Ang Mo Kio.' },
  { category: 'property', prompt: 'Compare recent HDB resale evidence for Tampines and Bedok.' },
  { category: 'property', prompt: 'Find public private-property transactions matching Orchard.' },
  {
    category: 'business',
    prompt: 'Search official ACRA public data for companies matching Olano.',
  },
  { category: 'business', prompt: 'Look up this Singapore UEN in the public ACRA datasets.' },
  { category: 'business', prompt: 'How many net new business entities were formed each month?' },
  { category: 'economy', prompt: 'What is the latest year-on-year change in All Items CPI?' },
  { category: 'economy', prompt: 'How has manufacturing employment changed over five years?' },
  { category: 'economy', prompt: 'Show the latest year-on-year change in retail sales volume.' },
  { category: 'economy', prompt: 'Give me a GDP, CPI, employment and retail market snapshot.' },
  { category: 'finance', prompt: 'Find recent official MAS SGD exchange-rate observations.' },
  { category: 'education', prompt: 'Find official MOE schools matching Tampines.' },
  { category: 'education', prompt: 'Find childcare and kindergarten centres in Punggol.' },
  { category: 'health', prompt: 'Show current dengue clusters from the official NEA dataset.' },
  { category: 'health', prompt: 'Search weekly infectious-disease records for dengue.' },
  { category: 'population', prompt: 'Find recent official Singapore population indicators.' },
  { category: 'tourism', prompt: 'Compare visitor arrivals from Singapore’s top source markets.' },
  { category: 'civic', prompt: 'Find government hawker centres matching Bedok.' },
  { category: 'civic', prompt: 'Show recorded crime data matching scams and its coverage period.' },
  { category: 'analytics', prompt: 'Align two time series and compare only overlapping periods.' },
  {
    category: 'analytics',
    prompt: 'Create chart-ready JSON and a compact chart for these observations.',
  },
];

interface ToolShape {
  name: string;
  inputSchema?: unknown;
}

function schemaProperties(inputSchema: unknown): Record<string, unknown> {
  if (!inputSchema || typeof inputSchema !== 'object' || Array.isArray(inputSchema)) return {};
  const properties = (inputSchema as { properties?: unknown }).properties;
  return properties && typeof properties === 'object' && !Array.isArray(properties)
    ? (properties as Record<string, unknown>)
    : {};
}

export function askQuestion(args: string[]): string {
  const question = args.join(' ').trim();
  if (!question) throw new Error('Usage: olano-sg ask <natural-language question>');
  return question;
}

export function selectAskTool(tools: ToolShape[]): ToolShape {
  const selected =
    tools.find((tool) => tool.name === 'sg_ask') ??
    tools.find((tool) => tool.name === 'singapore_ask');
  if (!selected) throw new Error('This server does not expose sg_ask or singapore_ask.');
  return selected;
}

export function askArguments(tool: ToolShape, question: string): Record<string, string> {
  const properties = schemaProperties(tool.inputSchema);
  const key =
    ['question', 'message', 'query'].find((candidate) => candidate in properties) ?? 'question';
  return { [key]: question };
}

export function renderExamples(category?: string): string {
  const normalized = category?.trim().toLowerCase();
  const matches = normalized
    ? cliExamples.filter((example) => example.category === normalized)
    : cliExamples;
  if (!matches.length) {
    const categories = [...new Set(cliExamples.map((example) => example.category))].sort();
    throw new Error(`Unknown example category. Choose one of: ${categories.join(', ')}`);
  }
  const grouped = new Map<string, string[]>();
  for (const example of matches) {
    const prompts = grouped.get(example.category) ?? [];
    prompts.push(example.prompt);
    grouped.set(example.category, prompts);
  }
  return [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([name, prompts]) =>
        `${name.toUpperCase()}\n${prompts.map((prompt) => `  - ${prompt}`).join('\n')}`,
    )
    .join('\n\n');
}
