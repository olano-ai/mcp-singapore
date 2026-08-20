import type { McpServer } from '@modelcontextprotocol/server';
import {
  assertSuccessfulEnvelope,
  getOptionalEnv,
  JsonHttpClient,
  jsonResult,
} from '@olano/mcp-core';
import * as z from 'zod/v4';
import {
  numericValue,
  observationsFromWideRow,
  parsePeriod,
  sortObservations,
  summarizeValues,
  type Observation,
} from './series.js';

type Row = Record<string, unknown>;

const DATA_GOV_ACTION = 'https://data.gov.sg/api/action/';
const SINGSTAT_TABLE = 'https://tablebuilder.singstat.gov.sg/api/table/tabledata/';
const HDB_RESALE_ID = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc';
const COE_ID = 'd_69b3380ad7e51aff3a7dcc84eba52b8a';
const CPI_ID = 'd_bdaff844e3ef89d39fceb962ff8f0791';
const EMPLOYMENT_ID = 'd_d2518fed6cc2014f0cd061b4570a9592';
const RETAIL_ID = 'd_6b78d625911483860e162288a4000a0c';
const FX_ID = 'd_b2b7ffe00aaec3936ed379369fdf531b';
const IRAS_ID = 'd_21e22578cabce897e8b27801e5596140';
const VISITORS_ID = 'd_7e7b2ee60c6ffc962f80fef129cf306e';
const URA_PROPERTY_ID = 'd_7c69c943d5f0d89d6a9a773d2b51f337';
const MOE_SCHOOLS_ID = 'd_688b934f82c1059ed0a6993d2a829089';
const ECDA_CENTRES_ID = 'd_696c994c50745b079b3684f0e90ffc53';
const GDP_ID = 'd_a5ff719648a0e6d4b4c623ee383ab686';
const DISEASE_ID = 'd_ca168b2cb763640d72c4600a68f9909e';
const CRIME_ID = 'd_ca0b908cf06a267ca06acbd5feb4465c';
const FORMATIONS_ID = 'M085831';
const CESSATIONS_ID = 'M085841';

