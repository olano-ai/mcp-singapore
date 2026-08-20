export interface DatasetSpec {
  prefix: string;
  datasetId: string;
  title: string;
  agency: string;
  category: string;
  format?: 'tabular' | 'geojson';
}

export const datasetSpecs: DatasetSpec[] = [
  {
    prefix: 'hdb_resale',
    datasetId: 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc',
    title: 'HDB resale flat prices',
    agency: 'HDB',
    category: 'property',
  },
  {
    prefix: 'coe_bidding',
    datasetId: 'd_69b3380ad7e51aff3a7dcc84eba52b8a',
    title: 'COE bidding results',
    agency: 'LTA',
    category: 'transport',
  },
  {
    prefix: 'moe_schools',
    datasetId: 'd_688b934f82c1059ed0a6993d2a829089',
    title: 'MOE schools',
    agency: 'MOE',
    category: 'education',
  },
  {
    prefix: 'hdb_carparks',
    datasetId: 'd_23f946fa557947f93a8043bbef41dd09',
    title: 'HDB carpark information',
    agency: 'HDB',
    category: 'property',
  },
  {
    prefix: 'gdp_growth',
    datasetId: 'd_a5ff719648a0e6d4b4c623ee383ab686',
    title: 'GDP year-on-year growth',
    agency: 'DOS',
    category: 'economy',
  },
  {
    prefix: 'cpi',
    datasetId: 'd_bdaff844e3ef89d39fceb962ff8f0791',
    title: 'Consumer Price Index',
    agency: 'DOS',
    category: 'economy',
  },
  {
    prefix: 'median_income',
    datasetId: 'd_aa75b9227b47cbc12ffe0e3be4979546',
    title: 'Median gross monthly income',
    agency: 'MOM',
    category: 'labour',
  },
  {
    prefix: 'employment_sector',
    datasetId: 'd_d2518fed6cc2014f0cd061b4570a9592',
    title: 'Employment by sector',
    agency: 'DOS',
    category: 'labour',
  },
  {
    prefix: 'ura_private_property',
    datasetId: 'd_7c69c943d5f0d89d6a9a773d2b51f337',
    title: 'URA private property transactions',
    agency: 'URA',
    category: 'property',
  },
  {
    prefix: 'visitor_arrivals',
    datasetId: 'd_7e7b2ee60c6ffc962f80fef129cf306e',
    title: 'International visitor arrivals',
    agency: 'STB',
    category: 'tourism',
  },
  {
    prefix: 'retail_sales',
    datasetId: 'd_6b78d625911483860e162288a4000a0c',
    title: 'Retail Sales Index',
    agency: 'DOS',
    category: 'economy',
  },
  {
    prefix: 'mas_fx',
    datasetId: 'd_b2b7ffe00aaec3936ed379369fdf531b',
    title: 'MAS exchange rates',
    agency: 'MAS',
    category: 'finance',
  },
  {
    prefix: 'bank_interest_rates',
    datasetId: 'd_5fe5a4bb4a1ecc4d8a56a095832e2b24',
    title: 'Current bank interest rates, including SORA',
    agency: 'SINGSTAT / MAS',
    category: 'finance',
  },
  {
    prefix: 'iras_tax',
    datasetId: 'd_21e22578cabce897e8b27801e5596140',
    title: 'IRAS tax collection',
    agency: 'IRAS',
    category: 'finance',
  },
  {
    prefix: 'ecda_childcare',
    datasetId: 'd_696c994c50745b079b3684f0e90ffc53',
    title: 'Childcare and kindergarten centres',
    agency: 'ECDA',
    category: 'education',
  },
  {
    prefix: 'unemployment',
    datasetId: 'd_ca32584c91ee07d091a4ce75fa868414',
    title: 'Unemployment rate',
    agency: 'MOM',
    category: 'labour',
  },
  {
    prefix: 'population',
    datasetId: 'd_3d227e5d9fdec73f3bcadce671c333a6',
    title: 'Population indicators',
    agency: 'DOS',
    category: 'population',
  },
  {
    prefix: 'disease_cases',
    datasetId: 'd_ca168b2cb763640d72c4600a68f9909e',
    title: 'Weekly infectious disease cases',
    agency: 'MOH',
    category: 'health',
  },
  {
    prefix: 'electricity',
    datasetId: 'd_ae4afbaf5bc96bde19d8ce85810ab9f4',
    title: 'Electricity generation',
    agency: 'EMA',
    category: 'energy',
  },
  {
    prefix: 'live_births',
    datasetId: 'd_d05c760928eb5eaa58006d83462b834e',
    title: 'Live births',
    agency: 'DOS',
    category: 'population',
  },
  {
    prefix: 'crime',
    datasetId: 'd_ca0b908cf06a267ca06acbd5feb4465c',
    title: 'Crime cases recorded',
    agency: 'SPF',
    category: 'civic',
  },
  {
    prefix: 'tourism_receipts',
    datasetId: 'd_e285a651ec353416054195528ca988a9',
    title: 'Tourism receipts',
    agency: 'STB',
    category: 'tourism',
  },
  {
    prefix: 'hawker_centres',
    datasetId: 'd_68a42f09f350881996d83f9cd73ab02f',
    title: 'Government hawker centres',
    agency: 'NEA',
    category: 'civic',
  },
  {
    prefix: 'dengue_clusters',
    datasetId: 'd_dbfabf16158d1b0e1c420627c0819168',
    title: 'Current dengue clusters',
    agency: 'NEA',
    category: 'health',
    format: 'geojson',
  },
];

