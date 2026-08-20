import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alignSeries,
  altronisCompatibilityRegistry,
  calculateTaxMix,
  coeMetric,
  filterCatalogueDatasets,
  formationNet,
  fxQuote,
  haversineMetres,
  parsePeriod,
  rankNearbyFeatures,
  rankWideRows,
  registerSingaporeInsightTools,
  routeSingaporeQuestion,
  rankVisitorSources,
  summarizeDiseaseList,
  summarizeDiseaseTrend,
  summarizeEcdaVacancies,
  summarizeHdbResales,
  summarizeUraNewSales,
  validateCompatibilityRegistry,
  visualizeSeries,
  yearOverYear,
} from './index.js';

const expectedCompatibilityNames = [
  'sg_acra_formations_by_ssic',
  'sg_acra_get_entity',
  'sg_acra_search_entities',
  'sg_air_temperature',
  'sg_ask',
  'sg_births_history',
  'sg_births_latest',
  'sg_carpark_availability',
  'sg_cessations_monthly',
  'sg_coe_demand_supply',
  'sg_coe_history',
  'sg_coe_latest',
  'sg_cpi_history',
  'sg_cpi_latest',
  'sg_cpi_yoy',
  'sg_crime_compare',
  'sg_crime_history',
  'sg_crime_latest',
  'sg_cross_dataset',
  'sg_dataset_query',
  'sg_dataset_schema',
  'sg_deaths',
  'sg_dengue_clusters',
  'sg_disease_latest',
  'sg_disease_list',
  'sg_disease_trend',
  'sg_divorces',
  'sg_ecda_centres_near',
  'sg_ecda_search_centres',
  'sg_ecda_vacancy_summary',
  'sg_electricity_history',
  'sg_electricity_latest',
  'sg_employment_by_sector',
  'sg_employment_growth',
  'sg_employment_sector_history',
  'sg_formations_compare',
  'sg_formations_history',
  'sg_formations_latest',
  'sg_formations_monthly',
  'sg_fx_basket',
  'sg_fx_history',
  'sg_fx_rate',
  'sg_gdp_history',
  'sg_gdp_industry_compare',
  'sg_gdp_latest',
  'sg_hawker_search',
  'sg_hawker_stats',
  'sg_hdb_carpark_lookup',
  'sg_hdb_carparks_by_address',
  'sg_hdb_carparks_by_type',
  'sg_hdb_resale_search',
  'sg_hdb_resale_stats',
  'sg_household_income',
  'sg_iras_collection',
  'sg_iras_collection_history',
  'sg_iras_tax_mix',
  'sg_labour_force',
  'sg_list_datasets',
  'sg_marriages',
  'sg_median_income_history',
  'sg_median_income_lookup',
  'sg_moe_school_by_name',
  'sg_moe_schools_near',
  'sg_moe_search_schools',
  'sg_net_formations',
  'sg_population_history',
  'sg_population_latest',
  'sg_psi',
  'sg_rainfall',
  'sg_retail_sales_history',
  'sg_retail_sales_latest',
  'sg_retail_sales_yoy',
  'sg_search_datasets',
  'sg_tourism_history',
  'sg_tourism_latest',
  'sg_trade',
  'sg_unemployment_history',
  'sg_unemployment_latest',
  'sg_ura_new_sale_pipeline',
  'sg_ura_private_txn_history',
  'sg_ura_private_txn_latest',
  'sg_visitors_history',
  'sg_visitors_latest',
  'sg_visitors_top_sources',
  'sg_visualize',
  'sg_wages',
  'sg_weather_forecast',
].sort();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('compatibility registry', () => {
  it('covers all 87 audited sg_* capabilities without duplicates', () => {
    expect(() => validateCompatibilityRegistry()).not.toThrow();
    expect(altronisCompatibilityRegistry.map((item) => item.compatibility_tool).sort()).toEqual(
      expectedCompatibilityNames,
    );
  });

  it('registers every compatibility alias and canonical insight tool', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({ name: 'insights-test', version: '0.2.0' });
    registerSingaporeInsightTools(server);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toHaveLength(120);
    expect(names).toEqual(expect.arrayContaining(expectedCompatibilityNames));
    expect(names).toEqual(
      expect.arrayContaining([
        'singapore_prompt_examples',
        'singapore_ask',
        'singapore_capability_registry',
        'insights_align_series',
        'hdb_resale_stats',
        'business_formations_compare',
        'singapore_dataset_search',
        'moe_schools_near',
        'ecda_vacancy_summary',
        'disease_cases_trend',
        'gdp_industry_compare',
        'crime_compare',
      ]),
    );
    await client.close();
    await server.close();
  });

  it('executes a native sg_* semantic alias rather than returning a route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: {
              records: [
                {
                  DataSeries: 'All Items',
                  '2024Jan': '100',
                  '2025Jan': '110',
                },
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({ name: 'insights-test', version: '0.2.0' });
    registerSingaporeInsightTools(server);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: 'sg_cpi_yoy',
      arguments: { category: 'All Items', periods: 1 },
    });
    expect(result.structuredContent).toMatchObject({
      matched_series: 'All Items',
      latest: { period: '2025-01', change_percent: 10 },
    });
    expect(result.structuredContent).not.toHaveProperty('executed', false);
    await client.close();
    await server.close();
  });

  it('executes official catalogue search instead of returning a compatibility route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              pages: 1,
              datasets: [
                {
                  datasetId: 'd_school',
                  name: 'General information of schools',
                  managedByAgencyName: 'Ministry of Education',
                  format: 'CSV',
                },
                {
                  datasetId: 'd_weather',
                  name: 'Rainfall',
                  managedByAgencyName: 'National Environment Agency',
                },
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({ name: 'insights-test', version: '0.2.0' });
    registerSingaporeInsightTools(server);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: 'sg_search_datasets',
      arguments: { query: 'school', maxPages: 2 },
    });
    expect(result.structuredContent).toMatchObject({
      catalogue_complete: true,
      matching_count_in_scanned_pages: 1,
      datasets: [{ datasetId: 'd_school' }],
    });
    expect(result.structuredContent).not.toHaveProperty('executed', false);
    await client.close();
    await server.close();
  });

  it('executes true-distance OneMap school proximity', async () => {
    vi.stubEnv('ONEMAP_TOKEN', 'test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = String(input);
        const body = url.includes('getAllThemesInfo')
          ? {
              Theme_Names: [
                {
                  THEMENAME: 'Primary Schools',
                  QUERYNAME: 'primaryschools',
                  THEME_OWNER: 'MINISTRY OF EDUCATION',
                },
              ],
            }
          : {
              SrchResults: [
                { FeatCount: 1, Theme_Name: 'Primary Schools' },
                {
                  NAME: 'Example Primary School',
                  LatLng: '[[103.8005,1.3005]]',
                },
              ],
            };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({ name: 'insights-test', version: '0.2.0' });
    registerSingaporeInsightTools(server);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: 'sg_moe_schools_near',
      arguments: {
        latitude: 1.3,
        longitude: 103.8,
        radiusMetres: 1_000,
        limit: 5,
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      results: [{ NAME: 'Example Primary School', source_theme: 'primaryschools' }],
    });
    expect(result.structuredContent).not.toHaveProperty('executed', false);
    await client.close();
    await server.close();
  });

  it('executes disease trend with an explicit frozen-source warning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: {
              records: [
                { epi_week: '2022-W51', disease: 'Dengue Fever', 'no._of_cases': '100' },
                { epi_week: '2022-W52', disease: 'Dengue Fever', 'no._of_cases': '125' },
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({ name: 'insights-test', version: '0.2.0' });
    registerSingaporeInsightTools(server);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: 'sg_disease_trend',
      arguments: { disease: 'Dengue', weeks_back: 10 },
    });
    expect(result.structuredContent).toMatchObject({
      count: 2,
      data_freshness: { latest_published_week: '2022-W52', level: 'frozen' },
      series: [
        { epi_week: '2022-W51', cases: 100 },
        { epi_week: '2022-W52', cases: 125 },
      ],
    });
    expect(result.structuredContent).not.toHaveProperty('executed', false);
    await client.close();
    await server.close();
  });

  it('executes ECDA vacancy summaries with compatibility-style snake_case input', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: {
              records: [
                {
                  centre_name: 'Available Centre',
                  postal_code: '520001',
                  n1_vacancy_current_month: 'Available',
                },
                {
                  centre_name: 'Full Centre',
                  postal_code: '650001',
                  n1_vacancy_current_month: 'Full',
                },
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({ name: 'insights-test', version: '0.2.0' });
    registerSingaporeInsightTools(server);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: 'sg_ecda_vacancy_summary',
      arguments: { level: 'n1', postal_prefix: '52' },
    });
    expect(result.structuredContent).toMatchObject({
      postal_prefix: '52',
      centres_reviewed: 1,
      status_counts: { available: 1, limited: 0, full: 0, unknown: 0 },
      published_numeric_vacancy_total: null,
    });
    expect(result.structuredContent).not.toHaveProperty('executed', false);
    await client.close();
    await server.close();
  });
});

