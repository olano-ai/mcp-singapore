export interface PromptExample {
  id: string;
  category: string;
  prompt: string;
  recommended_tools: string[];
  description: string;
  credentials?: string[];
}

export const promptExamples: PromptExample[] = [
  {
    id: 'location-brief',
    category: 'locations',
    prompt: 'Give me a current location brief for Raffles Place.',
    recommended_tools: ['singapore_location_brief'],
    description: 'Resolve a Singapore place and add current weather context.',
    credentials: ['ONEMAP_TOKEN'],
  },
  {
    id: 'address-search',
    category: 'locations',
    prompt: 'Find the postal code and coordinates for Marina Bay Sands.',
    recommended_tools: ['onemap_search'],
    description: 'Search authoritative OneMap address records.',
    credentials: ['ONEMAP_TOKEN'],
  },
  {
    id: 'nearby-search',
    category: 'locations',
    prompt: 'What OneMap themes and features are near these coordinates?',
    recommended_tools: ['onemap_list_themes', 'onemap_query_theme'],
    description: 'Discover and query nearby mapped features.',
    credentials: ['ONEMAP_TOKEN'],
  },
  {
    id: 'dataset-discovery',
    category: 'data',
    prompt: 'Search the official data.gov.sg catalogue for school-enrolment datasets.',
    recommended_tools: ['singapore_dataset_search'],
    description: 'Page and locally search the documented official dataset catalogue.',
  },
  {
    id: 'bus-arrivals',
    category: 'mobility',
    prompt: 'When are the next buses arriving at bus stop 01012?',
    recommended_tools: ['lta_bus_arrivals'],
    description: 'Get live LTA bus arrival estimates.',
    credentials: ['LTA_DATAMALL_API_KEY'],
  },
  {
    id: 'traffic-now',
    category: 'mobility',
    prompt: 'Are there any traffic incidents in Singapore right now?',
    recommended_tools: ['lta_traffic_incidents'],
    description: 'Read current incidents reported by LTA.',
    credentials: ['LTA_DATAMALL_API_KEY'],
  },
  {
    id: 'carpark-availability',
    category: 'mobility',
    prompt: 'Show current carpark availability and help me identify carparks with spaces.',
    recommended_tools: ['lta_carpark_availability'],
    description: 'Retrieve live participating carpark availability.',
    credentials: ['LTA_DATAMALL_API_KEY'],
  },
  {
    id: 'coe-latest',
    category: 'mobility',
    prompt: 'What were the latest COE premiums for every vehicle category?',
    recommended_tools: ['coe_latest'],
    description: 'Summarise the latest official COE bidding exercise.',
  },
  {
    id: 'coe-demand',
    category: 'mobility',
    prompt: 'Compare bids received with quota for Category A over the last 12 exercises.',
    recommended_tools: ['coe_demand_supply'],
    description: 'Calculate transparent COE demand-to-quota measures.',
  },
  {
    id: 'weather-now',
    category: 'weather',
    prompt: 'What is the two-hour weather forecast across Singapore?',
    recommended_tools: ['weather_two_hour_forecast'],
    description: 'Get NEA two-hour forecasts.',
  },
  {
    id: 'weather-outlook',
    category: 'weather',
    prompt: 'Give me the Singapore four-day weather outlook.',
    recommended_tools: ['weather_four_day_outlook'],
    description: 'Get the current NEA four-day outlook.',
  },
  {
    id: 'air-quality',
    category: 'weather',
    prompt: 'What are Singapore PSI and PM2.5 readings today?',
    recommended_tools: ['weather_air_quality', 'datagov_get_realtime'],
    description: 'Retrieve official PSI and optional supported real-time air-quality feeds.',
  },
  {
    id: 'hdb-resale-town',
    category: 'property',
    prompt: 'Summarise recent 4-room HDB resale prices in Ang Mo Kio.',
    recommended_tools: ['hdb_resale_stats'],
    description:
      'Calculate price and price-per-square-metre statistics from official transactions.',
  },
  {
    id: 'hdb-resale-compare',
    category: 'property',
    prompt: 'Compare recent HDB resale evidence for Tampines and Bedok.',
    recommended_tools: ['hdb_resale_stats'],
    description: 'Call the same reproducible transaction summary for each town.',
  },
  {
    id: 'property-area',
    category: 'property',
    prompt: 'Research HDB transaction evidence and address context around Bishan Street 13.',
    recommended_tools: ['singapore_property_area_brief'],
    description: 'Combine official transactions with optional OneMap context.',
  },
  {
    id: 'private-property',
    category: 'property',
    prompt: 'Find recent public private-property transaction records matching Orchard.',
    recommended_tools: ['ura_private_property_search'],
    description: 'Search the curated URA transaction dataset.',
  },
  {
    id: 'mortgage-payment',
    category: 'property',
    prompt: 'Calculate the monthly payment for a S$600,000 mortgage at 3.2% over 25 years.',
    recommended_tools: ['finance_mortgage_payment'],
    description: 'Run a transparent educational amortisation calculation.',
  },
  {
    id: 'mortgage-stress',
    category: 'property',
    prompt: 'Stress-test a S$700,000 mortgage at interest rates from 3% to 6%.',
    recommended_tools: ['finance_mortgage_stress_test'],
    description: 'Compare bounded illustrative payment scenarios.',
  },
  {
    id: 'company-search',
    category: 'business',
    prompt: 'Search official ACRA public data for companies matching Olano.',
    recommended_tools: ['acra_search_entities'],
    description: 'Search all configured ACRA public entity shards.',
  },
  {
    id: 'company-uen',
    category: 'business',
    prompt: 'Look up this Singapore UEN in the public ACRA datasets.',
    recommended_tools: ['acra_get_entity'],
    description: 'Resolve an exact UEN from official public entity records.',
  },
  {
    id: 'company-context',
    category: 'business',
    prompt: 'Give me an official public-data brief on a Singapore company and formation trends.',
    recommended_tools: ['singapore_company_brief'],
    description: 'Combine ACRA matches with SingStat formation context.',
  },
  {
    id: 'business-net',
    category: 'business',
    prompt: 'How many net new business entities were formed each month in Singapore?',
    recommended_tools: ['business_formations_net'],
    description: 'Align formations and cessations and calculate the difference.',
  },
  {
    id: 'business-industry-compare',
    category: 'business',
    prompt: 'Compare net formations for manufacturing, construction and information services.',
    recommended_tools: ['business_formations_compare'],
    description: 'Compare matched SingStat industry series over one window.',
  },
  {
    id: 'inflation',
    category: 'economy',
    prompt: 'What is the latest year-on-year change in Singapore All Items CPI?',
    recommended_tools: ['cpi_yoy'],
    description: 'Calculate like-for-like monthly CPI change.',
  },
  {
    id: 'food-inflation',
    category: 'economy',
    prompt: 'Show year-on-year CPI change for food for the last 12 months.',
    recommended_tools: ['cpi_yoy'],
    description: 'Select a CPI category and derive the annual change series.',
  },
  {
    id: 'employment-sector',
    category: 'economy',
    prompt: 'How has employment in Singapore manufacturing changed over the last five years?',
    recommended_tools: ['employment_growth'],
    description: 'Calculate annual employment changes for an official sector series.',
  },
  {
    id: 'retail-yoy',
    category: 'economy',
    prompt: 'Show the latest year-on-year change in Singapore retail sales volume.',
    recommended_tools: ['retail_sales_yoy'],
    description: 'Calculate like-for-like monthly change in the Retail Sales Index.',
  },
  {
    id: 'market-context',
    category: 'economy',
    prompt:
      'Give me a compact official-data snapshot of Singapore GDP, CPI, employment and retail.',
    recommended_tools: ['singapore_market_context'],
    description: 'Retrieve a bounded cross-dataset market context.',
  },
  {
    id: 'gdp-industry-ranking',
    category: 'economy',
    prompt: 'Rank Singapore industries by year-on-year GDP growth in 2025 Q4.',
    recommended_tools: ['gdp_industry_compare'],
    description: 'Rank official quarterly industry rows without adding nested aggregates.',
  },
  {
    id: 'exchange-rate',
    category: 'finance',
    prompt: 'Find recent MAS exchange-rate observations for SGD and USD.',
    recommended_tools: ['mas_fx_search'],
    description: 'Search the curated official MAS exchange-rate dataset.',
  },
  {
    id: 'mortgage-reference-rates',
    category: 'finance',
    prompt: 'Show the latest official SORA and published bank interest-rate context.',
    recommended_tools: ['finance_mortgage_rates_latest'],
    description:
      'Retrieve the free official reference-rate dataset without treating it as a lender offer.',
  },
  {
    id: 'finance-data-availability',
    category: 'finance',
    prompt: 'Can this MCP provide live SGX quotes or Singapore insurance premiums?',
    recommended_tools: ['finance_singapore_data_availability'],
    description:
      'Return the verified API boundary and official reference links instead of scraping or fabricating a feed.',
  },
  {
    id: 'schools',
    category: 'education',
    prompt: 'Search the official MOE schools dataset for schools matching Tampines.',
    recommended_tools: ['moe_schools_search'],
    description: 'Search curated public school records.',
  },
  {
    id: 'schools-nearby',
    category: 'education',
    prompt: 'Which schools are within 2 km of postal code 520201?',
    recommended_tools: ['moe_schools_near'],
    description: 'Use official OneMap coordinates and true distance instead of postal prefixes.',
    credentials: ['ONEMAP_TOKEN'],
  },
  {
    id: 'childcare',
    category: 'education',
    prompt: 'Find childcare and kindergarten centres matching Punggol.',
    recommended_tools: ['ecda_childcare_search'],
    description: 'Search official ECDA centre data.',
  },
  {
    id: 'childcare-nearby',
    category: 'education',
    prompt: 'Find early-childhood centres within 1.5 km of Punggol MRT.',
    recommended_tools: ['ecda_centres_near'],
    description: 'Rank official OneMap kindergarten and childcare theme coordinates.',
    credentials: ['ONEMAP_TOKEN'],
  },
  {
    id: 'childcare-vacancies',
    category: 'education',
    prompt: 'Summarise current N1 vacancy availability for ECDA centres in postal sector 52.',
    recommended_tools: ['ecda_vacancy_summary'],
    description: 'Preserve the source Available, Limited and Full labels.',
  },
  {
    id: 'dengue',
    category: 'health',
    prompt: 'Show current dengue clusters from the official NEA dataset.',
    recommended_tools: ['dengue_clusters_search'],
    description: 'Query current dengue-cluster records.',
  },
  {
    id: 'disease-history',
    category: 'health',
    prompt: 'Search weekly infectious disease case records for dengue.',
    recommended_tools: ['disease_cases_trend'],
    description: 'Analyse official historical MOH weekly cases with a frozen-source warning.',
  },
  {
    id: 'disease-labels',
    category: 'health',
    prompt: 'Which diseases are represented in the historical MOH weekly bulletin dataset?',
    recommended_tools: ['disease_cases_list'],
    description: 'List actual published labels and the historical coverage boundary.',
  },
  {
    id: 'hawkers',
    category: 'civic',
    prompt: 'Find government hawker centres matching Bedok.',
    recommended_tools: ['hawker_centres_search'],
    description: 'Search the official NEA hawker-centre dataset.',
  },
  {
    id: 'crime',
    category: 'civic',
    prompt: 'Show official recorded crime data matching scams.',
    recommended_tools: ['crime_search'],
    description: 'Search public SPF crime records without inferring individual risk.',
  },
  {
    id: 'crime-ranking',
    category: 'civic',
    prompt: 'Rank Singapore recorded-crime series for 2025 and explain comparability limits.',
    recommended_tools: ['crime_compare'],
    description: 'Rank an explicit year while flagging rates and the 2022 reporting break.',
  },
  {
    id: 'population',
    category: 'population',
    prompt: 'Find recent official Singapore population indicators.',
    recommended_tools: ['population_search'],
    description: 'Search curated Department of Statistics population data.',
  },
  {
    id: 'tourism',
    category: 'tourism',
    prompt: 'Find recent visitor-arrival records and tourism receipts for Singapore.',
    recommended_tools: ['visitor_arrivals_search', 'tourism_receipts_search'],
    description: 'Query two official tourism datasets.',
  },
  {
    id: 'compare-series',
    category: 'analytics',
    prompt:
      'Align this monthly series with this annual series and compare their overlapping years.',
    recommended_tools: ['insights_compare_series'],
    description: 'Automatically normalize both inputs to a shared calendar frequency.',
  },
  {
    id: 'visualise-series',
    category: 'analytics',
    prompt: 'Create a compact chart, changes and chart-ready JSON for these observations.',
    recommended_tools: ['insights_visualize_series'],
    description: 'Produce a sparkline, ASCII chart, statistics, changes and chart data.',
  },
];

