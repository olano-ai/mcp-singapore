import type { McpServer } from '@modelcontextprotocol/server';
import { jsonResult } from '@olano/mcp-core';
import * as z from 'zod/v4';
import {
  capabilityCoverageRegistry,
  nativeCompatibilityAliases,
  validateCompatibilityRegistry,
  type CompatibilityCapability,
} from './capabilities.js';
import { promptCategories, routeSingaporeQuestion, searchPromptExamples } from './prompts.js';
import { registerSemanticInsightTools } from './semantic.js';
import {
  alignSeries,
  summarizeValues,
  visualizeSeries,
  type Aggregation,
  type Frequency,
  type Observation,
} from './series.js';

const observationSchema = z.object({
  period: z.string().trim().min(1).max(40),
  value: z.number().finite(),
});
const seriesSchema = z.array(observationSchema).min(1).max(10_000);
const frequencySchema = z.enum(['auto', 'monthly', 'quarterly', 'annual']).default('auto');
const aggregationSchema = z.enum(['mean', 'sum', 'latest']).default('mean');

function registerPromptTools(server: McpServer): void {
  server.registerTool(
    'singapore_prompt_categories',
    {
      title: 'List Singapore MCP prompt categories',
      description: 'List discoverable example-prompt categories and their example counts.',
      inputSchema: z.object({}),
    },
    async () =>
      jsonResult({
        categories: promptCategories(),
        source: 'Olano Singapore MCP capability catalogue',
        freshness: 'this package release',
      }),
  );

  server.registerTool(
    'singapore_prompt_examples',
    {
      title: 'Discover Singapore MCP prompt examples',
      description:
        'Find realistic user prompts by category, keyword or canonical tool name. This is discovery, not execution.',
      inputSchema: z.object({
        category: z.string().trim().min(1).max(50).optional(),
        search: z.string().trim().min(1).max(200).optional(),
        tool: z.string().trim().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    },
    async (input) =>
      jsonResult({
        filters: input,
        examples: searchPromptExamples({
          ...(input.category ? { category: input.category } : {}),
          ...(input.search ? { search: input.search } : {}),
          ...(input.tool ? { tool: input.tool } : {}),
          limit: input.limit,
        }),
        source: 'Olano Singapore MCP capability catalogue',
        freshness: 'this package release',
      }),
  );

  server.registerTool(
    'singapore_prompt_for_tool',
    {
      title: 'Get example prompts for an MCP tool',
      description:
        'Find user-facing query examples that demonstrate a canonical Singapore MCP tool.',
      inputSchema: z.object({
        tool: z.string().trim().min(1).max(100),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    },
    async ({ tool, limit }) =>
      jsonResult({
        tool,
        examples: searchPromptExamples({ tool, limit }),
        source: 'Olano Singapore MCP capability catalogue',
        freshness: 'this package release',
      }),
  );

  const askSchema = z.object({ question: z.string().trim().min(2).max(500) });
  const askHandler = async ({ question }: { question: string }) =>
    jsonResult({
      ...routeSingaporeQuestion(question),
      safety:
        'This router recommends deterministic tools and arguments but does not execute them. Review missing arguments before calling a tool.',
      source: 'Olano Singapore MCP capability catalogue',
      freshness: 'this package release',
    });
  server.registerTool(
    'singapore_ask',
    {
      title: 'Route a natural-language Singapore data question',
      description:
        'Deterministically recommend canonical tool calls for a question without arbitrary execution or an external language-model call.',
      inputSchema: askSchema,
    },
    askHandler,
  );
  server.registerTool(
    'sg_ask',
    {
      title: 'Compatibility: route a Singapore data question',
      description:
        'Compatibility alias for singapore_ask. Returns recommendations; never executes arbitrary tools.',
      inputSchema: askSchema,
    },
    askHandler,
  );
}

function registerSeriesTools(server: McpServer): void {
  const visualizeSchema = z.object({
    observations: seriesSchema,
    title: z.string().trim().max(120).optional(),
    unit: z.string().trim().max(40).optional(),
    maxPoints: z.number().int().min(2).max(200).default(60),
  });
  const visualizeHandler = async ({
    observations,
    title,
    unit,
    maxPoints,
  }: {
    observations: Observation[];
    title?: string | undefined;
    unit?: string | undefined;
    maxPoints: number;
  }) =>
    jsonResult({
      ...visualizeSeries(observations, {
        ...(title ? { title } : {}),
        ...(unit ? { unit } : {}),
        maxPoints,
      }),
      source: 'caller-provided observations',
      freshness: 'defined by input observations',
      retrieval: 'local deterministic calculation',
    });
  server.registerTool(
    'insights_visualize_series',
    {
      title: 'Visualise a labelled time series',
      description:
        'Create a sparkline, ASCII chart, statistics, point changes and chart-ready JSON from labelled observations.',
      inputSchema: visualizeSchema,
    },
    visualizeHandler,
  );
  server.registerTool(
    'sg_visualize',
    {
      title: 'Compatibility: visualise a labelled time series',
      description: 'Compatibility alias for the richer local Olano series visualiser.',
      inputSchema: visualizeSchema,
    },
    visualizeHandler,
  );

  const alignSchema = z.object({
    left: seriesSchema,
    right: seriesSchema,
    frequency: frequencySchema,
    aggregation: aggregationSchema,
  });
  server.registerTool(
    'insights_align_series',
    {
      title: 'Align two time series by calendar period',
      description:
        'Normalize common monthly, quarterly and annual period formats to the safest shared frequency and align overlapping observations.',
      inputSchema: alignSchema,
    },
    async ({ left, right, frequency, aggregation }) =>
      jsonResult({
        ...alignSeries(left, right, frequency as Frequency | 'auto', aggregation as Aggregation),
        source: 'caller-provided observations',
        freshness: 'defined by input observations',
        retrieval: 'local deterministic calculation',
      }),
  );

  const compareSchema = z.object({
    left: z.object({
      name: z.string().trim().min(1).max(100).default('Left series'),
      unit: z.string().trim().max(40).optional(),
      observations: seriesSchema,
    }),
    right: z.object({
      name: z.string().trim().min(1).max(100).default('Right series'),
      unit: z.string().trim().max(40).optional(),
      observations: seriesSchema,
    }),
    frequency: frequencySchema,
    aggregation: aggregationSchema,
  });
  const compareHandler = async ({
    left,
    right,
    frequency,
    aggregation,
  }: {
    left: { name: string; unit?: string | undefined; observations: Observation[] };
    right: { name: string; unit?: string | undefined; observations: Observation[] };
    frequency: Frequency | 'auto';
    aggregation: Aggregation;
  }) => {
    const alignment = alignSeries(left.observations, right.observations, frequency, aggregation);
    return jsonResult({
      series: {
        left: {
          name: left.name,
          unit: left.unit ?? null,
          statistics: summarizeValues(left.observations.map((point) => point.value)),
        },
        right: {
          name: right.name,
          unit: right.unit ?? null,
          statistics: summarizeValues(right.observations.map((point) => point.value)),
        },
      },
      alignment,
      interpretation: {
        pearson_r: alignment.pearson_r,
        warning:
          left.unit && right.unit && left.unit !== right.unit
            ? 'The series use different units. Differences are shown mathematically but may not be substantively comparable.'
            : 'Check definitions and revisions before interpreting numerical differences.',
      },
      source: 'caller-provided observations',
      freshness: 'defined by input observations',
      retrieval: 'local deterministic calculation',
    });
  };
  server.registerTool(
    'insights_compare_series',
    {
      title: 'Compare period-aligned time series',
      description:
        'Automatically align different calendar granularities, calculate differences, descriptive statistics and Pearson correlation.',
      inputSchema: compareSchema,
    },
    compareHandler,
  );
  server.registerTool(
    'sg_cross_dataset',
    {
      title: 'Compatibility: compare aligned series',
      description:
        'Compatibility alias for explicit period-aware Olano comparison. Supply the official observations to compare.',
      inputSchema: compareSchema,
    },
    compareHandler,
  );
}

function registerCapabilityTools(server: McpServer): void {
  validateCompatibilityRegistry();
  server.registerTool(
    'singapore_capability_registry',
    {
      title: 'List Singapore MCP capability mappings',
      description:
        'Return the exhaustive machine-readable mapping for the 87 audited sg_* compatibility capabilities, including constraints and sources.',
      inputSchema: z.object({
        mode: z.enum(['native', 'delegated', 'constrained']).optional(),
        search: z.string().trim().min(1).max(120).optional(),
      }),
    },
    async ({ mode, search }) => {
      const query = search?.toLowerCase();
      const capabilities = capabilityCoverageRegistry
        .filter((item) => !mode || item.mode === mode)
        .filter(
          (item) =>
            !query ||
            `${item.compatibility_tool} ${item.olano_tool} ${item.source} ${item.note}`
              .toLowerCase()
              .includes(query),
        );
      return jsonResult({
        audited_total: capabilityCoverageRegistry.length,
        returned: capabilities.length,
        capabilities,
        source: 'Olano compatibility audit registry',
        freshness: 'this package release',
      });
    },
  );
  server.registerTool(
    'singapore_capability_check',
    {
      title: 'Check a Singapore MCP compatibility capability',
      description: 'Resolve an exact sg_* compatibility name or canonical Olano tool mapping.',
      inputSchema: z.object({ tool: z.string().trim().min(1).max(100) }),
    },
    async ({ tool }) => {
      const capability = capabilityCoverageRegistry.find(
        (item) => item.compatibility_tool === tool || item.olano_tool === tool,
      );
      return jsonResult({
        found: Boolean(capability),
        capability: capability ?? null,
        source: 'Olano compatibility audit registry',
        freshness: 'this package release',
      });
    },
  );
}

function registerTransparentCompatibilityAliases(server: McpServer): void {
  const inputSchema = z.object({}).catchall(z.unknown());
  for (const capability of capabilityCoverageRegistry) {
    if (nativeCompatibilityAliases.has(capability.compatibility_tool)) continue;
    server.registerTool(
      capability.compatibility_tool,
      {
        title: `Compatibility route: ${capability.compatibility_tool}`,
        description: `${capability.note} Canonical Olano tool: ${capability.olano_tool}.`,
        inputSchema,
      },
      async (arguments_) => compatibilityRoute(capability, arguments_),
    );
  }
}

function compatibilityRoute(
  capability: CompatibilityCapability,
  arguments_: Record<string, unknown>,
) {
  return jsonResult({
    compatibility_tool: capability.compatibility_tool,
    status: capability.mode,
    canonical_tool: capability.olano_tool,
    suggested_arguments: arguments_,
    executed: false,
    reason:
      'This compatibility entry routes to the canonical namespaced Olano tool so source, schema, limits and credential requirements remain explicit.',
    source: capability.source,
    freshness: capability.freshness,
    retrieval: capability.retrieval,
    note: capability.note,
  });
}

export function registerSingaporeInsightTools(server: McpServer): void {
  registerPromptTools(server);
  registerSeriesTools(server);
  registerCapabilityTools(server);
  registerSemanticInsightTools(server);
  registerTransparentCompatibilityAliases(server);
}

export {
  alignSeries,
  capabilityCoverageRegistry,
  nativeCompatibilityAliases,
  promptCategories,
  routeSingaporeQuestion,
  searchPromptExamples,
  validateCompatibilityRegistry,
  visualizeSeries,
};
export {
  coeMetric,
  calculateTaxMix,
  dataGovRows,
  filterCatalogueDatasets,
  formationNet,
  fxQuote,
  haversineMetres,
  hdbSelectionIsComplete,
  periodGrowth,
  rankNearbyFeatures,
  rankWideRows,
  rankVisitorSources,
  summarizeDiseaseList,
  summarizeDiseaseTrend,
  summarizeEcdaVacancies,
  summarizeHdbResales,
  summarizeUraNewSales,
  yearOverYear,
} from './semantic.js';
export { numericValue, observationsFromWideRow, parsePeriod } from './series.js';
export type { CompatibilityCapability, Observation };