export const acraShardIds = [
  'd_8575e84912df3c28995b8e6e0e05205a',
  'd_af2042c77ffaf0db5d75561ce9ef5688',
  'd_0cc5f52a1f298b916f317800251057f3',
  'd_4e3db8955fdcda6f9944097bef3d2724',
  'd_1cd970d8351b42be4a308d628a6dd9d3',
  'd_e97e8e7fc55b85a38babf66b0fa46b73',
  'd_df7d2d661c0c11a7c367c9ee4bf896c1',
  'd_fa2ed456cf2b8597bb7e064b08fc3c7c',
  'd_300ddc8da4e8f7bdc1bfc62d0d99e2e7',
  'd_31af23fdb79119ed185c256f03cb5773',
  'd_67e99e6eabc4aad9b5d48663b579746a',
  'd_c0650f23e94c42e7a20921f4c5b75c24',
  'd_3a3807c023c61ddfba947dc069eb53f2',
  'd_478f45a9c541cbe679ca55d1cd2b970b',
  'd_a2141adf93ec2a3c2ec2837b78d6d46e',
  'd_181005ca270b45408b4cdfc954980ca2',
  'd_9af9317c646a1c881bb5591c91817cc6',
  'd_5c4ef48b025fdfbc80056401f06e3df9',
  'd_5573b0db0575db32190a2ad27919a7aa',
  'd_2b8c54b2a490d2fa36b925289e5d9572',
  'd_85518d970b8178975850457f60f1e738',
  'd_72f37e5c5d192951ddc5513c2b134482',
  'd_4526d47d6714d3b052eed4a30b8b1ed6',
  'd_b58303c68e9cf0d2ae93b73ffdbfbfa1',
  'd_acbc938ec77af18f94cecc4a7c9ec720',
  'd_4130f1d9d365d9f1633536e959f62bb7',
  'd_124a9bd407c7a25f8335b93b86e50fdd',
];

export interface SingStatSpec {
  prefix: string;
  tableId: string;
  title: string;
}

export const singStatSpecs: SingStatSpec[] = [
  {
    prefix: 'business_formations_annual',
    tableId: 'M085851',
    title: 'Business formations and cessations, annual',
  },
  {
    prefix: 'business_formations_monthly',
    tableId: 'M085831',
    title: 'Business formations, monthly',
  },
  {
    prefix: 'business_cessations_monthly',
    tableId: 'M085841',
    title: 'Business cessations, monthly',
  },
  { prefix: 'household_income', tableId: 'M810871', title: 'Household market income indicators' },
  { prefix: 'wages', tableId: 'M182941', title: 'Average monthly nominal earnings' },
  { prefix: 'deaths', tableId: 'M810481', title: 'Deaths and death rates' },
  { prefix: 'marriages', tableId: 'M830101', title: 'Marriage indicators' },
  { prefix: 'divorces', tableId: 'M830201', title: 'Divorce indicators' },
  {
    prefix: 'merchandise_trade',
    tableId: 'M451001',
    title: 'Merchandise trade by commodity section',
  },
  { prefix: 'labour_force', tableId: 'M182201', title: 'Resident labour-force participation rate' },
];