describe('period-aware analytics', () => {
  it('parses official monthly, quarterly and annual period formats', () => {
    expect(parsePeriod('2026Jun')).toMatchObject({ year: 2026, month: 6, frequency: 'monthly' });
    expect(parsePeriod('1990 Jan')).toMatchObject({ year: 1990, month: 1, frequency: 'monthly' });
    expect(parsePeriod('2025-Q4')).toMatchObject({
      year: 2025,
      quarter: 4,
      frequency: 'quarterly',
    });
    expect(parsePeriod('2024')).toMatchObject({ year: 2024, frequency: 'annual' });
  });

  it('automatically aggregates monthly data to align with annual data', () => {
    const result = alignSeries(
      [
        { period: '2023-01', value: 10 },
        { period: '2023-02', value: 20 },
        { period: '2024-01', value: 30 },
        { period: '2024-02', value: 40 },
      ],
      [
        { period: '2023', value: 15 },
        { period: '2024', value: 35 },
      ],
    );
    expect(result.frequency).toBe('annual');
    expect(result.aligned).toEqual([
      { period: '2023', left: 15, right: 15, difference: 0, difference_percent: 0 },
      { period: '2024', left: 35, right: 35, difference: 0, difference_percent: 0 },
    ]);
    expect(result.pearson_r).toBe(1);
  });

  it('returns rich local visualisation output', () => {
    const result = visualizeSeries([
      { period: '2024', value: 1 },
      { period: '2025', value: 2 },
      { period: '2026', value: 4 },
    ]);
    expect(result).toMatchObject({ trend: 'rising', latest: 4, sparkline: '▁▃█' });
    expect(result).toHaveProperty('ascii_chart');
    expect(result).toHaveProperty('chart_data');
    expect(result).toHaveProperty('changes');
  });
});

