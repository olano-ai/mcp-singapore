export type Frequency = 'monthly' | 'quarterly' | 'annual';
export type Aggregation = 'mean' | 'sum' | 'latest';

export interface Observation {
  period: string;
  value: number;
}

interface ParsedPeriod {
  year: number;
  month: number | null;
  quarter: number | null;
  frequency: Frequency;
  ordinal: number;
}

export interface AlignedPoint {
  period: string;
  left: number;
  right: number;
  difference: number;
  difference_percent: number | null;
}

export interface AlignmentResult {
  frequency: Frequency;
  aggregation: Aggregation;
  aligned: AlignedPoint[];
  aligned_count: number;
  left_input_count: number;
  right_input_count: number;
  left_bucket_count: number;
  right_bucket_count: number;
  omitted_unparseable: { left: string[]; right: string[] };
  pearson_r: number | null;
  caveat: string;
}

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  SEPT: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const frequencyRank: Record<Frequency, number> = { annual: 1, quarterly: 2, monthly: 3 };

export function parsePeriod(period: string): ParsedPeriod | null {
  const normalized = period.trim().toUpperCase().replaceAll('_', '-');
  let match = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(normalized);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    return {
      year,
      month,
      quarter: Math.ceil(month / 3),
      frequency: 'monthly',
      ordinal: year * 12 + month,
    };
  }

  match = /^(\d{4})\s*-?\s*([A-Z]{3,4})$/.exec(normalized);
  if (match) {
    const year = Number(match[1]);
    const month = MONTHS[match[2]!];
    if (!month) return null;
    return {
      year,
      month,
      quarter: Math.ceil(month / 3),
      frequency: 'monthly',
      ordinal: year * 12 + month,
    };
  }

  match = /^(\d{4})\s*-?\s*Q([1-4])$/.exec(normalized);
  if (!match) match = /^Q([1-4])\s*-?\s*(\d{4})$/.exec(normalized);
  if (match) {
    const reversed = normalized.startsWith('Q');
    const year = Number(match[reversed ? 2 : 1]);
    const quarter = Number(match[reversed ? 1 : 2]);
    return {
      year,
      month: null,
      quarter,
      frequency: 'quarterly',
      ordinal: year * 12 + quarter * 3,
    };
  }

  match = /^(\d{4})$/.exec(normalized);
  if (match) {
    const year = Number(match[1]);
    return {
      year,
      month: null,
      quarter: null,
      frequency: 'annual',
      ordinal: year * 12 + 12,
    };
  }
  return null;
}

export function sortObservations(observations: Observation[]): Observation[] {
  return [...observations].sort((left, right) => {
    const a = parsePeriod(left.period);
    const b = parsePeriod(right.period);
    if (!a && !b) return left.period.localeCompare(right.period);
    if (!a) return 1;
    if (!b) return -1;
    return a.ordinal - b.ordinal;
  });
}

function inferredFrequency(observations: Observation[]): Frequency {
  const parsed = observations.map((point) => parsePeriod(point.period)).filter(Boolean);
  if (!parsed.length) return 'annual';
  return parsed.reduce<Frequency>(
    (coarsest, item) =>
      item && frequencyRank[item.frequency] < frequencyRank[coarsest] ? item.frequency : coarsest,
    parsed[0]!.frequency,
  );
}

