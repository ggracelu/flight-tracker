import type { OpenSkyStatesResponse, WorkerConfig } from './types.js';

const TOKEN_EXPIRY_SKEW_MS = 60_000;

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;

export async function fetchOpenSkyStates(config: WorkerConfig): Promise<OpenSkyStatesResponse> {
  const headers = new Headers({
    Accept: 'application/json'
  });

  const accessToken = await getOpenSkyAccessToken(config);

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
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

async function getOpenSkyAccessToken(config: WorkerConfig): Promise<string | null> {
  if (!config.openskyClientId || !config.openskyClientSecret) {
    return null;
  }

  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - TOKEN_EXPIRY_SKEW_MS) {
    return cachedAccessToken;
  }

  const response = await fetch(config.openskyTokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.openskyClientId,
      client_secret: config.openskyClientSecret
    })
  });

  if (!response.ok) {
    throw new Error(`OpenSky token request failed with status ${response.status} ${response.statusText}.`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error('OpenSky token request succeeded but no access_token was returned.');
  }

  cachedAccessToken = payload.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max((payload.expires_in ?? 300) * 1000, TOKEN_EXPIRY_SKEW_MS);

  return cachedAccessToken;
}
