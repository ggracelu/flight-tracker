import 'dotenv/config';
import type { WorkerConfig } from './types.js';

const DEFAULT_POLL_INTERVAL_MS = 30_000;

export function getConfig(): WorkerConfig {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  const openskyClientId = readOptionalEnv('OPENSKY_CLIENT_ID');
  const openskyClientSecret = readOptionalEnv('OPENSKY_CLIENT_SECRET');
  const pollIntervalMs = parsePollInterval(process.env.POLL_INTERVAL_MS);

  if (!supabaseUrl) {
    throw new Error('Missing required environment variable SUPABASE_URL.');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing required environment variable SUPABASE_SERVICE_ROLE_KEY.');
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    openskyClientId,
    openskyClientSecret,
    pollIntervalMs,
    workerName: 'opensky-worker',
    openskyBaseUrl: 'https://opensky-network.org/api/states/all',
    openskyTokenUrl: 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
  };
}

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function parsePollInterval(input: string | undefined) {
  if (!input) {
    return DEFAULT_POLL_INTERVAL_MS;
  }

  const value = Number.parseInt(input, 10);

  if (!Number.isFinite(value) || value < 5_000) {
    throw new Error('POLL_INTERVAL_MS must be an integer greater than or equal to 5000.');
  }

  return value;
}