function bucket(parsed: ParsedPeriod, target: Frequency): string | null {
  if (target === 'annual') return String(parsed.year);
  if (target === 'quarterly') {
    if (parsed.frequency === 'annual') return null;
    const quarter = parsed.quarter ?? Math.ceil((parsed.month ?? 1) / 3);
    return `${parsed.year}-Q${quarter}`;
  }
  if (parsed.frequency !== 'monthly' || parsed.month === null) return null;
  return `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
}

function aggregateSeries(
  observations: Observation[],
  frequency: Frequency,
  aggregation: Aggregation,
): { values: Map<string, number>; omitted: string[] } {
  const groups = new Map<string, { value: number; ordinal: number }[]>();
  const omitted: string[] = [];
  for (const observation of observations) {
    const parsed = parsePeriod(observation.period);
    if (!parsed) {
      omitted.push(observation.period);
      continue;
    }
    const key = bucket(parsed, frequency);
    if (!key) {
      omitted.push(observation.period);
      continue;
    }
    const values = groups.get(key) ?? [];
    values.push({ value: observation.value, ordinal: parsed.ordinal });
    groups.set(key, values);
  }
  const result = new Map<string, number>();
  for (const [key, values] of groups) {
    if (aggregation === 'sum') {
      result.set(
        key,
        values.reduce((sum, item) => sum + item.value, 0),
      );
    } else if (aggregation === 'latest') {
      result.set(key, [...values].sort((a, b) => b.ordinal - a.ordinal)[0]!.value);
    } else {
      result.set(key, values.reduce((sum, item) => sum + item.value, 0) / values.length);
    }
  }
  return { values: result, omitted };
}

export function pearson(left: number[], right: number[]): number | null {
  const count = Math.min(left.length, right.length);
  if (count < 2) return null;
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

export function alignSeries(
  left: Observation[],
  right: Observation[],
  target: Frequency | 'auto' = 'auto',
  aggregation: Aggregation = 'mean',
): AlignmentResult {
  const leftFrequency = inferredFrequency(left);
  const rightFrequency = inferredFrequency(right);
  const frequency =
    target === 'auto'
      ? frequencyRank[leftFrequency] <= frequencyRank[rightFrequency]
        ? leftFrequency
        : rightFrequency
      : target;
  const leftBuckets = aggregateSeries(left, frequency, aggregation);
  const rightBuckets = aggregateSeries(right, frequency, aggregation);
  const periods = [...leftBuckets.values.keys()]
    .filter((period) => rightBuckets.values.has(period))
    .sort((a, b) => (parsePeriod(a)?.ordinal ?? 0) - (parsePeriod(b)?.ordinal ?? 0));
  const aligned = periods.map((period) => {
    const leftValue = leftBuckets.values.get(period)!;
    const rightValue = rightBuckets.values.get(period)!;
    return {
      period,
      left: leftValue,
      right: rightValue,
      difference: rightValue - leftValue,
      difference_percent: leftValue === 0 ? null : ((rightValue - leftValue) / leftValue) * 100,
    };
  });
  return {
    frequency,
    aggregation,
    aligned,
    aligned_count: aligned.length,
    left_input_count: left.length,
    right_input_count: right.length,
    left_bucket_count: leftBuckets.values.size,
    right_bucket_count: rightBuckets.values.size,
    omitted_unparseable: { left: leftBuckets.omitted, right: rightBuckets.omitted },
    pearson_r: pearson(
      aligned.map((point) => point.left),
      aligned.map((point) => point.right),
    ),
    caveat:
      'Series are matched by normalized calendar period. Correlation is descriptive and does not imply causation.',
  };
}

function percentile(sorted: number[], position: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const index = (sorted.length - 1) * position;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function summarizeValues(values: number[]): Record<string, number> {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {
    count: values.length,
    min: sorted[0]!,
    max: sorted.at(-1)!,
    mean,
    median: percentile(sorted, 0.5),
    p25: percentile(sorted, 0.25),
    p75: percentile(sorted, 0.75),
    standard_deviation: Math.sqrt(variance),
  };
}

export function visualizeSeries(
  observations: Observation[],
  options: { title?: string; unit?: string; maxPoints?: number } = {},
): Record<string, unknown> {
  const maxPoints = options.maxPoints ?? 60;
  const points = sortObservations(observations).slice(-maxPoints);
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;
  const ticks = '▁▂▃▄▅▆▇█';
  const sparkline = values
    .map((value) => ticks[Math.round(((value - minimum) / (range || 1)) * (ticks.length - 1))])
    .join('');
  const maxAbsolute = Math.max(...values.map(Math.abs), 1);
  const asciiBars = points.map(
    (point) =>
      `${point.period.padEnd(10)} | ${point.value < 0 ? '-' : ''}${'█'.repeat(
        Math.max(1, Math.round((Math.abs(point.value) / maxAbsolute) * 30)),
      )} ${point.value}`,
  );
  const changes = points.slice(1).map((point, index) => {
    const previous = points[index]!;
    return {
      period: point.period,
      change: point.value - previous.value,
      change_percent:
        previous.value === 0 ? null : ((point.value - previous.value) / previous.value) * 100,
    };
  });
  const latestChange = changes.at(-1) ?? null;
  const first = values[0]!;
  const last = values.at(-1)!;
  const tolerance = Math.max(Math.abs(first), Math.abs(last), 1) * 0.005;
  const trend = last - first > tolerance ? 'rising' : first - last > tolerance ? 'falling' : 'flat';
  return {
    title: options.title ?? null,
    unit: options.unit ?? null,
    displayed_points: points.length,
    input_points: observations.length,
    truncated: observations.length > points.length,
    period_start: points[0]!.period,
    period_end: points.at(-1)!.period,
    latest: last,
    latest_change: latestChange,
    trend,
    sparkline,
    ascii_chart: asciiBars.join('\n'),
    statistics: summarizeValues(values),
    changes,
    chart_data: points,
    vega_lite_hint: {
      mark: 'line',
      encoding: {
        x: { field: 'period', type: 'ordinal' },
        y: { field: 'value', type: 'quantitative' },
      },
    },
  };
}

export function numericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replaceAll(',', '');
  if (!normalized || /^(?:na|n\.a\.|-|nil)$/i.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

export function observationsFromWideRow(row: Record<string, unknown>): Observation[] {
  return Object.entries(row)
    .filter(([period]) => period !== '_id' && period !== 'DataSeries' && parsePeriod(period))
    .flatMap(([period, raw]) => {
      const value = numericValue(raw);
      return value === null ? [] : [{ period, value }];
    });
}