describe('semantic calculations', () => {
  it('calculates same-month year-on-year changes', () => {
    expect(
      yearOverYear([
        { period: '2024Jan', value: 100 },
        { period: '2024Feb', value: 200 },
        { period: '2025Jan', value: 110 },
        { period: '2025Feb', value: 180 },
      ]),
    ).toEqual([
      {
        period: '2025-01',
        value: 110,
        previous_period: '2024-01',
        previous_value: 100,
        change: 10,
        change_percent: 10,
      },
      {
        period: '2025-02',
        value: 180,
        previous_period: '2024-02',
        previous_value: 200,
        change: -20,
        change_percent: -10,
      },
    ]);
  });

  it('summarises HDB prices and price per square metre', () => {
    const summary = summarizeHdbResales([
      {
        month: '2026-01',
        town: 'BEDOK',
        flat_type: '4 ROOM',
        resale_price: '500000',
        floor_area_sqm: '100',
      },
      {
        month: '2026-02',
        town: 'BEDOK',
        flat_type: '4 ROOM',
        resale_price: '600000',
        floor_area_sqm: '100',
      },
      {
        month: '2026-03',
        town: 'BEDOK',
        flat_type: '4 ROOM',
        resale_price: '700000',
        floor_area_sqm: '100',
      },
    ]);
    expect(summary).toMatchObject({
      transaction_count: 3,
      price_sgd: { median: 600000 },
      price_per_sqm_sgd: { median: 6000 },
      coverage: { first_month: '2026-01', latest_month: '2026-03' },
    });
  });

  it('derives COE demand and success measures', () => {
    expect(
      coeMetric({
        month: '2026-08',
        bidding_no: '2',
        vehicle_class: 'Category A',
        quota: '1000',
        bids_success: '900',
        bids_received: '1500',
        premium: '120000',
      }),
    ).toMatchObject({
      bid_to_quota_ratio: 1.5,
      excess_bids: 500,
      success_rate_percent: 60,
      quota_utilisation_percent: 90,
    });
  });

  it('aligns business formations and cessations before calculating net', () => {
    expect(
      formationNet(
        [
          { period: '2025 Jan', value: 100 },
          { period: '2025 Feb', value: 120 },
        ],
        [
          { period: '2025 Jan', value: 80 },
          { period: '2025 Feb', value: 130 },
        ],
      ),
    ).toEqual([
      {
        period: '2025-01',
        formations: 100,
        cessations: 80,
        net_formations: 20,
        formation_to_cessation_ratio: 1.25,
      },
      {
        period: '2025-02',
        formations: 120,
        cessations: 130,
        net_formations: -10,
        formation_to_cessation_ratio: 120 / 130,
      },
    ]);
  });

  it('normalizes MAS currencies quoted per 100 foreign units', () => {
    expect(fxQuote({ DataSeries: 'Japanese Yen', '2026Jun': '0.8014' })).toMatchObject({
      quoted_foreign_units: 100,
      sgd_per_quoted_units: 0.8014,
      sgd_per_foreign_unit: 0.008014,
    });
    expect(fxQuote({ DataSeries: 'US Dollar', '2026Jun': '1.2883' })).toMatchObject({
      quoted_foreign_units: 1,
      sgd_per_foreign_unit: 1.2883,
    });
  });

  it('calculates the IRAS tax mix in one consistent unit', () => {
    expect(
      calculateTaxMix([
        { financial_year: '2024', tax_type: 'Income Tax', tax_collected: '750' },
        { financial_year: '2024', tax_type: 'GST', tax_collected: '250' },
      ]),
    ).toMatchObject({
      financial_year: '2024',
      total_collected_sgd_thousand: 1000,
      categories: [
        { tax_type: 'Income Tax', share_percent: 75 },
        { tax_type: 'GST', share_percent: 25 },
      ],
    });
  });

  it('ranks visitor countries without mixing in regional aggregates', () => {
    expect(
      rankVisitorSources([
        {
          DataSeries: 'Total International Visitor Arrivals By Place Of Residence',
          '2026Jan': '1000',
        },
        { DataSeries: '    Southeast Asia', '2026Jan': '700' },
        { DataSeries: '        Indonesia', '2026Jan': '400' },
        { DataSeries: '        Malaysia', '2026Jan': '300' },
      ]),
    ).toMatchObject({
      period: '2026-01',
      sources: [
        { source: 'Indonesia', arrivals: 400, share_of_total_percent: 40 },
        { source: 'Malaysia', arrivals: 300, share_of_total_percent: 30 },
      ],
    });
  });

  it('summarises URA new-sale status without calling it unsold inventory', () => {
    expect(
      summarizeUraNewSales([
        { quarter: '2026-Q2', type_of_sale: 'New Sale', sale_status: 'Completed', units: '200' },
        { quarter: '2026-Q2', type_of_sale: 'New Sale', sale_status: 'Uncompleted', units: '800' },
        { quarter: '2026-Q2', type_of_sale: 'Resale', sale_status: 'na', units: '3000' },
      ]),
    ).toMatchObject({
      newest_first: [
        {
          quarter: '2026-Q2',
          completed_new_sale_units: 200,
          uncompleted_new_sale_units: 800,
          total_new_sale_units: 1000,
          uncompleted_share_percent: 80,
        },
      ],
    });
  });

  it('filters official catalogue entries using all query terms and agency', () => {
    expect(
      filterCatalogueDatasets(
        [
          {
            datasetId: 'd_1',
            name: 'General information of schools',
            managedByAgencyName: 'Ministry of Education',
          },
          {
            datasetId: 'd_2',
            name: 'Student health survey',
            managedByAgencyName: 'Ministry of Health',
          },
        ],
        'school information',
        'education',
      ),
    ).toEqual([
      {
        datasetId: 'd_1',
        name: 'General information of schools',
        managedByAgencyName: 'Ministry of Education',
      },
    ]);
  });

  it('ranks geospatial features by true distance and excludes out-of-radius points', () => {
    expect(
      rankNearbyFeatures(
        [
          { NAME: 'Near', LatLng: '[[103.8005,1.3005]]' },
          { NAME: 'Far', LatLng: '[[103.9,1.4]]' },
        ],
        { latitude: 1.3, longitude: 103.8 },
        1_000,
        10,
      ),
    ).toMatchObject([{ NAME: 'Near' }]);
    expect(
      haversineMetres({ latitude: 1.3, longitude: 103.8 }, { latitude: 1.301, longitude: 103.8 }),
    ).toBeCloseTo(111.2, 0);
  });

  it('preserves ECDA categorical vacancy values instead of fabricating counts', () => {
    expect(
      summarizeEcdaVacancies(
        [
          { centre_name: 'A', infant_vacancy_current_month: 'Available' },
          { centre_name: 'B', infant_vacancy_current_month: 'Limited' },
          { centre_name: 'C', infant_vacancy_current_month: 'Full' },
        ],
        'infant',
      ),
    ).toMatchObject({
      centres_reviewed: 3,
      centres_with_possible_vacancy: 2,
      published_numeric_vacancy_total: null,
      status_counts: { available: 1, limited: 1, full: 1, unknown: 0 },
    });
  });

  it('lists and aggregates matching disease series within published source coverage', () => {
    const rows = [
      { epi_week: '2022-W51', disease: 'Dengue Fever', 'no._of_cases': '100' },
      { epi_week: '2022-W52', disease: 'Dengue Fever', 'no._of_cases': '125' },
      { epi_week: '2022-W52', disease: 'Dengue Haemorrhagic Fever', 'no._of_cases': '2' },
    ];
    expect(summarizeDiseaseList(rows)).toMatchObject({
      count: 2,
      data_freshness: { latest_published_week: '2022-W52', level: 'frozen' },
    });
    expect(summarizeDiseaseTrend(rows, 'Dengue', 1)).toMatchObject({
      count: 1,
      series: [{ epi_week: '2022-W52', cases: 127 }],
    });
  });

  it('ranks GDP and crime wide-series rows for explicit periods', () => {
    expect(
      rankWideRows(
        [
          { DataSeries: 'Manufacturing', '20254Q': '3.2' },
          { DataSeries: 'Construction', '20254Q': '5.1' },
        ],
        '2025Q4',
        'quarter',
      ),
    ).toMatchObject({
      period: '2025Q4',
      ranked: [
        { label: 'Construction', value: 5.1 },
        { label: 'Manufacturing', value: 3.2 },
      ],
    });
    expect(
      rankWideRows(
        [
          { DataSeries: 'Physical Crime Cases Recorded', '2025': '20,857' },
          { DataSeries: 'Scams', '2025': '37,308' },
        ],
        '2025',
        'year',
      ),
    ).toMatchObject({
      ranked: [
        { label: 'Scams', value: 37308 },
        { label: 'Physical Crime Cases Recorded', value: 20857 },
      ],
    });
  });
});

