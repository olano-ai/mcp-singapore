import type { McpServer } from '@modelcontextprotocol/server';
import { jsonResult } from '@olano/mcp-core';
import * as z from 'zod/v4';

const seriesSchema = z.array(z.number().finite()).min(1).max(10_000);

interface SeriesStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  standard_deviation: number;
}

function stats(values: number[]): SeriesStats {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const middle = Math.floor(sorted.length / 2);
  return {
    count: values.length,
    min: sorted[0]!,
    max: sorted.at(-1)!,
    mean,
    median: sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2,
    standard_deviation: Math.sqrt(variance),
  };
}

function correlation(left: number[], right: number[]): number | null {
  const count = Math.min(left.length, right.length);
  const x = left.slice(0, count);
  const y = right.slice(0, count);
  const xMean = x.reduce((sum, value) => sum + value, 0) / count;
  const yMean = y.reduce((sum, value) => sum + value, 0) / count;
  const numerator = x.reduce((sum, value, index) => sum + (value - xMean) * (y[index]! - yMean), 0);
  const denominator = Math.sqrt(
    x.reduce((sum, value) => sum + (value - xMean) ** 2, 0) *
      y.reduce((sum, value) => sum + (value - yMean) ** 2, 0),
  );
  return denominator === 0 ? null : numerator / denominator;
}

export function registerAnalyticsTools(server: McpServer): void {
  server.registerTool(
    'analytics_summarize_series',
    {
      title: 'Summarize a numeric series',
      description:
        'Calculate bounded descriptive statistics without sending data to a third party.',
      inputSchema: z.object({ values: seriesSchema }),
    },
    async ({ values }) => jsonResult(stats(values)),
  );

  server.registerTool(
    'analytics_visualize_series',
    {
      title: 'Visualize a numeric series',
      description: 'Create a compact Unicode sparkline and descriptive statistics.',
      inputSchema: z.object({ values: seriesSchema }),
    },
    async ({ values }) => {
      const ticks = '▁▂▃▄▅▆▇█';
      const minimum = Math.min(...values);
      const range = Math.max(...values) - minimum;
      const sparkline = values
        .map((value) => ticks[Math.round(((value - minimum) / (range || 1)) * (ticks.length - 1))])
        .join('');
      return jsonResult({ sparkline, ...stats(values) });
    },
  );

  server.registerTool(
    'analytics_compare_series',
    {
      title: 'Compare numeric series',
      description: 'Compare statistics and mean change for two bounded series.',
      inputSchema: z.object({ left: seriesSchema, right: seriesSchema }),
    },
    async ({ left, right }) => {
      const leftStats = stats(left);
      const rightStats = stats(right);
      return jsonResult({
        left: leftStats,
        right: rightStats,
        mean_change: rightStats.mean - leftStats.mean,
        mean_change_percent:
          leftStats.mean === 0 ? null : ((rightStats.mean - leftStats.mean) / leftStats.mean) * 100,
      });
    },
  );

  server.registerTool(
    'analytics_correlate_series',
    {
      title: 'Correlate numeric series',
      description:
        'Calculate Pearson correlation over aligned values. Correlation does not imply causation.',
      inputSchema: z.object({ left: seriesSchema.min(2), right: seriesSchema.min(2) }),
    },
    async ({ left, right }) =>
      jsonResult({
        aligned_count: Math.min(left.length, right.length),
        pearson_r: correlation(left, right),
        caveat: 'Correlation does not imply causation.',
      }),
  );
}
