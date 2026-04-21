import type { OpenSkyStatesResponse, WorkerConfig } from './types.js';

export async function fetchOpenSkyStates(config: WorkerConfig): Promise<OpenSkyStatesResponse> {
  const headers = new Headers({
    Accept: 'application/json'
  });

  if (config.openskyUsername && config.openskyPassword) {
    const auth = Buffer.from(`${config.openskyUsername}:${config.openskyPassword}`).toString('base64');
    headers.set('Authorization', `Basic ${auth}`);
  }

  const response = await fetch(config.openskyBaseUrl, {
    headers
  });

  if (!response.ok) {
    throw new Error(`OpenSky request failed with status ${response.status} ${response.statusText}.`);
  }

  const payload = (await response.json()) as OpenSkyStatesResponse;
  return {
    time: payload.time ?? null,
    states: payload.states ?? []
  };
}
