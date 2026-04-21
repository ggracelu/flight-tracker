import { createClient } from '@supabase/supabase-js';
import type { FlightUpsert, WorkerConfig, WorkerStatusDetails } from './types.js';

export function getSupabaseAdminClient(config: WorkerConfig) {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function upsertFlights(
  client: ReturnType<typeof getSupabaseAdminClient>,
  flights: FlightUpsert[]
) {
  if (flights.length === 0) {
    return;
  }

  const { error } = await client.from('flights').upsert(flights, {
    onConflict: 'icao24'
  });

  if (error) {
    throw new Error(`Supabase flights upsert failed: ${error.message}`);
  }
}

export async function updateWorkerStatus(
  client: ReturnType<typeof getSupabaseAdminClient>,
  workerName: string,
  status: string,
  details: WorkerStatusDetails
) {
  const { error } = await client.from('worker_status').upsert(
    {
      worker_name: workerName,
      status,
      last_heartbeat_at: new Date().toISOString(),
      details
    },
    {
      onConflict: 'worker_name'
    }
  );

  if (error) {
    throw new Error(`Supabase worker_status upsert failed: ${error.message}`);
  }
}
