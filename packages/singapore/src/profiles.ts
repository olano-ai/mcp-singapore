export const SINGAPORE_TOOL_PROFILE_NAMES = [
  'mobility',
  'property',
  'business',
  'economy',
  'civic',
  'finance',
] as const;

export type SingaporeToolProfileName = (typeof SINGAPORE_TOOL_PROFILE_NAMES)[number];
export type SingaporeToolProfile = 'all' | SingaporeToolProfileName;

export interface SingaporeToolProfileDefinition {
  description: string;
  prefixes: readonly string[];
}

const SHARED_PREFIXES = [
  'datagov_',
  'singapore_catalog_',
  'singapore_prompt_',
  'singapore_cache_',
  'analytics_',
] as const;

/**
 * Stable, public prefix contracts used by the aggregate MCP server and companion CLI.
 * New tools automatically join a profile when they use one of its documented prefixes.
 */
export const SINGAPORE_TOOL_PROFILES: Readonly<
  Record<SingaporeToolProfileName, SingaporeToolProfileDefinition>
> = Object.freeze({
  mobility: Object.freeze({
    description: 'Public transport, road traffic, parking, routing, rail and COE data.',
    prefixes: Object.freeze([
      ...SHARED_PREFIXES,
      'lta_',
      'onemap_',
      'rail_',
      'coe_',
      'hdb_carparks_',
      'singapore_location_',
    ]),
  }),
  property: Object.freeze({
    description:
      'HDB and private-property evidence, locations, rail access and mortgage calculations.',
    prefixes: Object.freeze([
      ...SHARED_PREFIXES,
      'hdb_',
      'ura_',
      'onemap_',
      'rail_',
      'finance_mortgage_',
      'finance_singapore_',
      'bank_interest_rates_',
      'median_income_',
      'singstat_household_income_',
      'singapore_property_',
    ]),
  }),
  business: Object.freeze({
    description:
      'ACRA entities, formations, tax, retail, tourism, visitors and exchange-rate context.',
    prefixes: Object.freeze([
      ...SHARED_PREFIXES,
      'acra_',
      'business_',
      'singstat_business_',
      'retail_',
      'visitor_',
      'visitors_',
      'tourism_',
      'mas_fx_',
      'fx_',
      'iras_',
      'employment_',
      'singapore_company_',
    ]),
  }),
  economy: Object.freeze({
    description: 'Growth, prices, work, income, population, trade, business and market indicators.',
    prefixes: Object.freeze([
      ...SHARED_PREFIXES,
      'gdp_',
      'cpi_',
      'median_income_',
      'employment_',
      'unemployment_',
      'population_',
      'retail_',
      'visitor_',
      'visitors_',
      'tourism_',
      'mas_fx_',
      'fx_',
      'business_',
      'singstat_business_',
      'singstat_household_income_',
      'singstat_wages_',
      'singstat_merchandise_trade_',
      'singstat_labour_force_',
      'electricity_',
      'bank_interest_rates_',
      'singapore_market_',
    ]),
  }),
  civic: Object.freeze({
    description:
      'Weather, health, education, population, safety, food centres and public services.',
    prefixes: Object.freeze([
      ...SHARED_PREFIXES,
      'weather_',
      'dengue_',
      'disease_',
      'crime_',
      'moe_',
      'ecda_',
      'hawker_',
      'population_',
      'electricity_',
      'live_births_',
      'singstat_deaths_',
      'singstat_marriages_',
      'singstat_divorces_',
      'onemap_',
      'singapore_location_',
    ]),
  }),
  finance: Object.freeze({
    description:
      'Official reference rates, mortgage scenarios, income, prices and property context.',
    prefixes: Object.freeze([
      ...SHARED_PREFIXES,
      'finance_',
      'bank_interest_rates_',
      'mas_fx_',
      'fx_',
      'median_income_',
      'singstat_household_income_',
      'singstat_wages_',
      'cpi_',
      'hdb_resale_',
      'ura_private_property_',
      'singapore_property_',
      'singapore_market_',
    ]),
  }),
});

export const SINGAPORE_PROFILE_DISCOVERY_TOOL = 'singapore_tool_profiles';

export function resolveSingaporeToolProfile(value?: string): SingaporeToolProfile {
  const normalized = value?.trim().toLowerCase() || 'all';
  if (
    normalized === 'all' ||
    SINGAPORE_TOOL_PROFILE_NAMES.includes(normalized as SingaporeToolProfileName)
  ) {
    return normalized as SingaporeToolProfile;
  }
  throw new Error(
    `Unknown Singapore tool profile "${value}". Choose one of: all, ${SINGAPORE_TOOL_PROFILE_NAMES.join(', ')}.`,
  );
}

export function toolMatchesSingaporeProfile(
  toolName: string,
  profile: SingaporeToolProfile,
): boolean {
  if (toolName === SINGAPORE_PROFILE_DISCOVERY_TOOL || profile === 'all') return true;
  return SINGAPORE_TOOL_PROFILES[profile].prefixes.some((prefix) => toolName.startsWith(prefix));
}
