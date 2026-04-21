import { getConfig } from './config.js';
import { normalizeFlights } from './normalize.js';
import { fetchOpenSkyStates } from './opensky.js';
import { getSupabaseAdminClient, updateWorkerStatus, upsertFlights } from './supabase.js';
import type { WorkerStatusDetails } from './types.js';

const config = getConfig();
const supabase = getSupabaseAdminClient(config);

let isRunning = false;
let cyclesCompleted = 0;
let lastError: string | null = null;

console.log(
  `[worker] starting ${config.workerName} with poll interval ${config.pollIntervalMs}ms${
    config.openskyUsername ? ' (authenticated OpenSky requests enabled)' : ' (unauthenticated OpenSky requests)'
  }`
);

void runCycle();
const interval = setInterval(() => {
  void runCycle();
}, config.pollIntervalMs);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function runCycle() {
  if (isRunning) {
    console.warn('[worker] skipping poll because the previous cycle is still running.');
    return;
  }

  isRunning = true;
  const startedAt = Date.now();

  try {
    const payload = await fetchOpenSkyStates(config);
    const observedAt = payload.time ? new Date(payload.time * 1000) : new Date();
    const flights = normalizeFlights(payload.states, observedAt);

    await upsertFlights(supabase, flights);

    cyclesCompleted += 1;
    lastError = null;

    const details = buildDetails(payload.states?.length ?? 0, flights.length);
    await updateWorkerStatus(supabase, config.workerName, 'healthy', details);

    console.log(
      `[worker] cycle=${cyclesCompleted} fetched=${payload.states?.length ?? 0} upserted=${flights.length} duration_ms=${Date.now() - startedAt}`
    );
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Unknown worker error';

    try {
      await updateWorkerStatus(supabase, config.workerName, 'error', buildDetails(0, 0));
    } catch (statusError) {
      const statusMessage =
        statusError instanceof Error ? statusError.message : 'Unknown worker_status write failure';
      console.error(`[worker] failed to update worker_status after error: ${statusMessage}`);
    }

    console.error(`[worker] cycle failed: ${lastError}`);
  } finally {
    isRunning = false;
  }
}

function buildDetails(fetchedStates: number, upsertedFlights: number): WorkerStatusDetails {
  return {
    cycles_completed: cyclesCompleted,
    fetched_states: fetchedStates,
    upserted_flights: upsertedFlights,
    poll_interval_ms: config.pollIntervalMs,
    last_error: lastError
  };
}

function shutdown() {
  clearInterval(interval);
  console.log('[worker] shutting down.');
  process.exit(0);
}
