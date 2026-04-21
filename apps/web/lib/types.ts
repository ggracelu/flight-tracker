export type UserRegion = {
  id: string;
  region_key: string;
  created_at: string;
};

export type FlightRow = {
  id: string;
  icao24: string;
  callsign: string | null;
  origin_country: string | null;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  on_ground: boolean;
  last_contact: string | null;
  observed_at: string;
  region_key: string;
  updated_at: string;
};

export type WorkerStatusRow = {
  id: string;
  worker_name: string;
  status: string;
  last_heartbeat_at: string;
  details: {
    cycles_completed?: number;
    fetched_states?: number;
    upserted_flights?: number;
    poll_interval_ms?: number;
    last_error?: string | null;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
};

export type RegionOption = {
  key: string;
  label: string;
  description: string;
};

export const REGION_OPTIONS: RegionOption[] = [
  {
    key: 'global',
    label: 'Global',
    description: 'Worldwide public feed with no regional narrowing'
  },
  {
    key: 'north-america',
    label: 'North America',
    description: 'United States, Canada, Mexico, and nearby airspace'
  },
  {
    key: 'europe',
    label: 'Europe',
    description: 'European commercial and regional corridors'
  },
  {
    key: 'asia',
    label: 'Asia',
    description: 'East Asia, South Asia, and Southeast Asian traffic'
  }
];

export const REGION_LABELS = Object.fromEntries(REGION_OPTIONS.map((option) => [option.key, option.label]));