export function promptCategories(): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const example of promptExamples) {
    counts.set(example.category, (counts.get(example.category) ?? 0) + 1);
  }
  return [...counts]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

function normalized(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function searchPromptExamples(input: {
  category?: string;
  search?: string;
  tool?: string;
  limit?: number;
}): PromptExample[] {
  const category = input.category?.toLowerCase();
  const query = input.search ? normalized(input.search) : null;
  return promptExamples
    .filter((example) => !category || example.category === category)
    .filter((example) => !input.tool || example.recommended_tools.includes(input.tool))
    .filter((example) => {
      if (!query) return true;
      const text = normalized(
        `${example.id} ${example.category} ${example.prompt} ${example.description} ${example.recommended_tools.join(' ')}`,
      );
      return query.split(' ').every((term) => text.includes(term));
    })
    .slice(0, input.limit ?? 20);
}

export interface RouteRecommendation {
  tool: string;
  arguments: Record<string, unknown>;
  confidence: number;
  reason: string;
  missing_arguments: string[];
}

interface RouteRule {
  tool: string;
  keywords: string[];
  reason: string;
  arguments?: (message: string) => Record<string, unknown>;
  missing?: (message: string) => string[];
}

const TOWNS = [
  'ANG MO KIO',
  'BEDOK',
  'BISHAN',
  'BUKIT BATOK',
  'BUKIT MERAH',
  'BUKIT PANJANG',
  'BUKIT TIMAH',
  'CENTRAL AREA',
  'CHOA CHU KANG',
  'CLEMENTI',
  'GEYLANG',
  'HOUGANG',
  'JURONG EAST',
  'JURONG WEST',
  'KALLANG/WHAMPOA',
  'MARINE PARADE',
  'PASIR RIS',
  'PUNGGOL',
  'QUEENSTOWN',
  'SEMBAWANG',
  'SENGKANG',
  'SERANGOON',
  'TAMPINES',
  'TOA PAYOH',
  'WOODLANDS',
  'YISHUN',
];

function extractHdb(message: string): Record<string, unknown> {
  const upper = message.toUpperCase();
  const town = TOWNS.find((candidate) => upper.includes(candidate));
  const flat = /\b(1|2|3|4|5)\s*[- ]?ROOM\b/i.exec(message);
  return {
    ...(town ? { town } : {}),
    ...(flat ? { flatType: `${flat[1]} ROOM` } : {}),
  };
}

function extractCategory(message: string): Record<string, unknown> {
  const match = /(?:category|cat)\s*([a-e])\b/i.exec(message);
  return match ? { category: match[1]!.toUpperCase() } : {};
}

function extractUen(message: string): Record<string, unknown> {
  const match = /\b(?:\d{8,10}[A-Z]|[A-Z]\d{8}[A-Z])\b/i.exec(message);
  return match ? { uen: match[0].toUpperCase() } : {};
}

function extractPostalCode(message: string): Record<string, unknown> {
  const match = /\b\d{6}\b/.exec(message);
  return match ? { postalCode: match[0] } : {};
}

function extractQuarter(message: string): Record<string, unknown> {
  const match = /\b(20\d{2})\s*(?:q\s*([1-4])|([1-4])\s*q)\b/i.exec(message);
  const quarter = match?.[2] ?? match?.[3];
  return match && quarter ? { quarter: `${match[1]}Q${quarter}` } : {};
}

function extractYear(message: string): Record<string, unknown> {
  const matches = [...message.matchAll(/\b(20\d{2})\b/g)];
  return matches.length ? { year: matches.at(-1)![1] } : {};
}

function extractVacancy(message: string): Record<string, unknown> {
  const level = /\b(infant|pg|n1|n2|k1|k2)\b/i.exec(message)?.[1]?.toLowerCase();
  const postalPrefix = /postal\s+(?:sector|prefix)\s+(\d{1,6})\b/i.exec(message)?.[1];
  return {
    ...(level ? { level } : {}),
    ...(postalPrefix ? { postalPrefix } : {}),
  };
}

const routeRules: RouteRule[] = [
  {
    tool: 'hdb_resale_stats',
    keywords: ['hdb', 'resale', 'flat price', '4 room', '5 room'],
    reason: 'The question asks for derived HDB resale transaction statistics.',
    arguments: extractHdb,
  },
  {
    tool: 'coe_demand_supply',
    keywords: ['coe demand', 'bids received', 'quota', 'oversubscribed'],
    reason: 'The question asks about COE bidding demand relative to supply.',
    arguments: extractCategory,
  },
  {
    tool: 'coe_history',
    keywords: ['coe history', 'coe trend', 'coe over', 'coe premium trend'],
    reason: 'The question asks for a COE category history.',
    arguments: extractCategory,
    missing: (message) => (/category\s*[a-e]/i.test(message) ? [] : ['category']),
  },
  {
    tool: 'coe_latest',
    keywords: ['coe', 'certificate of entitlement'],
    reason: 'The question asks about COE results and no stronger historical intent was detected.',
    arguments: extractCategory,
  },
  {
    tool: 'cpi_yoy',
    keywords: ['cpi', 'inflation', 'consumer price'],
    reason: 'The question asks about Singapore consumer-price change.',
  },
  {
    tool: 'employment_growth',
    keywords: ['employment', 'jobs by sector', 'workforce sector'],
    reason: 'The question asks for employment levels or annual sector growth.',
  },
  {
    tool: 'retail_sales_yoy',
    keywords: ['retail sales', 'retail index', 'retail growth'],
    reason: 'The question asks for retail sales or like-for-like annual change.',
  },
  {
    tool: 'gdp_industry_compare',
    keywords: ['gdp industries', 'gdp industry', 'industries by gdp', 'rank industries'],
    reason: 'The question asks for a like-for-like quarterly ranking of official GDP rows.',
    arguments: extractQuarter,
    missing: (message) => (Object.keys(extractQuarter(message)).length ? [] : ['quarter']),
  },
  {
    tool: 'business_formations_net',
    keywords: [
      'net formations',
      'formations and cessations',
      'new businesses',
      'business closures',
    ],
    reason: 'The question asks for the difference between formations and cessations.',
  },
  {
    tool: 'acra_get_entity',
    keywords: ['uen'],
    reason: 'The question contains or requests an exact Singapore UEN lookup.',
    arguments: extractUen,
    missing: (message) => (Object.keys(extractUen(message)).length ? [] : ['uen']),
  },
  {
    tool: 'acra_search_entities',
    keywords: ['company', 'acra', 'business entity'],
    reason: 'The question asks for a public ACRA entity search.',
    missing: () => ['query'],
  },
  {
    tool: 'finance_mortgage_payment',
    keywords: ['mortgage payment', 'home loan payment', 'monthly instalment'],
    reason: 'The question asks for a transparent mortgage payment calculation.',
    missing: () => ['principal', 'annualRate', 'years'],
  },
  {
    tool: 'finance_mortgage_rates_latest',
    keywords: ['sora', 'mortgage rate', 'housing loan rate', 'home loan rate'],
    reason: 'The question asks for official Singapore mortgage reference-rate context.',
    missing: () => [],
  },
  {
    tool: 'finance_singapore_data_availability',
    keywords: ['stock price', 'share price', 'stock quote', 'sgx price', 'insurance premium'],
    reason:
      'No stable free official SGX quote or insurance-premium API was verified; report the supported boundary and official references.',
    missing: () => [],
  },
  {
    tool: 'lta_bus_arrivals',
    keywords: ['bus arrival', 'next bus'],
    reason: 'The question asks for live bus arrival estimates.',
    missing: () => ['busStopCode'],
  },
  {
    tool: 'lta_traffic_incidents',
    keywords: ['traffic incident', 'road accident', 'road block', 'traffic now'],
    reason: 'The question asks for current LTA traffic incidents.',
  },
  {
    tool: 'weather_two_hour_forecast',
    keywords: ['weather', 'rain', 'forecast'],
    reason: 'The question asks for current Singapore weather context.',
  },
  {
    tool: 'dengue_clusters_search',
    keywords: ['dengue cluster', 'dengue area'],
    reason: 'The question asks about current official dengue-cluster records.',
  },
  {
    tool: 'disease_cases_trend',
    keywords: ['disease trend', 'weekly disease', 'infectious disease', 'dengue history'],
    reason:
      'The question asks for the historical MOH weekly disease series; its frozen coverage will be shown.',
    missing: () => ['disease'],
  },
  {
    tool: 'ecda_vacancy_summary',
    keywords: ['childcare vacancy', 'preschool vacancy', 'ecda vacancy'],
    reason: 'The question asks for published ECDA vacancy availability by programme level.',
    arguments: extractVacancy,
    missing: (message) => (Object.hasOwn(extractVacancy(message), 'level') ? [] : ['level']),
  },
  {
    tool: 'ecda_centres_near',
    keywords: ['childcare near', 'preschool near', 'kindergarten near'],
    reason: 'The question asks for true-distance early-childhood proximity through OneMap.',
    arguments: extractPostalCode,
    missing: (message) =>
      Object.keys(extractPostalCode(message)).length ? [] : ['location or coordinates'],
  },
  {
    tool: 'moe_schools_near',
    keywords: [
      'schools near',
      'school near',
      'schools within',
      'school within',
      'schools are within',
      'school is within',
    ],
    reason: 'The question asks for true-distance school proximity through OneMap.',
    arguments: extractPostalCode,
    missing: (message) =>
      Object.keys(extractPostalCode(message)).length ? [] : ['location or coordinates'],
  },
  {
    tool: 'moe_schools_search',
    keywords: ['school', 'moe'],
    reason: 'The question asks for records in the official school dataset.',
    missing: () => ['query'],
  },
  {
    tool: 'crime_compare',
    keywords: ['rank crime', 'crime ranking', 'compare crime types', 'crime categories'],
    reason:
      'The question asks for an explicit-year recorded-crime ranking with comparability caveats.',
    arguments: extractYear,
    missing: (message) => (Object.keys(extractYear(message)).length ? [] : ['year']),
  },
  {
    tool: 'singapore_dataset_search',
    keywords: ['search datasets', 'find dataset', 'data catalogue', 'data catalog'],
    reason: 'The question asks to discover an official data.gov.sg dataset.',
    missing: () => ['query'],
  },
  {
    tool: 'hawker_centres_search',
    keywords: ['hawker', 'food centre'],
    reason: 'The question asks for official hawker-centre records.',
    missing: () => ['query'],
  },
  {
    tool: 'singapore_location_brief',
    keywords: ['location', 'address', 'postal code', 'coordinates', 'nearby'],
    reason: 'The question needs Singapore place resolution and contextual data.',
    missing: () => ['query'],
  },
];

export function routeSingaporeQuestion(message: string): {
  query: string;
  mode: string;
  recommendations: RouteRecommendation[];
  fallback: RouteRecommendation | null;
} {
  const query = normalized(message);
  const scored = routeRules
    .map((rule) => {
      const hits = rule.keywords.filter((keyword) => query.includes(normalized(keyword)));
      return { rule, hits };
    })
    .filter(({ hits }) => hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length || b.hits[0]!.length - a.hits[0]!.length)
    .slice(0, 3)
    .map(({ rule, hits }, index): RouteRecommendation => ({
      tool: rule.tool,
      arguments: rule.arguments?.(message) ?? {},
      confidence: Math.min(0.97, 0.55 + hits.length * 0.14 - index * 0.04),
      reason: rule.reason,
      missing_arguments: rule.missing?.(message) ?? [],
    }));
  return {
    query: message,
    mode: 'recommend_only',
    recommendations: scored,
    fallback: scored.length
      ? null
      : {
          tool: 'singapore_prompt_examples',
          arguments: { search: message, limit: 10 },
          confidence: 0.3,
          reason: 'No safe deterministic route matched; search the prompt catalogue.',
          missing_arguments: [],
        },
  };
}
