export type UserRegion = {
  id: string;
  region_key: string;
  created_at: string;
};

export type RegionOption = {
  key: string;
  label: string;
  description: string;
};

export const REGION_OPTIONS: RegionOption[] = [
  {
    key: 'north-america',
    label: 'North America',
    description: 'United States, Canada, Mexico, and nearby airspace'
  },
  {
    key: 'south-america',
    label: 'South America',
    description: 'Latin American and southern continental traffic'
  },
  {
    key: 'europe',
    label: 'Europe',
    description: 'European commercial and regional corridors'
  },
  {
    key: 'africa-middle-east',
    label: 'Africa + Middle East',
    description: 'Traffic spanning African and Middle Eastern regions'
  },
  {
    key: 'asia-pacific',
    label: 'Asia Pacific',
    description: 'East Asia, Southeast Asia, and Pacific routes'
  }
];

export const REGION_LABELS = Object.fromEntries(REGION_OPTIONS.map((option) => [option.key, option.label]));