function record(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

export function dataGovRows(value: unknown): Row[] {
  assertSuccessfulEnvelope(value, 'data.gov.sg');
  const rows = record(record(value).result).records;
  return Array.isArray(rows)
    ? rows.filter(
        (row): row is Row => Boolean(row) && typeof row === 'object' && !Array.isArray(row),
      )
    : [];
}

function singStatRows(value: unknown): Row[] {
  assertSuccessfulEnvelope(value, 'SingStat');
  const rows = record(record(value).Data).row;
  return Array.isArray(rows)
    ? rows.filter(
        (row): row is Row => Boolean(row) && typeof row === 'object' && !Array.isArray(row),
      )
    : [];
}

function dataGovClient(): JsonHttpClient {
  const apiKey = getOptionalEnv('DATA_GOV_SG_API_KEY');
  return new JsonHttpClient({
    baseUrl: DATA_GOV_ACTION,
    defaultHeaders: apiKey ? { 'x-api-key': apiKey } : {},
    cacheTtlMs: 60_000,
    minRequestIntervalMs: 250,
  });
}

function singStatClient(): JsonHttpClient {
  return new JsonHttpClient({
    baseUrl: SINGSTAT_TABLE,
    cacheTtlMs: 86_400_000,
    minRequestIntervalMs: 250,
  });
}

function dataGovCatalogueClient(): JsonHttpClient {
  const apiKey = getOptionalEnv('DATA_GOV_SG_API_KEY');
  return new JsonHttpClient({
    baseUrl: 'https://api-production.data.gov.sg/v2/public/api/',
    defaultHeaders: apiKey ? { 'x-api-key': apiKey } : {},
    cacheTtlMs: 86_400_000,
    minRequestIntervalMs: 250,
  });
}

function oneMapClient(): JsonHttpClient {
  const token = getOptionalEnv('ONEMAP_TOKEN');
  if (!token) {
    throw new Error(
      'Missing required environment variable ONEMAP_TOKEN. True-distance proximity uses the official OneMap Search and Themes APIs.',
    );
  }
  return new JsonHttpClient({
    baseUrl: 'https://www.onemap.gov.sg/api/',
    defaultHeaders: { authorization: `Bearer ${token}` },
    cacheTtlMs: 300_000,
    minRequestIntervalMs: 250,
  });
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function bestSeriesRow(rows: Row[], requested: string): Row | null {
  const query = normalizeText(requested);
  return (
    rows.find((row) => normalizeText(row.DataSeries ?? row.rowText) === query) ??
    rows.find((row) => normalizeText(row.DataSeries ?? row.rowText).includes(query)) ??
    null
  );
}

function canonicalPeriod(period: string): string | null {
  const parsed = parsePeriod(period);
  if (!parsed) return null;
  if (parsed.frequency === 'annual') return String(parsed.year);
  if (parsed.frequency === 'quarterly') return `${parsed.year}-Q${parsed.quarter}`;
  return `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
}

function catalogueDatasets(value: unknown): Row[] {
  assertSuccessfulEnvelope(value, 'data.gov.sg catalogue');
  const datasets = record(record(value).data).datasets;
  return Array.isArray(datasets)
    ? datasets.filter(
        (item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
}

export function filterCatalogueDatasets(
  datasets: Row[],
  query: string,
  agency?: string,
  format?: string,
): Row[] {
  const terms = normalizeText(query).split(' ').filter(Boolean);
  const agencyQuery = normalizeText(agency);
  const formatQuery = normalizeText(format);
  return datasets
    .flatMap((dataset) => {
      const name = normalizeText(dataset.name);
      const datasetId = normalizeText(dataset.datasetId);
      const managedBy = normalizeText(dataset.managedByAgencyName);
      const description = normalizeText(dataset.description);
      const datasetFormat = normalizeText(dataset.format);
      const haystack = `${datasetId} ${name} ${managedBy} ${description} ${datasetFormat}`;
      const matchesTerms = terms.every((term) => haystack.includes(term));
      const matchesAgency = !agencyQuery || managedBy.includes(agencyQuery);
      const matchesFormat = !formatQuery || datasetFormat === formatQuery;
      if (!matchesTerms || !matchesAgency || !matchesFormat) return [];
      const relevance = terms.reduce(
        (score, term) =>
          score +
          (name.includes(term) ? 6 : 0) +
          (managedBy.includes(term) ? 4 : 0) +
          (datasetId.includes(term) ? 3 : 0) +
          (description.includes(term) ? 1 : 0),
        0,
      );
      return [{ dataset, relevance }];
    })
    .sort(
      (left, right) =>
        right.relevance - left.relevance ||
        String(right.dataset.lastUpdatedAt ?? '').localeCompare(
          String(left.dataset.lastUpdatedAt ?? ''),
        ),
    )
    .map(({ dataset }) => dataset);
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

function coordinateFromRow(row: Row): Coordinate | null {
  const latitude = numericValue(row.LATITUDE ?? row.latitude ?? row.Latitude);
  const longitude = numericValue(row.LONGITUDE ?? row.LONGTITUDE ?? row.longitude ?? row.Longitude);
  return latitude !== null && longitude !== null ? { latitude, longitude } : null;
}

function coordinatePairs(value: unknown): Coordinate[] {
  if (typeof value === 'string') {
    try {
      return coordinatePairs(JSON.parse(value) as unknown);
    } catch {
      const values = value.split(',').map((item) => numericValue(item));
      if (
        values.length === 2 &&
        values[0] !== null &&
        values[0] !== undefined &&
        values[1] !== null &&
        values[1] !== undefined
      ) {
        return [{ longitude: values[0], latitude: values[1] }];
      }
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && numericValue(value[0]) !== null && numericValue(value[1]) !== null) {
    return [
      {
        longitude: numericValue(value[0])!,
        latitude: numericValue(value[1])!,
      },
    ];
  }
  return value.flatMap(coordinatePairs);
}

function featureCoordinate(row: Row): Coordinate | null {
  const direct = coordinateFromRow(row);
  if (direct) return direct;
  const geoJson = record(row.GeoJSON);
  const geometry = record(geoJson.geometry);
  const pairs = coordinatePairs(row.LatLng ?? geometry.coordinates);
  const singaporePairs = pairs.filter(
    ({ latitude, longitude }) =>
      latitude >= 1.1 && latitude <= 1.6 && longitude >= 103.5 && longitude <= 104.1,
  );
  if (!singaporePairs.length) return null;
  return {
    latitude:
      singaporePairs.reduce((sum, point) => sum + point.latitude, 0) / singaporePairs.length,
    longitude:
      singaporePairs.reduce((sum, point) => sum + point.longitude, 0) / singaporePairs.length,
  };
}

export function haversineMetres(left: Coordinate, right: Coordinate): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(left.latitude)) *
      Math.cos(radians(right.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function rankNearbyFeatures(
  features: Row[],
  origin: Coordinate,
  radiusMetres: number,
  limit: number,
): Record<string, unknown>[] {
  return features
    .flatMap((feature) => {
      const coordinate = featureCoordinate(feature);
      if (!coordinate) return [];
      const distance = haversineMetres(origin, coordinate);
      return distance <= radiusMetres
        ? [
            {
              ...feature,
              latitude: coordinate.latitude,
              longitude: coordinate.longitude,
              distance_metres: Math.round(distance),
            },
          ]
        : [];
    })
    .sort((left, right) => Number(left.distance_metres) - Number(right.distance_metres))
    .slice(0, limit);
}

function oneMapThemeNames(value: unknown): Row[] {
  const rows = record(value).Theme_Names;
  return Array.isArray(rows)
    ? rows.filter(
        (item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
}

function oneMapThemeFeatures(value: unknown, queryName: string): Row[] {
  const results = record(value).SrchResults;
  if (!Array.isArray(results)) return [];
  const first = record(results[0]);
  const featureRows = 'FeatCount' in first || 'Theme_Name' in first ? results.slice(1) : results;
  return featureRows.flatMap((item) => {
    const feature = record(item);
    return Object.keys(feature).length ? [{ ...feature, source_theme: queryName }] : [];
  });
}

function boundingExtents(origin: Coordinate, radiusMetres: number): string {
  const latitudeDelta = radiusMetres / 111_320;
  const longitudeDelta =
    radiusMetres / (111_320 * Math.max(Math.cos((origin.latitude * Math.PI) / 180), 0.01));
  return [
    origin.latitude - latitudeDelta,
    origin.longitude - longitudeDelta,
    origin.latitude + latitudeDelta,
    origin.longitude + longitudeDelta,
  ]
    .map((value) => value.toFixed(7))
    .join(',');
}

async function resolveOneMapOrigin(
  api: JsonHttpClient,
  input: {
    location?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
  },
): Promise<{ origin: Coordinate; resolved_address: Row | null }> {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    return {
      origin: { latitude: input.latitude, longitude: input.longitude },
      resolved_address: null,
    };
  }
  if (!input.location) {
    throw new Error('Provide either location or both latitude and longitude.');
  }
  const payload = await api.get('common/elastic/search', {
    searchVal: input.location,
    returnGeom: 'Y',
    getAddrDetails: 'Y',
    pageNum: 1,
  });
  const results = record(payload).results;
  const match = Array.isArray(results) ? record(results[0]) : {};
  const coordinate = coordinateFromRow(match);
  if (!coordinate) throw new Error(`OneMap could not resolve "${input.location}" to a coordinate.`);
  return { origin: coordinate, resolved_address: match };
}

async function findNearbyOneMapThemes(
  api: JsonHttpClient,
  input: {
    location?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    radiusMetres: number;
    limit: number;
  },
  kind: 'schools' | 'early-childhood',
): Promise<Record<string, unknown>> {
  const resolved = await resolveOneMapOrigin(api, input);
  const themesPayload = await api.get('public/themesvc/getAllThemesInfo', { moreInfo: 'Y' });
  const themes = oneMapThemeNames(themesPayload)
    .filter((theme) => {
      const name = String(theme.THEMENAME ?? '');
      if (kind === 'early-childhood') {
        return /kindergartens?|child\s*care|preschools?|pre-schools?|early childhood/i.test(name);
      }
      const agencyContext = `${String(theme.CATEGORY ?? '')} ${String(theme.THEME_OWNER ?? '')}`;
      return (
        /schools?|junior colleges?/i.test(name) &&
        (/education|ministry of education/i.test(agencyContext) ||
          /primary|secondary|special education|junior college/i.test(name))
      );
    })
    .filter((theme) => typeof theme.QUERYNAME === 'string' && theme.QUERYNAME.trim())
    .filter(
      (theme, index, all) =>
        all.findIndex((candidate) => candidate.QUERYNAME === theme.QUERYNAME) === index,
    )
    .slice(0, 12);
  if (!themes.length && kind === 'early-childhood') {
    themes.push({ THEMENAME: 'Kindergartens', QUERYNAME: 'kindergartens' });
  }
  const extents = boundingExtents(resolved.origin, input.radiusMetres);
  const features: Row[] = [];
  for (const theme of themes) {
    const queryName = String(theme.QUERYNAME);
    const payload = await api.get('public/themesvc/retrieveTheme', { queryName, extents });
    features.push(...oneMapThemeFeatures(payload, queryName));
  }
  const nearby = rankNearbyFeatures(features, resolved.origin, input.radiusMetres, input.limit);
  return {
    query: input.location ?? null,
    origin: resolved.origin,
    resolved_address: resolved.resolved_address,
    radius_metres: input.radiusMetres,
    count: nearby.length,
    results: nearby,
    themes_checked: themes.map((theme) => ({
      name: theme.THEMENAME,
      query_name: theme.QUERYNAME,
      owner: theme.THEME_OWNER ?? null,
    })),
  };
}

const VACANCY_MONTH_FIELDS = {
  current: 'current_month',
  next: 'next_month',
  third: 'third_month',
  fourth: 'fourth_month',
  fifth: 'fifth_month',
  sixth: 'sixth_month',
  seventh: 'seventh_month',
} as const;

type VacancyMonth = keyof typeof VACANCY_MONTH_FIELDS;
type VacancyLevel = 'infant' | 'pg' | 'n1' | 'n2' | 'k1' | 'k2';

function vacancyCategory(value: unknown): 'available' | 'limited' | 'full' | 'unknown' {
  const normalized = normalizeText(value);
  if (!normalized || /^(?:na|n\.a\.|nil|-)$/.test(normalized)) return 'unknown';
  if (/(?:no vacancy|full|unavailable|none)/.test(normalized)) return 'full';
  if (/limited/.test(normalized)) return 'limited';
  if (/(?:available|vacancy|yes)/.test(normalized) || (numericValue(value) ?? 0) > 0)
    return 'available';
  if (numericValue(value) === 0) return 'full';
  return 'unknown';
}

export function summarizeEcdaVacancies(
  rows: Row[],
  level: VacancyLevel,
  month: VacancyMonth = 'current',
): Record<string, unknown> {
  const field = `${level}_vacancy_${VACANCY_MONTH_FIELDS[month]}`;
  const centres = rows.map((row) => ({
    centre_code: row.centre_code ?? null,
    centre_name: row.centre_name ?? null,
    centre_address: row.centre_address ?? null,
    postal_code: row.postal_code ?? null,
    published_value: row[field] ?? null,
    status: vacancyCategory(row[field]),
    last_updated: row.last_updated ?? null,
  }));
  const statuses = { available: 0, limited: 0, full: 0, unknown: 0 };
  for (const centre of centres) statuses[centre.status] += 1;
  const numericValues = centres.flatMap((centre) => {
    const value = numericValue(centre.published_value);
    return value === null ? [] : [value];
  });
  return {
    level,
    month,
    vacancy_field: field,
    centres_reviewed: centres.length,
    status_counts: statuses,
    centres_with_possible_vacancy: statuses.available + statuses.limited,
    published_numeric_vacancy_total:
      numericValues.length > 0 ? numericValues.reduce((sum, value) => sum + value, 0) : null,
    centres,
    interpretation:
      'ECDA currently publishes categorical values such as Available, Limited and Full for many centres. A numeric total is returned only when numeric values are present and is never inferred from categories.',
  };
}

function diseaseCaseValue(row: Row): number | null {
  return numericValue(row['no._of_cases'] ?? row.no__of_cases ?? row.number_of_cases);
}

function diseaseFreshness(rows: Row[]): Record<string, unknown> {
  const latestWeek =
    rows
      .map((row) => String(row.epi_week ?? ''))
      .sort()
      .at(-1) ?? null;
  const year = latestWeek ? Number(latestWeek.slice(0, 4)) : NaN;
  const frozen = Number.isFinite(year) && new Date().getUTCFullYear() - year >= 2;
  return {
    latest_published_week: latestWeek,
    level: latestWeek ? (frozen ? 'frozen' : 'recent') : 'unknown',
    warning: frozen
      ? `The official data.gov.sg source ends at ${latestWeek}; do not describe it as current disease surveillance. Cross-check current MOH bulletins.`
      : null,
  };
}

export function summarizeDiseaseList(rows: Row[]): Record<string, unknown> {
  const totals = new Map<string, { total: number; weeks: number; latest_week: string }>();
  for (const row of rows) {
    const disease = String(row.disease ?? '').trim();
    const week = String(row.epi_week ?? '').trim();
    const cases = diseaseCaseValue(row);
    if (!disease || !week || cases === null) continue;
    const current = totals.get(disease) ?? { total: 0, weeks: 0, latest_week: '' };
    current.total += cases;
    current.weeks += 1;
    if (week > current.latest_week) current.latest_week = week;
    totals.set(disease, current);
  }
  return {
    count: totals.size,
    diseases: [...totals]
      .map(([disease, item]) => ({
        disease,
        observed_weeks: item.weeks,
        total_cases_in_source_coverage: item.total,
        latest_published_week: item.latest_week,
      }))
      .sort((left, right) => String(left.disease).localeCompare(String(right.disease), 'en-SG')),
    data_freshness: diseaseFreshness(rows),
  };
}

export function summarizeDiseaseTrend(
  rows: Row[],
  disease: string,
  weeksBack = 52,
): Record<string, unknown> {
  const query = normalizeText(disease);
  const matchedLabels = new Set<string>();
  const byWeek = new Map<string, number>();
  for (const row of rows) {
    const label = String(row.disease ?? '').trim();
    if (!normalizeText(label).includes(query)) continue;
    const week = String(row.epi_week ?? '').trim();
    const cases = diseaseCaseValue(row);
    if (!week || cases === null) continue;
    matchedLabels.add(label);
    byWeek.set(week, (byWeek.get(week) ?? 0) + cases);
  }
  const series = [...byWeek]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-weeksBack)
    .map(([epi_week, cases]) => ({ epi_week, cases }));
  return {
    requested_disease: disease,
    matched_disease_labels: [...matchedLabels].sort(),
    count: series.length,
    series,
    statistics: series.length ? summarizeValues(series.map((point) => point.cases)) : null,
    data_freshness: diseaseFreshness(rows),
  };
}

function normalizeQuarter(value: string): { display: string; candidates: string[] } | null {
  const compact = value.toUpperCase().replaceAll(/[- _]/g, '');
  const standard = /^(\d{4})Q([1-4])$/.exec(compact);
  const trailing = /^(\d{4})([1-4])Q$/.exec(compact);
  const match = standard ?? trailing;
  if (!match) return null;
  const year = match[1]!;
  const quarter = match[2]!;
  return {
    display: `${year}Q${quarter}`,
    candidates: [`${year}${quarter}Q`, `_${year}${quarter}Q`, `${year}Q${quarter}`],
  };
}

export function rankWideRows(
  rows: Row[],
  period: string,
  kind: 'quarter' | 'year',
): Record<string, unknown> {
  const normalized =
    kind === 'quarter'
      ? normalizeQuarter(period)
      : /^\d{4}$/.test(period)
        ? { display: period, candidates: [period, `_${period}`] }
        : null;
  if (!normalized) {
    throw new Error(
      kind === 'quarter'
        ? `Unrecognized quarter "${period}". Use a value such as 2025Q4 or 20254Q.`
        : `Unrecognized year "${period}". Use a four-digit year.`,
    );
  }
  const availableColumn = normalized.candidates.find((candidate) =>
    rows.some((row) => candidate in row),
  );
  const ranked = availableColumn
    ? rows
        .flatMap((row) => {
          const value = numericValue(row[availableColumn]);
          const label = String(row.DataSeries ?? '').trim();
          return value === null || !label ? [] : [{ label, value }];
        })
        .sort((left, right) => right.value - left.value)
    : [];
  return {
    period: normalized.display,
    matched_source_column: availableColumn ?? null,
    count: ranked.length,
    ranked,
  };
}

export interface ChangePoint {
  period: string;
  value: number;
  previous_period: string;
  previous_value: number;
  change: number;
  change_percent: number | null;
}

export function yearOverYear(observations: Observation[], limit = 12): ChangePoint[] {
  const points = sortObservations(observations);
  const byPeriod = new Map<string, number>();
  for (const point of points) {
    const key = canonicalPeriod(point.period);
    if (key) byPeriod.set(key, point.value);
  }
  return points
    .flatMap((point): ChangePoint[] => {
      const parsed = parsePeriod(point.period);
      if (!parsed) return [];
      const current = canonicalPeriod(point.period)!;
      const previous =
        parsed.frequency === 'annual'
          ? String(parsed.year - 1)
          : parsed.frequency === 'quarterly'
            ? `${parsed.year - 1}-Q${parsed.quarter}`
            : `${parsed.year - 1}-${String(parsed.month).padStart(2, '0')}`;
      const previousValue = byPeriod.get(previous);
      if (previousValue === undefined) return [];
      return [
        {
          period: current,
          value: point.value,
          previous_period: previous,
          previous_value: previousValue,
          change: point.value - previousValue,
          change_percent:
            previousValue === 0 ? null : ((point.value - previousValue) / previousValue) * 100,
        },
      ];
    })
    .slice(-limit);
}

export function periodGrowth(observations: Observation[], limit = 10): ChangePoint[] {
  const points = sortObservations(observations);
  return points
    .slice(1)
    .map((point, index): ChangePoint => {
      const previous = points[index]!;
      return {
        period: canonicalPeriod(point.period) ?? point.period,
        value: point.value,
        previous_period: canonicalPeriod(previous.period) ?? previous.period,
        previous_value: previous.value,
        change: point.value - previous.value,
        change_percent:
          previous.value === 0 ? null : ((point.value - previous.value) / previous.value) * 100,
      };
    })
    .slice(-limit);
}

function groupedStats(rows: Row[], field: string, valueField: string): Record<string, unknown>[] {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const label = String(row[field] ?? 'Unknown').trim();
    const value = numericValue(row[valueField]);
    if (value === null) continue;
    const values = groups.get(label) ?? [];
    values.push(value);
    groups.set(label, values);
  }
  const summaries: Record<string, unknown>[] = [...groups].map(([label, values]) => ({
    label,
    ...summarizeValues(values),
  }));
  return summaries.sort((a, b) => Number(b.count) - Number(a.count));
}

export function summarizeHdbResales(rows: Row[]): Record<string, unknown> {
  const prices = rows.flatMap((row) => {
    const value = numericValue(row.resale_price);
    return value === null ? [] : [value];
  });
  const perSquareMetre = rows.flatMap((row) => {
    const price = numericValue(row.resale_price);
    const area = numericValue(row.floor_area_sqm);
    return price === null || area === null || area <= 0 ? [] : [price / area];
  });
  const periods = rows
    .map((row) => String(row.month ?? ''))
    .filter(Boolean)
    .sort();
  const priceSummary = prices.length ? summarizeValues(prices) : null;
  return {
    transaction_count: prices.length,
    price_sgd: priceSummary,
    price_range_sgd: priceSummary ? { minimum: priceSummary.min, maximum: priceSummary.max } : null,
    quartiles_sgd: priceSummary
      ? { q1: priceSummary.p25, median: priceSummary.median, q3: priceSummary.p75 }
      : null,
    price_per_sqm_sgd: perSquareMetre.length ? summarizeValues(perSquareMetre) : null,
    coverage: {
      first_month: periods[0] ?? null,
      latest_month: periods.at(-1) ?? null,
    },
    by_town: groupedStats(rows, 'town', 'resale_price').slice(0, 30),
    by_flat_type: groupedStats(rows, 'flat_type', 'resale_price').slice(0, 20),
    by_month: groupedStats(rows, 'month', 'resale_price')
      .sort((left, right) => String(left.label).localeCompare(String(right.label)))
      .slice(-36),
  };
}

export function hdbSelectionIsComplete(input: {
  fetchedAllMatchingRows: boolean;
  explicitDateWindow: boolean;
  startMonth?: string;
  earliestFetchedMonth: string | null;
  earliestSelectedMonth: string | null;
}): boolean {
  if (input.fetchedAllMatchingRows) return true;
  if (input.explicitDateWindow) {
    return Boolean(
      input.startMonth &&
      input.earliestFetchedMonth &&
      input.earliestFetchedMonth < input.startMonth,
    );
  }
  return Boolean(
    input.earliestFetchedMonth &&
    input.earliestSelectedMonth &&
    input.earliestFetchedMonth < input.earliestSelectedMonth,
  );
}

export interface CoeMetric {
  month: string;
  bidding_no: number;
  vehicle_class: string;
  quota: number;
  successful_bids: number;
  bids_received: number;
  premium_sgd: number;
  bid_to_quota_ratio: number | null;
  excess_bids: number;
  success_rate_percent: number | null;
  quota_utilisation_percent: number | null;
}

export function coeMetric(row: Row): CoeMetric | null {
  const month = String(row.month ?? '');
  const bidding = numericValue(row.bidding_no);
  const quota = numericValue(row.quota);
  const success = numericValue(row.bids_success);
  const received = numericValue(row.bids_received);
  const premium = numericValue(row.premium);
  if (
    !month ||
    bidding === null ||
    quota === null ||
    success === null ||
    received === null ||
    premium === null
  )
    return null;
  return {
    month,
    bidding_no: bidding,
    vehicle_class: String(row.vehicle_class ?? ''),
    quota,
    successful_bids: success,
    bids_received: received,
    premium_sgd: premium,
    bid_to_quota_ratio: quota === 0 ? null : received / quota,
    excess_bids: received - quota,
    success_rate_percent: received === 0 ? null : (success / received) * 100,
    quota_utilisation_percent: quota === 0 ? null : (success / quota) * 100,
  };
}

function exerciseOrdinal(row: Row): number {
  const parsed = parsePeriod(String(row.month ?? ''));
  return (parsed?.ordinal ?? 0) * 10 + (numericValue(row.bidding_no) ?? 0);
}

function exerciseKey(row: Row): string {
  return `${String(row.month ?? '')}#${String(row.bidding_no ?? '')}`;
}

function normalizeCoeCategory(category: string): string {
  return `Category ${category
    .replace(/^category\s*/i, '')
    .trim()
    .toUpperCase()}`;
}

function singStatObservations(row: Row): Observation[] {
  const columns = row.columns;
  if (!Array.isArray(columns)) return [];
  return columns.flatMap((column): Observation[] => {
    const item = record(column);
    const period = String(item.key ?? '');
    const value = numericValue(item.value);
    return period && value !== null ? [{ period, value }] : [];
  });
}

export interface FormationPoint {
  period: string;
  formations: number;
  cessations: number;
  net_formations: number;
  formation_to_cessation_ratio: number | null;
}

export function formationNet(
  formations: Observation[],
  cessations: Observation[],
  limit = 24,
): FormationPoint[] {
  const formationMap = new Map(
    formations.flatMap((point) => {
      const period = canonicalPeriod(point.period);
      return period ? [[period, point.value] as const] : [];
    }),
  );
  const cessationMap = new Map(
    cessations.flatMap((point) => {
      const period = canonicalPeriod(point.period);
      return period ? [[period, point.value] as const] : [];
    }),
  );
  return [...formationMap.keys()]
    .filter((period) => cessationMap.has(period))
    .sort((a, b) => (parsePeriod(a)?.ordinal ?? 0) - (parsePeriod(b)?.ordinal ?? 0))
    .map((period) => {
      const formed = formationMap.get(period)!;
      const ceased = cessationMap.get(period)!;
      return {
        period,
        formations: formed,
        cessations: ceased,
        net_formations: formed - ceased,
        formation_to_cessation_ratio: ceased === 0 ? null : formed / ceased,
      };
    })
    .slice(-limit);
}

const HUNDRED_UNIT_FX = new Set([
  'Japanese Yen',
  'Korean Won',
  'New Taiwan Dollar',
  'Indonesian Rupiah',
  'Thai Baht',
  'Indian Rupee',
  'Philippine Peso',
]);

export interface FxQuote {
  currency: string;
  period: string;
  quoted_foreign_units: number;
  sgd_per_quoted_units: number;
  sgd_per_foreign_unit: number;
  foreign_units_per_sgd: number | null;
}

export function fxQuote(row: Row, requestedPeriod?: string): FxQuote | null {
  const observations = sortObservations(observationsFromWideRow(row));
  const point = requestedPeriod
    ? observations.find((item) => canonicalPeriod(item.period) === canonicalPeriod(requestedPeriod))
    : observations.at(-1);
  if (!point) return null;
  const currency = String(row.DataSeries ?? '').trim();
  const units = HUNDRED_UNIT_FX.has(currency) ? 100 : 1;
  const perUnit = point.value / units;
  return {
    currency,
    period: canonicalPeriod(point.period) ?? point.period,
    quoted_foreign_units: units,
    sgd_per_quoted_units: point.value,
    sgd_per_foreign_unit: perUnit,
    foreign_units_per_sgd: perUnit === 0 ? null : 1 / perUnit,
  };
}

export function calculateTaxMix(rows: Row[], year?: string): Record<string, unknown> {
  const availableYears = [...new Set(rows.map((row) => String(row.financial_year ?? '')))]
    .filter(Boolean)
    .sort();
  const selectedYear = year ?? availableYears.at(-1) ?? '';
  const categories = rows
    .filter((row) => String(row.financial_year ?? '') === selectedYear)
    .flatMap((row) => {
      const collected = numericValue(row.tax_collected);
      return collected === null
        ? []
        : [{ tax_type: String(row.tax_type ?? '').trim(), tax_collected_sgd_thousand: collected }];
    });
  const total = categories.reduce((sum, item) => sum + item.tax_collected_sgd_thousand, 0);
  return {
    financial_year: selectedYear || null,
    total_collected_sgd_thousand: total,
    categories: categories
      .map((item) => ({
        ...item,
        share_percent: total === 0 ? null : (item.tax_collected_sgd_thousand / total) * 100,
      }))
      .sort((a, b) => b.tax_collected_sgd_thousand - a.tax_collected_sgd_thousand),
  };
}

export function rankVisitorSources(
  rows: Row[],
  input: { period?: string; level?: 'countries' | 'regions' | 'all'; limit?: number } = {},
): Record<string, unknown> {
  const totalRow = rows.find((row) =>
    normalizeText(row.DataSeries).startsWith('total international'),
  );
  const latestPeriod = sortObservations(totalRow ? observationsFromWideRow(totalRow) : []).at(
    -1,
  )?.period;
  const selectedPeriod = canonicalPeriod(input.period ?? latestPeriod ?? '');
  const level = input.level ?? 'countries';
  const ranked = rows.flatMap((row) => {
    const rawName = String(row.DataSeries ?? '');
    const indent = rawName.length - rawName.trimStart().length;
    const name = rawName.trim();
    if (!name || name.startsWith('Total International')) return [];
    const rowLevel = indent >= 8 ? 'countries' : indent >= 4 ? 'regions' : 'other';
    if (level !== 'all' && rowLevel !== level) return [];
    if (/^other markets/i.test(name)) return [];
    const point = observationsFromWideRow(row).find(
      (item) => canonicalPeriod(item.period) === selectedPeriod,
    );
    return point ? [{ source: name, level: rowLevel, arrivals: point.value }] : [];
  });
  const total = totalRow
    ? observationsFromWideRow(totalRow).find(
        (item) => canonicalPeriod(item.period) === selectedPeriod,
      )?.value
    : undefined;
  return {
    period: selectedPeriod,
    level,
    total_international_arrivals: total ?? null,
    sources: ranked
      .sort((a, b) => b.arrivals - a.arrivals)
      .slice(0, input.limit ?? 10)
      .map((item) => ({
        ...item,
        share_of_total_percent: total ? (item.arrivals / total) * 100 : null,
      })),
  };
}

export function summarizeUraNewSales(rows: Row[], quarters = 8): Record<string, unknown> {
  const selectedQuarters = [...new Set(rows.map((row) => String(row.quarter ?? '')))]
    .filter(Boolean)
    .sort((a, b) => (parsePeriod(b)?.ordinal ?? 0) - (parsePeriod(a)?.ordinal ?? 0))
    .slice(0, quarters);
  const periods = selectedQuarters.map((quarter) => {
    const matching = rows.filter(
      (row) =>
        String(row.quarter ?? '') === quarter && normalizeText(row.type_of_sale) === 'new sale',
    );
    const completed = matching
      .filter((row) => normalizeText(row.sale_status) === 'completed')
      .reduce((sum, row) => sum + (numericValue(row.units) ?? 0), 0);
    const uncompleted = matching
      .filter((row) => normalizeText(row.sale_status) === 'uncompleted')
      .reduce((sum, row) => sum + (numericValue(row.units) ?? 0), 0);
    return {
      quarter,
      completed_new_sale_units: completed,
      uncompleted_new_sale_units: uncompleted,
      total_new_sale_units: completed + uncompleted,
      uncompleted_share_percent:
        completed + uncompleted === 0 ? null : (uncompleted / (completed + uncompleted)) * 100,
    };
  });
  return {
    newest_first: periods,
    totals: {
      completed_new_sale_units: periods.reduce(
        (sum, item) => sum + item.completed_new_sale_units,
        0,
      ),
      uncompleted_new_sale_units: periods.reduce(
        (sum, item) => sum + item.uncompleted_new_sale_units,
        0,
      ),
    },
  };
}

async function fetchWideSeries(
  client: JsonHttpClient,
  datasetId: string,
  requested: string,
): Promise<{ row: Row; observations: Observation[] }> {
  const payload = await client.get('datastore_search', {
    resource_id: datasetId,
    q: requested,
    limit: 50,
    offset: 0,
  });
  const rows = dataGovRows(payload);
  const row = bestSeriesRow(rows, requested);
  if (!row) throw new Error(`No series matching "${requested}" was found in ${datasetId}.`);
  return { row, observations: observationsFromWideRow(row) };
}

function source(datasetId: string, agency: string): Record<string, string> {
  return {
    agency,
    dataset_id: datasetId,
    api: `${DATA_GOV_ACTION}datastore_search`,
    metadata: `https://api-production.data.gov.sg/v2/public/api/datasets/${datasetId}/metadata`,
    freshness:
      'Upstream-defined; inspect the linked official metadata before presenting as current.',
    retrieval: 'Official API request with bounded in-memory caching.',
    retrieved_at: new Date().toISOString(),
  };
}

function singStatSource(tableId: string, freshness: string): Record<string, string> {
  return {
    agency: 'Singapore Department of Statistics',
    table_id: tableId,
    api: `${SINGSTAT_TABLE}${tableId}`,
    freshness,
    retrieval: 'Official SingStat API request with bounded in-memory caching.',
  };
}

function registerToolPair<T extends z.ZodObject<z.ZodRawShape>>(
  server: McpServer,
  canonicalName: string,
  compatibilityName: string,
  config: { title: string; description: string; inputSchema: T },
  handler: (input: z.output<T>) => Promise<ReturnType<typeof jsonResult>>,
): void {
  server.registerTool(canonicalName, config as never, handler as never);
  server.registerTool(
    compatibilityName,
    { ...config, title: `Compatibility: ${config.title}` } as never,
    handler as never,
  );
}

export function registerSemanticInsightTools(server: McpServer): void {
  const dataGov = dataGovClient();
  const catalogue = dataGovCatalogueClient();
  const singStat = singStatClient();

  registerToolPair(
    server,
    'singapore_dataset_search',
    'sg_search_datasets',
    {
      title: 'Search the official data.gov.sg dataset catalogue',
      description:
        'Page the official catalogue and locally match every search term against dataset name, agency, ID, description and format. The catalogue API itself exposes pagination but no reliable text-search parameter.',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200),
        agency: z.string().trim().min(1).max(120).optional(),
        format: z.enum(['CSV', 'GEOJSON', 'JSON']).optional(),
        maxPages: z.number().int().min(1).max(500).default(100),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async ({ query, agency, format, maxPages, limit }) => {
      const datasets: Row[] = [];
      let pagesAvailable: number | null = null;
      let pagesScanned = 0;
      for (let page = 1; page <= maxPages; page += 1) {
        const payload = await catalogue.get('datasets', { page });
        const rows = catalogueDatasets(payload);
        datasets.push(...rows);
        pagesScanned = page;
        const upstreamPages = numericValue(record(record(payload).data).pages);
        if (upstreamPages !== null) pagesAvailable = upstreamPages;
        if (!rows.length || (pagesAvailable !== null && page >= pagesAvailable)) break;
      }
      const matches = filterCatalogueDatasets(datasets, query, agency, format);
      return jsonResult({
        query,
        agency: agency ?? null,
        format: format ?? null,
        pages_scanned: pagesScanned,
        pages_available: pagesAvailable,
        catalogue_complete:
          pagesAvailable !== null ? pagesScanned >= pagesAvailable : pagesScanned < maxPages,
        datasets_scanned: datasets.length,
        matching_count_in_scanned_pages: matches.length,
        returned: Math.min(limit, matches.length),
        datasets: matches.slice(0, limit),
        source: {
          agency: 'data.gov.sg',
          api: 'https://api-production.data.gov.sg/v2/public/api/datasets',
          retrieval:
            'Official paginated catalogue with deterministic local text filtering; no undocumented upstream search parameter is used.',
        },
      });
    },
  );

  const proximitySchema = z.object({
    location: z.string().trim().min(2).max(200).optional(),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/)
      .optional(),
    postal_code: z
      .string()
      .trim()
      .regex(/^\d{6}$/)
      .optional(),
    latitude: z.number().finite().min(1.1).max(1.6).optional(),
    longitude: z.number().finite().min(103.5).max(104.1).optional(),
    radiusMetres: z.number().int().min(100).max(10_000).default(2_000),
    limit: z.number().int().min(1).max(100).default(25),
  });

  registerToolPair(
    server,
    'moe_schools_near',
    'sg_moe_schools_near',
    {
      title: 'Find schools near a Singapore location',
      description:
        'Resolve an address or use WGS84 coordinates, query official OneMap education themes within a bounding extent, and rank results by true haversine distance. Requires ONEMAP_TOKEN.',
      inputSchema: proximitySchema,
    },
    async ({ location, postalCode, postal_code, latitude, longitude, radiusMetres, limit }) =>
      jsonResult({
        ...(await findNearbyOneMapThemes(
          oneMapClient(),
          {
            location: location ?? postalCode ?? postal_code,
            latitude,
            longitude,
            radiusMetres,
            limit,
          },
          'schools',
        )),
        source: {
          agency: 'Singapore Land Authority OneMap and source theme agencies',
          api: 'https://www.onemap.gov.sg/api/public/themesvc/retrieveTheme',
          reference_dataset: MOE_SCHOOLS_ID,
          retrieval: 'Official geocoding and theme coordinates with local haversine ranking.',
        },
        caveat:
          'Results reflect the school-related OneMap themes available to the supplied token; verify admissions, programmes and operating status with MOE.',
      }),
  );

  registerToolPair(
    server,
    'ecda_centres_near',
    'sg_ecda_centres_near',
    {
      title: 'Find early-childhood centres near a Singapore location',
      description:
        'Resolve an address or use WGS84 coordinates, query official OneMap kindergarten/childcare themes, and rank actual coordinates by haversine distance. Requires ONEMAP_TOKEN.',
      inputSchema: proximitySchema,
    },
    async ({ location, postalCode, postal_code, latitude, longitude, radiusMetres, limit }) =>
      jsonResult({
        ...(await findNearbyOneMapThemes(
          oneMapClient(),
          {
            location: location ?? postalCode ?? postal_code,
            latitude,
            longitude,
            radiusMetres,
            limit,
          },
          'early-childhood',
        )),
        source: {
          agency: 'Singapore Land Authority OneMap and Early Childhood Development Agency',
          api: 'https://www.onemap.gov.sg/api/public/themesvc/retrieveTheme',
          reference_dataset: ECDA_CENTRES_ID,
          retrieval: 'Official theme coordinates with local haversine ranking.',
        },
        caveat:
          'OneMap themes and the ECDA centre listing may have different update timings. Use ecda_vacancy_summary for published vacancy fields.',
      }),
  );

  registerToolPair(
    server,
    'ecda_vacancy_summary',
    'sg_ecda_vacancy_summary',
    {
      title: 'Summarise published ECDA vacancy availability',
      description:
        'Summarise the official ECDA vacancy field for one programme level and forecast month, preserving categorical Available/Limited/Full values instead of pretending they are numeric counts.',
      inputSchema: z.object({
        level: z.enum(['infant', 'pg', 'n1', 'n2', 'k1', 'k2']),
        month: z
          .enum(['current', 'next', 'third', 'fourth', 'fifth', 'sixth', 'seventh'])
          .default('current'),
        query: z.string().trim().min(2).max(160).optional(),
        postalPrefix: z
          .string()
          .trim()
          .regex(/^\d{1,6}$/)
          .optional(),
        postal_prefix: z
          .string()
          .trim()
          .regex(/^\d{1,6}$/)
          .optional(),
        sampleSize: z.number().int().min(1).max(5_000).default(2_500),
      }),
    },
    async ({ level, month, query, postalPrefix, postal_prefix, sampleSize }) => {
      const selectedPostalPrefix = postalPrefix ?? postal_prefix;
      const payload = await dataGov.get('datastore_search', {
        resource_id: ECDA_CENTRES_ID,
        q: query,
        limit: sampleSize,
        offset: 0,
      });
      const fetched = dataGovRows(payload);
      const rows = selectedPostalPrefix
        ? fetched.filter((row) => String(row.postal_code ?? '').startsWith(selectedPostalPrefix))
        : fetched;
      return jsonResult({
        query: query ?? null,
        postal_prefix: selectedPostalPrefix ?? null,
        sample: {
          requested_rows: sampleSize,
          fetched_rows: fetched.length,
          included_rows: rows.length,
          bounded: fetched.length >= sampleSize,
        },
        ...summarizeEcdaVacancies(rows, level, month),
        source: source(ECDA_CENTRES_ID, 'Early Childhood Development Agency'),
        caveat:
          'Published vacancy labels are indicative and can change. Contact the centre to confirm a place before making decisions.',
      });
    },
  );

  registerToolPair(
    server,
    'gdp_industry_compare',
    'sg_gdp_industry_compare',
    {
      title: 'Rank Singapore industries by quarterly GDP growth',
      description:
        'Rank every numeric industry row by official year-on-year GDP growth for a requested quarter, while preserving the matched source column.',
      inputSchema: z.object({ quarter: z.string().trim().min(5).max(12) }),
    },
    async ({ quarter }) => {
      const payload = await dataGov.get('datastore_search', {
        resource_id: GDP_ID,
        limit: 500,
        offset: 0,
      });
      return jsonResult({
        ...rankWideRows(dataGovRows(payload), quarter, 'quarter'),
        metric: 'year-on-year GDP growth rate',
        unit: 'percent',
        source: source(GDP_ID, 'Singapore Department of Statistics'),
        caveat:
          'Rows can include headline totals and nested industry aggregates; do not add them together.',
      });
    },
  );

  registerToolPair(
    server,
    'disease_cases_latest',
    'sg_disease_latest',
    {
      title: 'Get the latest cases in the published MOH disease dataset',
      description:
        'Return the last epidemiological week present in the official data.gov.sg dataset. The source is frozen around 2022 and is never presented as current surveillance.',
      inputSchema: z.object({ disease: z.string().trim().min(2).max(120).optional() }),
    },
    async ({ disease }) => {
      const rows = dataGovRows(
        await dataGov.get('datastore_search', {
          resource_id: DISEASE_ID,
          q: disease,
          sort: 'epi_week desc',
          limit: 500,
          offset: 0,
        }),
      );
      const latestWeek =
        rows
          .map((row) => String(row.epi_week ?? ''))
          .sort()
          .at(-1) ?? null;
      const cases = rows
        .filter((row) => String(row.epi_week ?? '') === latestWeek)
        .filter((row) => !disease || normalizeText(row.disease).includes(normalizeText(disease)))
        .map((row) => ({ disease: row.disease ?? null, cases: diseaseCaseValue(row) }));
      return jsonResult({
        requested_disease: disease ?? null,
        epi_week: latestWeek,
        count: cases.length,
        cases,
        data_freshness: diseaseFreshness(rows),
        source: source(DISEASE_ID, 'Ministry of Health'),
        caveat: 'Historical public dataset only; this tool does not provide medical advice.',
      });
    },
  );

  registerToolPair(
    server,
    'disease_cases_trend',
    'sg_disease_trend',
    {
      title: 'Analyse a published infectious-disease trend',
      description:
        'Aggregate exact epidemiological weeks for disease labels matching the query and expose the frozen source coverage prominently.',
      inputSchema: z.object({
        disease: z.string().trim().min(2).max(120),
        weeksBack: z.number().int().min(1).max(520).default(52),
        weeks_back: z.number().int().min(1).max(520).optional(),
      }),
    },
    async ({ disease, weeksBack, weeks_back }) => {
      const selectedWeeksBack = weeks_back ?? weeksBack;
      const rows = dataGovRows(
        await dataGov.get('datastore_search', {
          resource_id: DISEASE_ID,
          q: disease,
          sort: 'epi_week desc',
          limit: 2_000,
          offset: 0,
        }),
      );
      return jsonResult({
        ...summarizeDiseaseTrend(rows, disease, selectedWeeksBack),
        source: source(DISEASE_ID, 'Ministry of Health'),
        caveat:
          'The historical source is frozen and is not a substitute for current MOH surveillance or medical advice.',
      });
    },
  );

  registerToolPair(
    server,
    'disease_cases_list',
    'sg_disease_list',
    {
      title: 'List diseases in the published MOH bulletin dataset',
      description:
        'List the actual disease labels and source-coverage totals in the official historical dataset, with an explicit frozen-data warning.',
      inputSchema: z.object({}),
    },
    async () => {
      const rows = dataGovRows(
        await dataGov.get('datastore_search', {
          resource_id: DISEASE_ID,
          limit: 25_000,
          offset: 0,
        }),
      );
      return jsonResult({
        ...summarizeDiseaseList(rows),
        source: source(DISEASE_ID, 'Ministry of Health'),
        caveat:
          'Totals cover only the historical dataset period and must not be interpreted as current or lifetime incidence.',
      });
    },
  );

  registerToolPair(
    server,
    'crime_compare',
    'sg_crime_compare',
    {
      title: 'Rank Singapore recorded-crime series for a year',
      description:
        'Rank every numeric official recorded-crime series for a requested year, preserving category definitions and structural-break warnings.',
      inputSchema: z.object({
        year: z
          .string()
          .trim()
          .regex(/^\d{4}$/),
      }),
    },
    async ({ year }) => {
      const payload = await dataGov.get('datastore_search', {
        resource_id: CRIME_ID,
        limit: 500,
        offset: 0,
      });
      return jsonResult({
        ...rankWideRows(dataGovRows(payload), year, 'year'),
        metric: 'number of cases recorded, except rows explicitly labelled as rates',
        source: source(CRIME_ID, 'Singapore Police Force / Department of Statistics'),
        caveats: [
          'From 2022, SPF reports Physical Crimes and Scams & Cybercrimes instead of the former Overall Crime category, so not every row is comparable across the break.',
          'Recorded aggregate cases do not measure an individual person or neighbourhood risk.',
          'Rows labelled as rates use a different unit and should not be compared numerically with case-count rows.',
        ],
      });
    },
  );

  registerToolPair(
    server,
    'hdb_resale_stats',
    'sg_hdb_resale_stats',
    {
      title: 'Query and summarise HDB resale transactions',
      description:
        'Use this tool for filtered HDB resale transactions, latest-period results, price ranges, medians, quartiles and price-per-square-metre statistics. It applies exact town and flat-type filters at data.gov.sg and performs the bounded aggregation inside the MCP; a direct API download is not required.',
      inputSchema: z.object({
        town: z.string().trim().min(2).max(80).optional(),
        flatType: z.string().trim().min(2).max(40).optional(),
        street: z.string().trim().min(2).max(100).optional(),
        startMonth: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
        endMonth: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
        latestMonths: z
          .number()
          .int()
          .min(1)
          .max(120)
          .default(1)
          .describe(
            'Number of latest available matching months to include when startMonth and endMonth are omitted.',
          ),
        sampleSize: z.number().int().min(20).max(5_000).default(1_000),
        transactionLimit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(100)
          .describe('Maximum selected transaction rows to return alongside the statistics.'),
      }),
    },
    async ({
      town,
      flatType,
      street,
      startMonth,
      endMonth,
      latestMonths,
      sampleSize,
      transactionLimit,
    }) => {
      if (startMonth && endMonth && startMonth > endMonth) {
        throw new Error('startMonth must be earlier than or equal to endMonth.');
      }
      const filters: Record<string, string> = {};
      if (town) filters.town = town.toUpperCase();
      if (flatType) filters.flat_type = flatType.toUpperCase();
      if (startMonth && endMonth && startMonth === endMonth) filters.month = startMonth;
      const payload = await dataGov.get('datastore_search', {
        resource_id: HDB_RESALE_ID,
        filters: Object.keys(filters).length ? JSON.stringify(filters) : undefined,
        sort: 'month desc',
        limit: sampleSize,
        offset: 0,
      });
      const sourceRows = dataGovRows(payload);
      const normalizedStreet = normalizeText(street);
      const fetchedRows = sourceRows.filter(
        (row) => !normalizedStreet || normalizeText(row.street_name).includes(normalizedStreet),
      );
      const sourceAvailableMonths = [
        ...new Set(sourceRows.map((row) => String(row.month ?? '')).filter(Boolean)),
      ].sort((left, right) => right.localeCompare(left));
      const availableMonths = [
        ...new Set(fetchedRows.map((row) => String(row.month ?? '')).filter(Boolean)),
      ].sort((left, right) => right.localeCompare(left));
      const explicitDateWindow = Boolean(startMonth || endMonth);
      const selectedMonths = explicitDateWindow
        ? availableMonths.filter(
            (month) => (!startMonth || month >= startMonth) && (!endMonth || month <= endMonth),
          )
        : availableMonths.slice(0, latestMonths);
      const selectedMonthSet = new Set(selectedMonths);
      const rows = fetchedRows.filter((row) => {
        const month = String(row.month ?? '');
        return explicitDateWindow
          ? (!startMonth || month >= startMonth) && (!endMonth || month <= endMonth)
          : selectedMonthSet.has(month);
      });
      const resultEnvelope = record(record(payload).result);
      const reportedTotal = numericValue(resultEnvelope.total);
      const fetchedAllMatchingRows =
        reportedTotal !== null
          ? sourceRows.length >= reportedTotal
          : sourceRows.length < sampleSize;
      const earliestFetchedMonth = sourceAvailableMonths.at(-1) ?? null;
      const earliestSelectedMonth = selectedMonths.at(-1) ?? null;
      const latestSelectedMonth = selectedMonths[0] ?? null;
      const selectionComplete = hdbSelectionIsComplete({
        fetchedAllMatchingRows,
        explicitDateWindow,
        ...(startMonth ? { startMonth } : {}),
        earliestFetchedMonth,
        earliestSelectedMonth,
      });
      const singaporeMonthParts = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
      }).formatToParts(new Date());
      const currentSingaporeMonth = `${singaporeMonthParts.find((part) => part.type === 'year')?.value}-${singaporeMonthParts.find((part) => part.type === 'month')?.value}`;
      const latestMonthMayBePartial = latestSelectedMonth === currentSingaporeMonth;
      const transactions = [...rows]
        .sort((left, right) => {
          const byMonth = String(right.month ?? '').localeCompare(String(left.month ?? ''));
          if (byMonth) return byMonth;
          return (numericValue(left.resale_price) ?? 0) - (numericValue(right.resale_price) ?? 0);
        })
        .slice(0, transactionLimit);
      return jsonResult({
        filters: {
          town: town?.toUpperCase() ?? null,
          flat_type: flatType?.toUpperCase() ?? null,
          street: street ?? null,
          start_month: startMonth ?? null,
          end_month: endMonth ?? null,
        },
        period_selection: {
          mode: explicitDateWindow ? 'explicit_date_window' : 'latest_available_months',
          requested_latest_months: explicitDateWindow ? null : latestMonths,
          selected_months: selectedMonths,
          first_month: earliestSelectedMonth,
          latest_month: latestSelectedMonth,
          complete_within_source_matches: selectionComplete,
          latest_month_may_be_partial: latestMonthMayBePartial,
        },
        sample: {
          requested_rows: sampleSize,
          source_matching_rows: reportedTotal,
          fetched_rows: sourceRows.length,
          locally_matching_rows: fetchedRows.length,
          included_rows: rows.length,
          all_filtered_history_fetched: fetchedAllMatchingRows,
          limitation: selectionComplete
            ? 'The selected period is complete within the exact source filters returned by data.gov.sg.'
            : 'Statistics use a bounded source sample and may omit matching rows in the selected period. Increase sampleSize or narrow the date window.',
        },
        ...summarizeHdbResales(rows),
        transactions,
        transactions_returned: transactions.length,
        transactions_truncated: rows.length > transactions.length,
        latest_transactions: transactions.slice(0, 5),
        calculation: {
          aggregation_location: 'inside the Olano MCP tool',
          quartile_method:
            'inclusive linear interpolation using the zero-based position (n - 1) × percentile',
          retrieval:
            'exact town, flat-type and single-month filters plus descending month sort are applied by data.gov.sg; partial-street and multi-month selection are applied to the bounded response inside the MCP',
        },
        source: source(HDB_RESALE_ID, 'Housing & Development Board'),
        data_caveat: latestMonthMayBePartial
          ? 'The latest selected month is the current Singapore calendar month and may still receive additional registered transactions.'
          : 'Coverage reflects registrations published by the source as of retrieval time.',
        caveat:
          'Public transaction evidence is not a professional valuation or price recommendation.',
      });
    },
  );

  registerToolPair(
    server,
    'coe_latest',
    'sg_coe_latest',
    {
      title: 'Get the latest COE bidding results',
      description:
        'Summarise the latest official COE exercise, with transparent demand, success, utilisation and premium-change measures.',
      inputSchema: z.object({ category: z.enum(['A', 'B', 'C', 'D', 'E']).optional() }),
    },
    async ({ category }) => {
      const rows = dataGovRows(
        await dataGov.get('datastore_search', {
          resource_id: COE_ID,
          sort: 'month desc,bidding_no desc',
          limit: 30,
          offset: 0,
        }),
      ).sort((a, b) => exerciseOrdinal(b) - exerciseOrdinal(a));
      const exerciseKeys = [...new Set(rows.map(exerciseKey))];
      const latestKey = exerciseKeys[0];
      const previousKey = exerciseKeys[1];
      const previous = new Map(
        rows
          .filter((row) => exerciseKey(row) === previousKey)
          .map((row) => [String(row.vehicle_class), coeMetric(row)]),
      );
      const results = rows
        .filter((row) => exerciseKey(row) === latestKey)
        .filter(
          (row) =>
            !category ||
            normalizeText(row.vehicle_class) === normalizeText(normalizeCoeCategory(category)),
        )
        .flatMap((row) => {
          const metric = coeMetric(row);
          if (!metric) return [];
          const prior = previous.get(metric.vehicle_class);
          return [
            {
              ...metric,
              previous_premium_sgd: prior?.premium_sgd ?? null,
              premium_change_sgd: prior ? metric.premium_sgd - prior.premium_sgd : null,
              premium_change_percent:
                prior && prior.premium_sgd !== 0
                  ? ((metric.premium_sgd - prior.premium_sgd) / prior.premium_sgd) * 100
                  : null,
            },
          ];
        });
      return jsonResult({
        exercise: latestKey?.replace('#', ' bidding '),
        compared_with: previousKey?.replace('#', ' bidding ') ?? null,
        results,
        source: source(COE_ID, 'Land Transport Authority'),
      });
    },
  );

  registerToolPair(
    server,
    'coe_history',
    'sg_coe_history',
    {
      title: 'Get COE bidding history',
      description: 'Get a bounded, newest-first history for one official COE vehicle category.',
      inputSchema: z.object({
        category: z.enum(['A', 'B', 'C', 'D', 'E']),
        exercises: z.number().int().min(1).max(120).default(24),
      }),
    },
    async ({ category, exercises }) => {
      const rows = dataGovRows(
        await dataGov.get('datastore_search', {
          resource_id: COE_ID,
          q: normalizeCoeCategory(category),
          sort: 'month desc,bidding_no desc',
          limit: Math.min(exercises * 3, 500),
          offset: 0,
        }),
      )
        .filter(
          (row) =>
            normalizeText(row.vehicle_class) === normalizeText(normalizeCoeCategory(category)),
        )
        .sort((a, b) => exerciseOrdinal(b) - exerciseOrdinal(a))
        .flatMap((row) => {
          const metric = coeMetric(row);
          return metric ? [metric] : [];
        })
        .slice(0, exercises);
      return jsonResult({
        category: normalizeCoeCategory(category),
        newest_first: rows,
        source: source(COE_ID, 'Land Transport Authority'),
      });
    },
  );

  registerToolPair(
    server,
    'coe_demand_supply',
    'sg_coe_demand_supply',
    {
      title: 'Analyse COE demand and supply',
      description:
        'Compare bids received, quota and successful bids for a COE category using reproducible ratios.',
      inputSchema: z.object({
        category: z.enum(['A', 'B', 'C', 'D', 'E']),
        exercises: z.number().int().min(1).max(120).default(12),
      }),
    },
    async ({ category, exercises }) => {
      const payload = await dataGov.get('datastore_search', {
        resource_id: COE_ID,
        q: normalizeCoeCategory(category),
        sort: 'month desc,bidding_no desc',
        limit: Math.min(exercises * 3, 500),
        offset: 0,
      });
      const metrics = dataGovRows(payload)
        .filter(
          (row) =>
            normalizeText(row.vehicle_class) === normalizeText(normalizeCoeCategory(category)),
        )
        .sort((a, b) => exerciseOrdinal(b) - exerciseOrdinal(a))
        .flatMap((row) => {
          const metric = coeMetric(row);
          return metric ? [metric] : [];
        })
        .slice(0, exercises);
      return jsonResult({
        category: normalizeCoeCategory(category),
        exercises: metrics,
        summary: metrics.length
          ? {
              quota: summarizeValues(metrics.map((item) => item.quota)),
              bids_received: summarizeValues(metrics.map((item) => item.bids_received)),
              bid_to_quota_ratio: summarizeValues(
                metrics.flatMap((item) =>
                  item.bid_to_quota_ratio === null ? [] : [item.bid_to_quota_ratio],
                ),
              ),
              premium_sgd: summarizeValues(metrics.map((item) => item.premium_sgd)),
            }
          : null,
        source: source(COE_ID, 'Land Transport Authority'),
      });
    },
  );

  registerToolPair(
    server,
    'cpi_yoy',
    'sg_cpi_yoy',
    {
      title: 'Calculate Singapore CPI year-on-year change',
      description:
        'Select an official monthly CPI series and calculate same-month year-on-year index and percentage changes.',
      inputSchema: z.object({
        category: z.string().trim().min(1).max(120).default('All Items'),
        periods: z.number().int().min(1).max(120).default(12),
      }),
    },
    async ({ category, periods }) => {
      const result = await fetchWideSeries(dataGov, CPI_ID, category);
      const changes = yearOverYear(result.observations, periods);
      return jsonResult({
        requested_category: category,
        matched_series: String(result.row.DataSeries ?? ''),
        latest: changes.at(-1) ?? null,
        year_on_year: changes,
        calculation: '(current index - same month previous year) / previous-year index × 100',
        source: source(CPI_ID, 'Singapore Department of Statistics'),
      });
    },
  );

  registerToolPair(
    server,
    'employment_growth',
    'sg_employment_growth',
    {
      title: 'Calculate Singapore employment growth by sector',
      description:
        'Select an official annual employment sector series and calculate absolute and percentage annual changes.',
      inputSchema: z.object({
        sector: z.string().trim().min(1).max(120),
        years: z.number().int().min(1).max(25).default(10),
      }),
    },
    async ({ sector, years }) => {
      const result = await fetchWideSeries(dataGov, EMPLOYMENT_ID, sector);
      const growth = periodGrowth(result.observations, years);
      return jsonResult({
        requested_sector: sector,
        matched_series: String(result.row.DataSeries ?? ''),
        latest: growth.at(-1) ?? null,
        annual_growth: growth,
        unit: 'thousand persons, as represented by the official table',
        source: source(EMPLOYMENT_ID, 'Singapore Department of Statistics'),
      });
    },
  );

  registerToolPair(
    server,
    'retail_sales_yoy',
    'sg_retail_sales_yoy',
    {
      title: 'Calculate Singapore retail sales year-on-year change',
      description:
        'Select an official monthly Retail Sales Index series and calculate same-month year-on-year changes.',
      inputSchema: z.object({
        series: z.string().trim().min(1).max(120).default('Total'),
        periods: z.number().int().min(1).max(120).default(12),
      }),
    },
    async ({ series, periods }) => {
      const result = await fetchWideSeries(dataGov, RETAIL_ID, series);
      const changes = yearOverYear(result.observations, periods);
      return jsonResult({
        requested_series: series,
        matched_series: String(result.row.DataSeries ?? ''),
        latest: changes.at(-1) ?? null,
        year_on_year: changes,
        calculation: '(current index - same month previous year) / previous-year index × 100',
        source: source(RETAIL_ID, 'Singapore Department of Statistics'),
      });
    },
  );

  registerToolPair(
    server,
    'business_formations_net',
    'sg_net_formations',
    {
      title: 'Calculate net Singapore business formations',
      description:
        'Align official monthly SingStat formations and cessations for one industry and calculate net formations.',
      inputSchema: z.object({
        industry: z.string().trim().min(1).max(160).default('Total'),
        periods: z.number().int().min(1).max(120).default(24),
      }),
    },
    async ({ industry, periods }) => {
      const [formationPayload, cessationPayload] = await Promise.all([
        singStat.get(FORMATIONS_ID),
        singStat.get(CESSATIONS_ID),
      ]);
      const formationRow = bestSeriesRow(singStatRows(formationPayload), industry);
      const cessationRow = bestSeriesRow(singStatRows(cessationPayload), industry);
      if (!formationRow || !cessationRow)
        throw new Error(`No matching formation and cessation series was found for "${industry}".`);
      const net = formationNet(
        singStatObservations(formationRow),
        singStatObservations(cessationRow),
        periods,
      );
      return jsonResult({
        requested_industry: industry,
        formation_series: String(formationRow.rowText ?? ''),
        cessation_series: String(cessationRow.rowText ?? ''),
        latest: net.at(-1) ?? null,
        periods: net,
        sources: [
          singStatSource(FORMATIONS_ID, 'Monthly'),
          singStatSource(CESSATIONS_ID, 'Monthly'),
        ],
      });
    },
  );

  registerToolPair(
    server,
    'business_formations_compare',
    'sg_formations_compare',
    {
      title: 'Compare Singapore business formations by industry',
      description:
        'Compare official formations, cessations and net formations for up to ten SingStat industry series over the same periods.',
      inputSchema: z.object({
        industries: z.array(z.string().trim().min(1).max(160)).min(2).max(10),
        periods: z.number().int().min(1).max(120).default(12),
      }),
    },
    async ({ industries, periods }) => {
      const [formationPayload, cessationPayload] = await Promise.all([
        singStat.get(FORMATIONS_ID),
        singStat.get(CESSATIONS_ID),
      ]);
      const formationRows = singStatRows(formationPayload);
      const cessationRows = singStatRows(cessationPayload);
      const comparisons = industries.map((industry) => {
        const formationRow = bestSeriesRow(formationRows, industry);
        const cessationRow = bestSeriesRow(cessationRows, industry);
        if (!formationRow || !cessationRow)
          return { requested_industry: industry, matched: false, periods: [] };
        const points = formationNet(
          singStatObservations(formationRow),
          singStatObservations(cessationRow),
          periods,
        );
        const formations = points.reduce((sum, point) => sum + point.formations, 0);
        const cessations = points.reduce((sum, point) => sum + point.cessations, 0);
        return {
          requested_industry: industry,
          matched: true,
          formation_series: String(formationRow.rowText ?? ''),
          cessation_series: String(cessationRow.rowText ?? ''),
          totals: { formations, cessations, net_formations: formations - cessations },
          periods: points,
        };
      });
      return jsonResult({
        window_periods: periods,
        comparisons,
        sources: [
          singStatSource(FORMATIONS_ID, 'Monthly'),
          singStatSource(CESSATIONS_ID, 'Monthly'),
        ],
      });
    },
  );

  registerToolPair(
    server,
    'fx_rate',
    'sg_fx_rate',
    {
      title: 'Get a normalized MAS exchange rate',
      description:
        'Get an official MAS average exchange-rate observation and make per-one versus per-100 foreign-currency units explicit.',
      inputSchema: z.object({
        currency: z.string().trim().min(2).max(80),
        period: z.string().trim().min(4).max(20).optional(),
      }),
    },
    async ({ currency, period }) => {
      const result = await fetchWideSeries(dataGov, FX_ID, currency);
      const quote = fxQuote(result.row, period);
      if (!quote)
        throw new Error(
          `No published exchange rate was found for ${currency} in ${period ?? 'the latest period'}.`,
        );
      return jsonResult({
        requested_currency: currency,
        quote,
        interpretation:
          'The published value is the period-average number of Singapore dollars for the stated quoted foreign units.',
        source: source(FX_ID, 'Monetary Authority of Singapore'),
        caveat:
          'An official monthly average is not a live, executable or remittance exchange rate.',
      });
    },
  );

  registerToolPair(
    server,
    'fx_history',
    'sg_fx_history',
    {
      title: 'Get normalized MAS exchange-rate history',
      description:
        'Get a bounded official monthly exchange-rate history with explicit foreign-unit scaling.',
      inputSchema: z.object({
        currency: z.string().trim().min(2).max(80),
        periods: z.number().int().min(1).max(120).default(24),
      }),
    },
    async ({ currency, periods }) => {
      const result = await fetchWideSeries(dataGov, FX_ID, currency);
      const history = sortObservations(result.observations)
        .slice(-periods)
        .flatMap((point) => {
          const quote = fxQuote(result.row, point.period);
          return quote ? [quote] : [];
        });
      return jsonResult({
        requested_currency: currency,
        matched_series: String(result.row.DataSeries ?? ''),
        history,
        source: source(FX_ID, 'Monetary Authority of Singapore'),
        caveat: 'Official monthly averages are not live or executable exchange rates.',
      });
    },
  );

  registerToolPair(
    server,
    'fx_basket',
    'sg_fx_basket',
    {
      title: 'Value a foreign-currency basket in SGD',
      description:
        'Apply official MAS monthly average rates to a bounded set of foreign-currency amounts with correct per-one or per-100 scaling.',
      inputSchema: z.object({
        holdings: z
          .array(
            z.object({
              currency: z.string().trim().min(2).max(80),
              amount: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
            }),
          )
          .min(1)
          .max(20),
        period: z.string().trim().min(4).max(20).optional(),
      }),
    },
    async ({ holdings, period }) => {
      const valued = await Promise.all(
        holdings.map(async ({ currency, amount }) => {
          const result = await fetchWideSeries(dataGov, FX_ID, currency);
          const quote = fxQuote(result.row, period);
          if (!quote) return { currency, amount, matched: false, sgd_value: null };
          return {
            currency: quote.currency,
            amount,
            matched: true,
            period: quote.period,
            quoted_foreign_units: quote.quoted_foreign_units,
            sgd_per_quoted_units: quote.sgd_per_quoted_units,
            sgd_value: amount * quote.sgd_per_foreign_unit,
          };
        }),
      );
      return jsonResult({
        requested_period: period ?? 'latest available per currency',
        holdings: valued,
        total_sgd: valued.reduce(
          (sum, item) => sum + (typeof item.sgd_value === 'number' ? item.sgd_value : 0),
          0,
        ),
        source: source(FX_ID, 'Monetary Authority of Singapore'),
        caveat:
          'Illustrative valuation using official monthly averages; not a trade or remittance quote.',
      });
    },
  );

  registerToolPair(
    server,
    'iras_tax_mix',
    'sg_iras_tax_mix',
    {
      title: 'Calculate Singapore tax collection mix',
      description:
        'Calculate category shares from official IRAS collections for one financial year in the published S$ thousand unit.',
      inputSchema: z.object({
        financialYear: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
      }),
    },
    async ({ financialYear }) => {
      const payload = await dataGov.get('datastore_search', {
        resource_id: IRAS_ID,
        filters: financialYear ? JSON.stringify({ financial_year: financialYear }) : undefined,
        sort: 'financial_year desc',
        limit: 200,
        offset: 0,
      });
      return jsonResult({
        ...calculateTaxMix(dataGovRows(payload), financialYear),
        unit: 'S$ thousand',
        source: source(IRAS_ID, 'Inland Revenue Authority of Singapore'),
      });
    },
  );

  registerToolPair(
    server,
    'visitors_top_sources',
    'sg_visitors_top_sources',
    {
      title: 'Rank Singapore visitor source markets',
      description:
        'Rank official monthly international visitor arrivals by country or region without mixing hierarchy levels.',
      inputSchema: z.object({
        period: z.string().trim().min(4).max(20).optional(),
        level: z.enum(['countries', 'regions', 'all']).default('countries'),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    },
    async ({ period, level, limit }) => {
      const payload = await dataGov.get('datastore_search', {
        resource_id: VISITORS_ID,
        limit: 100,
        offset: 0,
      });
      return jsonResult({
        ...rankVisitorSources(dataGovRows(payload), {
          ...(period ? { period } : {}),
          level,
          limit,
        }),
        source: source(VISITORS_ID, 'Singapore Tourism Board'),
        note: 'Other Markets aggregates are excluded from country rankings to avoid double counting.',
      });
    },
  );

  registerToolPair(
    server,
    'ura_new_sale_pipeline',
    'sg_ura_new_sale_pipeline',
    {
      title: 'Summarise URA new-sale status',
      description:
        'Summarise completed and uncompleted private residential new-sale units by quarter from the official URA table.',
      inputSchema: z.object({
        quarters: z.number().int().min(1).max(40).default(8),
      }),
    },
    async ({ quarters }) => {
      const payload = await dataGov.get('datastore_search', {
        resource_id: URA_PROPERTY_ID,
        sort: 'quarter desc',
        limit: Math.min(quarters * 10, 500),
        offset: 0,
      });
      return jsonResult({
        ...summarizeUraNewSales(dataGovRows(payload), quarters),
        source: source(URA_PROPERTY_ID, 'Urban Redevelopment Authority'),
        caveat:
          'Uncompleted new-sale units are a transaction status measure in this table, not unsold inventory, future launches, completions or an investment forecast.',
      });
    },
  );
}