describe('deterministic router', () => {
  it('routes a detailed HDB question and extracts safe arguments', () => {
    const route = routeSingaporeQuestion('Show 4-room HDB resale prices in Ang Mo Kio');
    expect(route.mode).toBe('recommend_only');
    expect(route.recommendations[0]).toMatchObject({
      tool: 'hdb_resale_stats',
      arguments: { town: 'ANG MO KIO', flatType: '4 ROOM' },
    });
  });

  it('uses prompt discovery when no deterministic route matches', () => {
    const route = routeSingaporeQuestion('Explain something completely unrelated');
    expect(route.recommendations).toEqual([]);
    expect(route.fallback).toMatchObject({ tool: 'singapore_prompt_examples' });
  });

  it('routes true-distance school and GDP ranking questions to executable tools', () => {
    expect(
      routeSingaporeQuestion('Which schools are within 2 km of postal code 520201?')
        .recommendations[0],
    ).toMatchObject({
      tool: 'moe_schools_near',
      arguments: { postalCode: '520201' },
      missing_arguments: [],
    });
    expect(
      routeSingaporeQuestion('Rank industries by GDP in 2025 Q4').recommendations[0],
    ).toMatchObject({
      tool: 'gdp_industry_compare',
      arguments: { quarter: '2025Q4' },
      missing_arguments: [],
    });
  });
});
