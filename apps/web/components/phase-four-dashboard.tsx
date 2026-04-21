'use client';

import dynamic from 'next/dynamic';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import {
  FlightRow,
  REGION_LABELS,
  REGION_OPTIONS,
  UserRegion,
  WorkerStatusRow,
  type RegionOption
} from '@/lib/types';

type AuthMode = 'sign-in' | 'sign-up';
type ChannelHealth = 'idle' | 'healthy' | 'degraded';

const FlightMap = dynamic(
  () => import('@/components/flight-map').then((module) => module.FlightMap),
  {
    ssr: false
  }
);

const supabase = isSupabaseConfigured ? getSupabaseBrowserClient() : null;
const FLIGHT_LIMIT = 120;
const HEARTBEAT_STALE_MS = 2 * 60 * 1000;
const DATA_STALE_MS = 5 * 60 * 1000;

export function PhaseFourDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regions, setRegions] = useState<UserRegion[]>([]);
  const [selectedRegionKey, setSelectedRegionKey] = useState(REGION_OPTIONS[0]?.key ?? '');
  const [activeFlightId, setActiveFlightId] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [regionMessage, setRegionMessage] = useState<string | null>(null);
  const [flightMessage, setFlightMessage] = useState<string | null>(null);
  const [realtimeMessage, setRealtimeMessage] = useState<string | null>(null);
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatusRow | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingFlights, setLoadingFlights] = useState(true);
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [submittingRegion, setSubmittingRegion] = useState(false);
  const [channelHealth, setChannelHealth] = useState<ChannelHealth>('idle');

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      setLoadingFlights(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthMessage(error.message);
      }

      setSession(data.session);
      setLoadingSession(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthMessage(null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setRegions([]);
      return;
    }

    void loadRegions();
  }, [session]);

  const savedRegionKeys = useMemo(() => regions.map((region) => region.region_key), [regions]);

  const availableRegions = useMemo(() => {
    const selectedKeys = new Set(savedRegionKeys);
    return REGION_OPTIONS.filter((option) => !selectedKeys.has(option.key));
  }, [savedRegionKeys]);

  const activeRegionSummary = useMemo(() => {
    if (!session) {
      return {
        label: 'Public global view',
        description: 'Anonymous visitors see the shared global telemetry stream across the map and flight list.',
        filterMode: 'Public shared feed'
      };
    }

    if (savedRegionKeys.length === 0) {
      return {
        label: 'No saved regions',
        description: 'Add one or more regions to unlock your personalized map and list view.',
        filterMode: 'No personalized regions saved'
      };
    }

    if (savedRegionKeys.includes('global')) {
      return {
        label: 'Global preference enabled',
        description: 'Your saved regions include Global, so both the map and list show the full shared feed.',
        filterMode: 'Global override'
      };
    }

    return {
      label: savedRegionKeys.map((key) => REGION_LABELS[key] ?? key).join(', '),
      description: 'The map and list stay locked to the regions saved on your account.',
      filterMode: 'Personalized region filter'
    };
  }, [savedRegionKeys, session]);

  const mapEligibleFlights = useMemo(() => flights.filter(hasValidCoordinates), [flights]);

  const latestObservationAt = flights[0]?.observed_at ?? null;
  const heartbeatAgeMs = workerStatus ? Date.now() - new Date(workerStatus.last_heartbeat_at).getTime() : null;
  const dataAgeMs = latestObservationAt ? Date.now() - new Date(latestObservationAt).getTime() : null;
  const heartbeatState = getFreshnessState(heartbeatAgeMs, HEARTBEAT_STALE_MS);
  const dataState = getFreshnessState(dataAgeMs, DATA_STALE_MS);

  useEffect(() => {
    if (availableRegions.length > 0 && !availableRegions.some((region) => region.key === selectedRegionKey)) {
      setSelectedRegionKey(availableRegions[0].key);
    }
  }, [availableRegions, selectedRegionKey]);

  const refreshFlights = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setLoadingFlights(true);

    let query = supabase
      .from('flights')
      .select(
        'id, icao24, callsign, origin_country, longitude, latitude, baro_altitude, velocity, true_track, vertical_rate, on_ground, last_contact, observed_at, region_key, updated_at'
      )
      .order('observed_at', { ascending: false })
      .limit(FLIGHT_LIMIT);

    if (session && savedRegionKeys.length > 0 && !savedRegionKeys.includes('global')) {
      query = query.in('region_key', savedRegionKeys);
    }

    const { data, error } = await query;

    if (error) {
      setFlightMessage(error.message);
      setFlights([]);
      setLoadingFlights(false);
      return;
    }

    setFlights(data ?? []);
    setFlightMessage(null);
    setLoadingFlights(false);
  }, [savedRegionKeys, session]);

  const refreshWorkerStatus = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from('worker_status')
      .select('id, worker_name, status, last_heartbeat_at, details, created_at, updated_at')
      .eq('worker_name', 'opensky-worker')
      .maybeSingle();

    if (error) {
      setFlightMessage(error.message);
      return;
    }

    setWorkerStatus(data);
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    if (session && savedRegionKeys.length === 0) {
      setFlights([]);
      setLoadingFlights(false);
      return;
    }

    void refreshFlights();
    void refreshWorkerStatus();
  }, [refreshFlights, refreshWorkerStatus, savedRegionKeys, session]);

  useEffect(() => {
    if (!flights.some((flight) => flight.id === activeFlightId)) {
      setActiveFlightId(flights[0]?.id ?? null);
    }
  }, [activeFlightId, flights]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const channels: RealtimeChannel[] = [];

    const flightsChannel = supabase
      .channel('phase4-flights')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flights'
        },
        () => {
          void refreshFlights();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannelHealth('healthy');
          setRealtimeMessage(null);
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChannelHealth('degraded');
          setRealtimeMessage('Realtime is unavailable. The dashboard is showing the latest fetched data.');
        }
      });

    channels.push(flightsChannel);

    const workerChannel = supabase
      .channel('phase4-worker-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_status'
        },
        () => {
          void refreshWorkerStatus();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChannelHealth('degraded');
          setRealtimeMessage('Realtime is unavailable. Worker heartbeat updates may lag until refresh.');
        }
      });

    channels.push(workerChannel);

    return () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [refreshFlights, refreshWorkerStatus]);

  async function loadRegions() {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from('user_regions')
      .select('id, region_key, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      setRegionMessage(error.message);
      return;
    }

    setRegions(data ?? []);
    setRegionMessage(null);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setAuthMessage('Add the Supabase URL and anon key to apps/web/.env.local first.');
      return;
    }

    setSubmittingAuth(true);
    setAuthMessage(null);

    const credentials = {
      email: email.trim(),
      password
    };

    const result =
      authMode === 'sign-up'
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    if (result.error) {
      setAuthMessage(result.error.message);
      setSubmittingAuth(false);
      return;
    }

    setAuthMessage(
      authMode === 'sign-up'
        ? 'Account created. Check your email if your Supabase project requires confirmation.'
        : 'Signed in.'
    );
    setSubmittingAuth(false);
    setPassword('');
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setRegions([]);
    setRegionMessage(null);
    setAuthMessage('Signed out.');
  }

  async function handleAddRegion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !session) {
      setRegionMessage('Sign in before saving regions.');
      return;
    }

    setSubmittingRegion(true);

    const { error } = await supabase.from('user_regions').insert({
      region_key: selectedRegionKey
    });

    if (error) {
      setRegionMessage(error.message);
      setSubmittingRegion(false);
      return;
    }

    await loadRegions();
    setRegionMessage('Region saved.');
    setSubmittingRegion(false);
  }

  async function handleRemoveRegion(id: string) {
    if (!supabase || !session) {
      return;
    }

    setSubmittingRegion(true);

    const { error } = await supabase.from('user_regions').delete().eq('id', id);

    if (error) {
      setRegionMessage(error.message);
      setSubmittingRegion(false);
      return;
    }

    await loadRegions();
    setRegionMessage('Region removed.');
    setSubmittingRegion(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-8 lg:px-8">
      <section className="grid gap-6 rounded-[2rem] border border-sky-400/20 bg-slate-950/80 p-6 shadow-[0_30px_80px_rgba(2,8,23,0.55)] backdrop-blur lg:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Flight Tracker</p>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Phase 4 adds a live map on top of the existing worker, Supabase, and Realtime pipeline.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
              The browser still reads from Supabase only. The worker keeps polling OpenSky, Supabase stays the
              shared source of truth, and the dashboard now keeps the list and map in sync.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <InfoCard
              title="Heartbeat"
              text={
                workerStatus
                  ? `${formatFreshnessLabel(heartbeatState)} heartbeat, last seen ${formatRelativeTime(workerStatus.last_heartbeat_at)}.`
                  : 'Waiting for the worker heartbeat row to appear in Supabase.'
              }
            />
            <InfoCard
              title="Visible Flights"
              text={`${flights.length} flights in the current feed, ${mapEligibleFlights.length} with valid map coordinates.`}
            />
            <InfoCard title="Region State" text={`${activeRegionSummary.label}. ${activeRegionSummary.description}`} />
            <InfoCard
              title="Realtime"
              text={
                channelHealth === 'degraded'
                  ? 'Realtime is degraded. The UI remains usable with the last successful fetch.'
                  : 'Supabase Realtime keeps the map and list synced with database changes.'
              }
            />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/90 p-6">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-400">Account</p>
          {!isSupabaseConfigured ? (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `apps/web/.env.local`
              to enable auth, personalization, and the live dashboard.
            </div>
          ) : loadingSession ? (
            <p className="mt-4 text-sm text-slate-300">Checking session...</p>
          ) : session ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Signed In</p>
                <p className="mt-2 text-sm text-white">{session.user.email}</p>
              </div>
              <button
                className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                onClick={handleSignOut}
                type="button"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={handleAuthSubmit}>
              <div className="flex gap-2 rounded-full bg-slate-800 p-1 text-sm">
                <AuthModeButton active={authMode === 'sign-in'} label="Sign In" onClick={() => setAuthMode('sign-in')} />
                <AuthModeButton active={authMode === 'sign-up'} label="Sign Up" onClick={() => setAuthMode('sign-up')} />
              </div>

              <label className="block space-y-2 text-sm text-slate-300">
                <span>Email</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-300">
                <span>Password</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>

              <button
                className="w-full rounded-full bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                disabled={submittingAuth}
                type="submit"
              >
                {submittingAuth ? 'Working...' : authMode === 'sign-up' ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          )}

          {authMessage ? <p className="mt-4 text-sm text-slate-300">{authMessage}</p> : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.45fr]">
        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">Region Filter</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">{activeRegionSummary.label}</h2>
              </div>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-200">
                Phase 4
              </span>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-300">{activeRegionSummary.description}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricCard label="Filter Mode" value={activeRegionSummary.filterMode} />
              <MetricCard label="Saved Regions" value={session ? String(savedRegionKeys.length) : 'Public'} />
            </div>

            {session ? (
              <>
                <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleAddRegion}>
                  <select
                    className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                    disabled={availableRegions.length === 0 || submittingRegion}
                    onChange={(event) => setSelectedRegionKey(event.target.value)}
                    value={selectedRegionKey}
                  >
                    {availableRegions.map((option: RegionOption) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    disabled={availableRegions.length === 0 || submittingRegion}
                    type="submit"
                  >
                    {availableRegions.length === 0 ? 'All Added' : submittingRegion ? 'Saving...' : 'Add Region'}
                  </button>
                </form>

                <div className="mt-6 space-y-3">
                  {regions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                      No saved regions yet. Add one to switch from the public feed to a personalized live view.
                    </div>
                  ) : (
                    regions.map((region) => (
                      <div
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4"
                        key={region.id}
                      >
                        <div>
                          <p className="font-medium text-white">{REGION_LABELS[region.region_key] ?? region.region_key}</p>
                          <p className="text-sm text-slate-400">{region.region_key}</p>
                        </div>
                        <button
                          className="rounded-full border border-rose-300/25 bg-rose-400/10 px-4 py-2 text-sm text-rose-100 transition hover:bg-rose-400/20"
                          onClick={() => void handleRemoveRegion(region.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                Sign in to save a personalized region filter. Until then, the dashboard stays on the public global feed.
              </div>
            )}

            {regionMessage ? <p className="mt-4 text-sm text-slate-300">{regionMessage}</p> : null}
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,0.95))] p-6">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">Worker Status</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Background ingestion heartbeat</h2>

            {workerStatus ? (
              <div className="mt-5 space-y-4">
                <StatusBadge status={workerStatus.status} />
                <StatusLine label="Worker freshness" value={formatFreshnessLabel(heartbeatState)} />
                <StatusLine label="Last heartbeat" value={formatDateTime(workerStatus.last_heartbeat_at)} />
                <StatusLine label="Heartbeat age" value={formatAge(workerStatus.last_heartbeat_at)} />
                <StatusLine
                  label="Latest observation"
                  value={latestObservationAt ? `${formatDateTime(latestObservationAt)} (${formatFreshnessLabel(dataState)})` : 'No observations yet'}
                />
                <StatusLine label="Cycles completed" value={String(workerStatus.details.cycles_completed ?? 0)} />
                <StatusLine label="Last fetched states" value={String(workerStatus.details.fetched_states ?? 0)} />
                <StatusLine label="Last upserted flights" value={String(workerStatus.details.upserted_flights ?? 0)} />
                <StatusLine label="Poll interval" value={`${workerStatus.details.poll_interval_ms ?? 'unknown'} ms`} />
                <StatusLine label="Last error" value={(workerStatus.details.last_error as string | null) ?? 'None'} />
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                No heartbeat row yet. Start the worker locally and check that it can write to `worker_status`.
              </div>
            )}
          </div>
        </div>

        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-6">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">Live Map</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">Realtime telemetry dashboard</h2>
              </div>

              <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                <MetricCard label="Visible Flights" value={String(flights.length)} />
                <MetricCard label="Mapped Flights" value={String(mapEligibleFlights.length)} />
                <MetricCard label="Realtime" value={channelHealth === 'degraded' ? 'Degraded' : 'Connected'} />
              </div>
            </div>

            {realtimeMessage ? (
              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                {realtimeMessage}
              </div>
            ) : null}

            {session && savedRegionKeys.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                Save at least one region to enable your personalized live map and list. Add `Global` if you want the full shared stream while signed in.
              </div>
            ) : (
              <div className="mt-6">
                <FlightMap
                  activeFlightId={activeFlightId}
                  emptyMessage="No flights with valid coordinates matched the current filter yet."
                  errorMessage={flightMessage}
                  flights={flights}
                  loading={loadingFlights}
                  onSelectFlight={setActiveFlightId}
                />
              </div>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-6">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">Flight Feed</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">Map and list stay synchronized</h2>
              </div>

              <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                <MetricCard label="Latest Observation" value={latestObservationAt ? formatRelativeTime(latestObservationAt) : 'No data'} />
                <MetricCard label="Heartbeat" value={workerStatus ? formatRelativeTime(workerStatus.last_heartbeat_at) : 'Waiting'} />
                <MetricCard label="Data Freshness" value={formatFreshnessLabel(dataState)} />
              </div>
            </div>

            {flightMessage ? (
              <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                {flightMessage}
              </div>
            ) : null}

            {loadingFlights ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                Loading live flights from Supabase...
              </div>
            ) : session && savedRegionKeys.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                Save at least one region to enable your personalized live feed. Add `Global` if you want the full shared stream while signed in.
              </div>
            ) : flights.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                No flights matched the current filter yet. Wait for the worker to ingest data or broaden the selected region set.
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
                <div className="hidden grid-cols-[1.1fr_1fr_1fr_0.95fr_0.95fr_0.75fr_1fr_1fr] gap-3 bg-slate-950/80 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400 lg:grid">
                  <span>Callsign</span>
                  <span>Origin</span>
                  <span>Latitude</span>
                  <span>Longitude</span>
                  <span>Altitude</span>
                  <span>Ground</span>
                  <span>Region</span>
                  <span>Observed</span>
                </div>

                <div className="divide-y divide-white/10">
                  {flights.map((flight) => (
                    <article
                      className={`grid gap-3 px-4 py-4 lg:grid-cols-[1.1fr_1fr_1fr_0.95fr_0.95fr_0.75fr_1fr_1fr] lg:items-center ${
                        flight.id === activeFlightId ? 'bg-cyan-300/10' : 'bg-slate-950/55'
                      }`}
                      key={flight.id}
                    >
                      <button
                        className="contents text-left"
                        onClick={() => setActiveFlightId(flight.id)}
                        type="button"
                      >
                        <FlightCell label="Callsign" value={flight.callsign ?? flight.icao24.toUpperCase()} />
                        <FlightCell label="Origin" value={flight.origin_country ?? 'Unknown'} />
                        <FlightCell label="Latitude" value={formatCoordinate(flight.latitude)} />
                        <FlightCell label="Longitude" value={formatCoordinate(flight.longitude)} />
                        <FlightCell label="Altitude" value={formatNumber(flight.baro_altitude, 'm')} />
                        <FlightCell label="Ground" value={flight.on_ground ? 'Yes' : 'No'} />
                        <FlightCell label="Region" value={REGION_LABELS[flight.region_key] ?? flight.region_key} />
                        <FlightCell label="Observed" value={formatRelativeTime(flight.observed_at)} />
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function AuthModeButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex-1 rounded-full px-3 py-2 transition ${
        active ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}

function FlightCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 lg:hidden">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'healthy'
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
      : 'border-rose-300/20 bg-rose-400/10 text-rose-100';

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.25em] ${tone}`}>
      {status}
    </span>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-white">{value}</span>
    </div>
  );
}

function formatCoordinate(value: number | null) {
  return value === null ? 'Unknown' : value.toFixed(3);
}

function formatNumber(value: number | null, suffix: string) {
  return value === null ? 'Unknown' : `${Math.round(value).toLocaleString()} ${suffix}`;
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  if (diffSeconds < 3600) {
    return `${Math.round(diffSeconds / 60)}m ago`;
  }

  return `${Math.round(diffSeconds / 3600)}h ago`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatAge(value: string) {
  return formatRelativeTime(value);
}

function getFreshnessState(ageMs: number | null, staleAfterMs: number) {
  if (ageMs === null || Number.isNaN(ageMs)) {
    return 'unknown';
  }

  return ageMs > staleAfterMs ? 'stale' : 'fresh';
}

function formatFreshnessLabel(state: 'fresh' | 'stale' | 'unknown') {
  if (state === 'fresh') {
    return 'Fresh';
  }

  if (state === 'stale') {
    return 'Stale';
  }

  return 'Unknown';
}

function hasValidCoordinates(flight: FlightRow) {
  return (
    typeof flight.latitude === 'number' &&
    Number.isFinite(flight.latitude) &&
    flight.latitude >= -90 &&
    flight.latitude <= 90 &&
    typeof flight.longitude === 'number' &&
    Number.isFinite(flight.longitude) &&
    flight.longitude >= -180 &&
    flight.longitude <= 180
  );
}
