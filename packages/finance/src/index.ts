import type { McpServer } from '@modelcontextprotocol/server';
import {
  assertSuccessfulEnvelope,
  getOptionalEnv,
  JsonHttpClient,
  jsonResult,
} from '@olano/mcp-core';
import * as z from 'zod/v4';

const BANK_RATES_DATASET_ID = 'd_5fe5a4bb4a1ecc4d8a56a095832e2b24';
const BANK_RATES_SOURCE = `https://data.gov.sg/datasets/${BANK_RATES_DATASET_ID}/view`;
const DATA_GOV_API = 'https://data.gov.sg/api/action/';
const MONEY_SENSE_HOME_LOANS =
  'https://www.moneysense.gov.sg/buying-a-property-how-much-can-you-afford/';
const MONEY_SENSE_SERVICING =
  'https://www.moneysense.gov.sg/understanding-the-total-debt-servicing-ratio-tdsr/';
const MAS_FID = 'https://eservices.mas.gov.sg/fid';
const COMPARE_FIRST = 'https://www.comparefirst.sg/';
const SGX_SECURITIES = 'https://www.sgx.com/securities/securities-prices';

type Row = Record<string, unknown>;

export interface MortgageInput {
  principal: number;
  annualRate: number;
  years: number;
}

export interface InterestRateObservation {
  period: string;
  value: number;
}

export interface InterestRateSeries {
  name: string;
  unit: 'per cent per annum';
  observations: InterestRateObservation[];
}

