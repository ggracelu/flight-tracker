export type WorkerConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  openskyUsername: string | null;
  openskyPassword: string | null;
  pollIntervalMs: number;
  workerName: string;
  openskyBaseUrl: string;
};

export type OpenSkyStatesResponse = {
  time: number | null;
  states: OpenSkyStateVector[] | null;
};

export type OpenSkyStateVector = [
  string | null,
  string | null,
  string | null,
  number | null,
  number | null,
  number | null,
  number | null,
  boolean | null,
  number | null,
  number | null,
  number | null,
  number[] | null,
  number | null,
  number | null,
  string | null,
  boolean | null,
  number | null
];

export type FlightUpsert = {
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
};

export type WorkerStatusDetails = {
  cycles_completed: number;
  fetched_states: number;
  upserted_flights: number;
  poll_interval_ms: number;
  last_error: string | null;
};
