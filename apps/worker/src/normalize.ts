import type { FlightUpsert, OpenSkyStateVector } from './types.js';

const NORTH_AMERICA = {
  minLatitude: 7,
  maxLatitude: 84,
  minLongitude: -170,
  maxLongitude: -50
};

const EUROPE = {
  minLatitude: 35,
  maxLatitude: 72,
  minLongitude: -25,
  maxLongitude: 45
};

const ASIA = {
  minLatitude: -10,
  maxLatitude: 80,
  minLongitude: 45,
  maxLongitude: 180
};

export function normalizeFlights(states: OpenSkyStateVector[] | null, observedAt: Date) {
  const flights: FlightUpsert[] = [];

  for (const state of states ?? []) {
    const normalized = normalizeStateVector(state, observedAt);
    if (normalized) {
      flights.push(normalized);
    }
  }

  return flights;
}

export function normalizeStateVector(state: OpenSkyStateVector, observedAt: Date): FlightUpsert | null {
  const icao24 = normalizeString(state[0]);

  if (!icao24) {
    return null;
  }

  const latitude = normalizeNumber(state[6]);
  const longitude = normalizeNumber(state[5]);
  const lastContactEpoch = normalizeNumber(state[4]);

  return {
    icao24,
    callsign: normalizeString(state[1]),
    origin_country: normalizeString(state[2]),
    longitude,
    latitude,
    baro_altitude: normalizeNumber(state[7]),
    velocity: normalizeNumber(state[9]),
    true_track: normalizeNumber(state[10]),
    vertical_rate: normalizeNumber(state[11]),
    on_ground: Boolean(state[8]),
    last_contact: lastContactEpoch ? new Date(lastContactEpoch * 1000).toISOString() : null,
    observed_at: observedAt.toISOString(),
    region_key: classifyRegion(latitude, longitude)
  };
}

export function classifyRegion(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) {
    return 'global';
  }

  if (isWithin(latitude, longitude, NORTH_AMERICA)) {
    return 'north-america';
  }

  if (isWithin(latitude, longitude, EUROPE)) {
    return 'europe';
  }

  if (isWithin(latitude, longitude, ASIA)) {
    return 'asia';
  }

  return 'global';
}

function isWithin(
  latitude: number,
  longitude: number,
  bounds: {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
  }
) {
  return (
    latitude >= bounds.minLatitude &&
    latitude <= bounds.maxLatitude &&
    longitude >= bounds.minLongitude &&
    longitude <= bounds.maxLongitude
  );
}

function normalizeString(value: string | null) {
  const normalized = value?.trim().toLowerCase() === 'null' ? '' : value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