function record(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

function rowsFrom(value: unknown): Row[] {
  assertSuccessfulEnvelope(value, 'data.gov.sg');
  const rows = record(record(value).result).records;
  return Array.isArray(rows)
    ? rows.filter((row): row is Row => Boolean(row) && typeof row === 'object')
    : [];
}

const months: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function normalizePeriod(field: string): string | null {
  const compact = field.replaceAll(/[^A-Za-z0-9]/g, '');
  const match = /^(\d{4})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i.exec(compact);
  if (!match) return null;
  const monthName = `${match[2]![0]!.toUpperCase()}${match[2]!.slice(1).toLowerCase()}`;
  const month = months[monthName];
  return month ? `${match[1]}-${String(month).padStart(2, '0')}` : null;
}

export function parseInterestRateRows(payload: unknown, periods = 24): InterestRateSeries[] {
  return rowsFrom(payload).flatMap((row) => {
    const name = String(row.DataSeries ?? row.data_series ?? row['Data Series'] ?? '').trim();
    if (!name) return [];
    const observations = Object.entries(row)
      .flatMap(([field, raw]) => {
        const period = normalizePeriod(field);
        const value = Number(raw);
        return period && Number.isFinite(value) ? [{ period, value }] : [];
      })
      .sort((left, right) => right.period.localeCompare(left.period))
      .slice(0, periods);
    return [{ name, unit: 'per cent per annum' as const, observations }];
  });
}

export function mortgagePayment({ principal, annualRate, years }: MortgageInput): number {
  const payments = years * 12;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / payments;
  return (
    (principal * monthlyRate * (1 + monthlyRate) ** payments) / ((1 + monthlyRate) ** payments - 1)
  );
}

function loanSummary(input: MortgageInput): Record<string, number> {
  const monthlyPayment = mortgagePayment(input);
  const totalPaid = monthlyPayment * input.years * 12;
  return {
    principal: input.principal,
    annual_rate_percent: input.annualRate,
    tenure_years: input.years,
    monthly_payment: monthlyPayment,
    total_paid: totalPaid,
    total_interest: totalPaid - input.principal,
  };
}

function dataGovClient(): JsonHttpClient {
  const apiKey = getOptionalEnv('DATA_GOV_SG_API_KEY');
  return new JsonHttpClient({
    baseUrl: DATA_GOV_API,
    defaultHeaders: apiKey ? { 'x-api-key': apiKey } : {},
    cacheTtlMs: 3_600_000,
    minRequestIntervalMs: 250,
    cacheNamespace: 'data-gov-sg-bank-rates',
  });
}

async function bankRates(series: string | undefined, periods: number): Promise<Row> {
  const retrievedAt = new Date().toISOString();
  const payload = await dataGovClient().get('datastore_search', {
    resource_id: BANK_RATES_DATASET_ID,
    limit: 100,
    offset: 0,
  });
  let rates = parseInterestRateRows(payload, periods);
  if (series) {
    const query = series.toLowerCase();
    rates = rates.filter((item) => item.name.toLowerCase().includes(query));
  }
  const latestPeriod = rates
    .flatMap((item) => item.observations.map(({ period }) => period))
    .sort()
    .at(-1);
  return {
    agency: 'SINGSTAT (source: Monetary Authority of Singapore)',
    dataset_id: BANK_RATES_DATASET_ID,
    source_url: BANK_RATES_SOURCE,
    retrieved_at: retrievedAt,
    latest_period: latestPeriod ?? null,
    unit: 'per cent per annum',
    series: rates,
    limitations:
      'Official market reference and bank-rate statistics, not current lender product offers. Confirm any mortgage package directly with the lender.',
  };
}

const mortgageSchema = z.object({
  principal: z.number().positive().max(100_000_000),
  annualRate: z.number().min(0).max(30),
  years: z.number().int().min(1).max(35),
});

export function registerSingaporeFinanceTools(server: McpServer): void {
  server.registerTool(
    'finance_mortgage_rates_latest',
    {
      title: 'Get latest official Singapore mortgage-rate context',
      description:
        'Retrieve latest SORA and bank interest-rate series from a free official data.gov.sg API dataset. These are reference rates, not lender offers.',
      inputSchema: z.object({
        series: z.string().trim().max(100).optional().describe('For example: SORA or housing'),
      }),
    },
    async ({ series }) => jsonResult(await bankRates(series, 1)),
  );

  server.registerTool(
    'finance_mortgage_rates_history',
    {
      title: 'Get official Singapore mortgage-rate history',
      description:
        'Retrieve bounded SORA and bank interest-rate history from a free official data.gov.sg API dataset.',
      inputSchema: z.object({
        series: z.string().trim().max(100).optional().describe('For example: 3 Month SORA'),
        periods: z.number().int().min(1).max(240).default(24),
      }),
    },
    async ({ series, periods }) => jsonResult(await bankRates(series, periods)),
  );

  server.registerTool(
    'finance_mortgage_payment',
    {
      title: 'Calculate an illustrative mortgage payment',
      description:
        'Calculate principal and interest using a transparent amortisation formula and a user-supplied rate. Pair with finance_mortgage_rates_latest for official reference-rate context.',
      inputSchema: mortgageSchema,
    },
    async (input) =>
      jsonResult({
        ...loanSummary(input),
        assumptions: 'Monthly amortising payments; constant illustrative rate; fees excluded.',
        educational_only: true,
      }),
  );

  server.registerTool(
    'finance_mortgage_stress_test',
    {
      title: 'Stress-test a mortgage',
      description: 'Compare monthly payments across user-supplied illustrative interest rates.',
      inputSchema: z.object({
        principal: z.number().positive().max(100_000_000),
        years: z.number().int().min(1).max(35),
        rates: z.array(z.number().min(0).max(30)).min(1).max(12),
      }),
    },
    async ({ principal, years, rates }) =>
      jsonResult({
        scenarios: rates.map((annualRate) => loanSummary({ principal, annualRate, years })),
        assumptions: 'Monthly amortising payments; constant illustrative rates; fees excluded.',
        educational_only: true,
      }),
  );

  server.registerTool(
    'finance_mortgage_affordability',
    {
      title: 'Estimate Singapore mortgage repayment headroom',
      description:
        'Apply user-configurable MSR and TDSR assumptions. This is not an eligibility, approval, or regulatory determination.',
      inputSchema: z.object({
        grossMonthlyIncome: z.number().positive().max(10_000_000),
        existingMonthlyDebt: z.number().min(0).max(10_000_000).default(0),
        monthlyMortgage: z.number().min(0).max(10_000_000).optional(),
        propertyType: z.enum(['hdb', 'executive_condominium', 'private']).default('private'),
        msrPercent: z.number().min(1).max(100).default(30),
        tdsrPercent: z.number().min(1).max(100).default(55),
      }),
    },
    async ({
      grossMonthlyIncome,
      existingMonthlyDebt,
      monthlyMortgage,
      propertyType,
      msrPercent,
      tdsrPercent,
    }) => {
      const tdsrHeadroom = Math.max(
        0,
        (grossMonthlyIncome * tdsrPercent) / 100 - existingMonthlyDebt,
      );
      const msrApplies = propertyType !== 'private';
      const msrHeadroom = (grossMonthlyIncome * msrPercent) / 100;
      const estimatedMaximum = msrApplies ? Math.min(tdsrHeadroom, msrHeadroom) : tdsrHeadroom;
      return jsonResult({
        estimated_maximum_monthly_mortgage: estimatedMaximum,
        supplied_mortgage: monthlyMortgage ?? null,
        supplied_mortgage_within_estimate:
          monthlyMortgage === undefined ? null : monthlyMortgage <= estimatedMaximum,
        assumptions: {
          property_type: propertyType,
          msr_applies: msrApplies,
          msr_percent: msrPercent,
          tdsr_percent: tdsrPercent,
        },
        sources: [MONEY_SENSE_HOME_LOANS, MONEY_SENSE_SERVICING],
        disclaimer:
          'Educational estimate only. Actual limits, stress rates, exemptions, income recognition, LTV and lender criteria can differ and change.',
      });
    },
  );

  server.registerTool(
    'finance_singapore_data_availability',
    {
      title: 'Check Singapore finance data availability',
      description:
        'Explain exactly which finance data Olano can access through stable free APIs and which categories require official or licensed sources.',
      inputSchema: z.object({}),
    },
    async () =>
      jsonResult({
        supported: [
          {
            category: 'mortgage reference rates',
            status: 'official free API',
            source: BANK_RATES_SOURCE,
            coverage: 'SORA and published bank interest-rate statistics; not product offers',
          },
        ],
        not_integrated: [
          {
            category: 'live SGX quotes',
            reason:
              'No stable official free SGX quote API with unrestricted production and redistribution terms was verified.',
            official_reference: SGX_SECURITIES,
          },
          {
            category: 'insurance product premiums',
            reason:
              'No stable public product API was verified; Olano does not scrape comparison sites.',
            official_reference: COMPARE_FIRST,
          },
        ],
        directories: [
          { category: 'MAS-regulated institutions', url: MAS_FID },
          { category: 'insurance comparison', url: COMPARE_FIRST },
          { category: 'mortgage education', url: MONEY_SENSE_HOME_LOANS },
          { category: 'SGX securities', url: SGX_SECURITIES },
        ],
      }),
  );
}
