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
type FreshnessState = 'fresh' | 'stale' | 'unknown';

const FlightMap = dynamic(
  () => import('@/components/flight-map').then((module) => module.FlightMap),
  {
    ssr: false
  }
);

const FLIGHT_LIMIT = 120;
const HEARTBEAT_STALE_MS = 2 * 60 * 1000;
const DATA_STALE_MS = 5 * 60 * 1000;

export function FlightTrackerApp() {
  const supabase = useMemo(() => {
    if (!isSupabaseConfigured) return null;
    if (typeof window === 'undefined') return null;
    return getSupabaseBrowserClient();
  }, []);

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
        setAuthMessage(toUserMessage(error.message, 'We could not restore your session.'));
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
  }, [supabase]);

  const savedRegionKeys = useMemo(() => regions.map((region) => region.region_key), [regions]);

  const availableRegions = useMemo(() => {
    const selectedKeys = new Set(savedRegionKeys);
    return REGION_OPTIONS.filter((option) => !selectedKeys.has(option.key));
  }, [savedRegionKeys]);

  const mapEligibleFlights = useMemo(() => flights.filter(hasValidCoordinates), [flights]);
  const activeFlight = useMemo(
    () => flights.find((flight) => flight.id === activeFlightId) ?? flights[0] ?? null,
    [activeFlightId, flights]
  );

  const activeRegionSummary = useMemo(() => {
    if (!session) {
      return {
        badge: 'Public Live Feed',
        title: 'Browse live flights without signing in',
        description:
          'The map and flight list start on the shared worldwide feed so the app is useful immediately.',
        filterMode: 'Global feed',
        helper: 'Sign in only if you want your own saved region view.'
      };
    }

    if (savedRegionKeys.length === 0) {
      return {
        badge: 'Personalize Your View',
        title: 'You are browsing the public live feed',
        description:
          'Save one or more regions to tailor the map and list to the places you care about. Until then, everything stays fully usable.',
        filterMode: 'Global feed',
        helper: 'Add Global if you want to keep the worldwide view while signed in.'
      };
    }

    if (savedRegionKeys.includes('global')) {
      return {
        badge: 'Saved View',
        title: 'Your saved regions include Global',
        description:
          'You will keep seeing the full shared flight feed while staying signed in across sessions.',
        filterMode: 'Global saved view',
        helper: 'Remove Global if you want the map and list narrowed to specific regions only.'
      };
    }

    return {
      badge: 'Saved View',
      title: savedRegionKeys.map((key) => REGION_LABELS[key] ?? key).join(', '),
      description: 'The map, selected flight details, and flight list stay focused on your saved regions.',
      filterMode: 'Saved region filter',
      helper: 'You can add or remove regions at any time.'
    };
  }, [savedRegionKeys, session]);

  const latestObservationAt = flights[0]?.observed_at ?? null;
  const heartbeatAgeMs = workerStatus ? Date.now() - new Date(workerStatus.last_heartbeat_at).getTime() : null;
  const dataAgeMs = latestObservationAt ? Date.now() - new Date(latestObservationAt).getTime() : null;
  const heartbeatState = getFreshnessState(heartbeatAgeMs, HEARTBEAT_STALE_MS);
  const dataState = getFreshnessState(dataAgeMs, DATA_STALE_MS);
  const systemStatus = getSystemStatus(workerStatus, heartbeatState, dataState, channelHealth);

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
      setFlightMessage(toUserMessage(error.message, 'Live flights are temporarily unavailable.'));
      setFlights([]);
      setLoadingFlights(false);
      return;
    }

    setFlights(data ?? []);
    setFlightMessage(null);
    setLoadingFlights(false);
  }, [savedRegionKeys, session, supabase]);

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
      setRealtimeMessage(toUserMessage(error.message, 'Live update status is temporarily unavailable.'));
      return;
    }

    setWorkerStatus(data);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void refreshFlights();
    void refreshWorkerStatus();
  }, [refreshFlights, refreshWorkerStatus, supabase]);

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
      .channel('flights-live-feed')
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
          setRealtimeMessage('Live updates are having trouble. The latest available flight data is still shown below.');
        }
      });

    channels.push(flightsChannel);

    const workerChannel = supabase
      .channel('flight-system-status')
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
        }
      });

    channels.push(workerChannel);

    return () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [refreshFlights, refreshWorkerStatus, supabase]);

  const loadRegions = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { data, error } = await supabase
      .from('user_regions')
      .select('id, region_key, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      setRegionMessage(toUserMessage(error.message, 'We could not load your saved regions.'));
      return;
    }

    setRegions(data ?? []);
    setRegionMessage(null);
  }, [supabase]);

  useEffect(() => {
    if (!session || !supabase) {
      setRegions([]);
      return;
    }

    void loadRegions();
  }, [loadRegions, session, supabase]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setAuthMessage('Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `apps/web/.env.local` to enable sign-in.');
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
      setAuthMessage(
        toUserMessage(
          result.error.message,
          authMode === 'sign-up' ? 'We could not create your account.' : 'We could not sign you in.'
        )
      );
      setSubmittingAuth(false);
      return;
    }

    setAuthMessage(
      authMode === 'sign-up'
        ? 'Account created. Check your email if confirmation is required before signing in.'
        : 'You are signed in and your saved regions are ready.'
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
      setAuthMessage(toUserMessage(error.message, 'We could not sign you out right now.'));
      return;
    }

    setRegions([]);
    setRegionMessage(null);
    setAuthMessage('Signed out. You are back on the public live feed.');
  }

  async function handleAddRegion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !session) {
      setRegionMessage('Sign in to save regions for your account.');
      return;
    }

    setSubmittingRegion(true);

    const { error } = await supabase.from('user_regions').insert({
      region_key: selectedRegionKey
    });

    if (error) {
      setRegionMessage(toUserMessage(error.message, 'We could not save that region.'));
      setSubmittingRegion(false);
      return;
    }

    await loadRegions();
    setRegionMessage(`${REGION_LABELS[selectedRegionKey] ?? selectedRegionKey} saved to your view.`);
    setSubmittingRegion(false);
  }

  async function handleRemoveRegion(id: string) {
    if (!supabase || !session) {
      return;
    }

    setSubmittingRegion(true);

    const { error } = await supabase.from('user_regions').delete().eq('id', id);

    if (error) {
      setRegionMessage(toUserMessage(error.message, 'We could not remove that region.'));
      setSubmittingRegion(false);
      return;
    }

    await loadRegions();
    setRegionMessage('Saved region removed.');
    setSubmittingRegion(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-8 lg:px-8">
      <section className="grid gap-6 rounded-[2rem] border border-sky-300/20 bg-[linear-gradient(135deg,rgba(8,15,32,0.96),rgba(15,23,42,0.88))] p-6 shadow-[0_30px_80px_rgba(2,8,23,0.45)] backdrop-blur lg:grid-cols-[1.4fr_0.92fr]">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-200">Flight Tracker</p>
              <StatusPill tone={systemStatus.tone} text={systemStatus.label} />
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Live flights, a synced map, and saved regions in one clean view.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
              Browse the public live feed right away, then sign in if you want the map and flight list to follow your
              saved regions everywhere you use the app.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <InfoCard
              title="Feed"
              text={session ? 'Your account view is active and can be personalized with saved regions.' : 'The public live feed is open for instant browsing.'}
            />
            <InfoCard
              title="Flights"
              text={`${flights.length} flights are currently visible, with ${mapEligibleFlights.length} ready to display on the map.`}
            />
            <InfoCard
              title="View"
              text={`${activeRegionSummary.filterMode}. ${activeRegionSummary.helper}`}
            />
            <InfoCard
              title="Updated"
              text={latestObservationAt ? `${formatRelativeTime(latestObservationAt)} from the latest flight update.` : 'Waiting for live flight data to appear.'}
            />
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Current View</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{activeRegionSummary.title}</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-300">
                {activeRegionSummary.badge}
              </span>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{activeRegionSummary.description}</p>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-400">Account</p>
          {!isSupabaseConfigured ? (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
              Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `apps/web/.env.local` to enable
              sign-in and saved regions.
            </div>
          ) : loadingSession ? (
            <p className="mt-4 text-sm text-slate-300">Checking your session...</p>
          ) : session ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Signed In</p>
                <p className="mt-2 text-sm text-white">{session.user.email}</p>
                <p className="mt-2 text-sm text-emerald-100">
                  Save regions below to personalize the map and flight list.
                </p>
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
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4 text-sm leading-6 text-sky-50">
                Keep browsing as a guest, or sign in to save regions and get the same view back next time.
              </div>

              <form className="space-y-4" onSubmit={handleAuthSubmit}>
                <div className="flex gap-2 rounded-full bg-slate-800 p-1 text-sm">
                  <AuthModeButton active={authMode === 'sign-in'} label="Sign In" onClick={() => setAuthMode('sign-in')} />
                  <AuthModeButton active={authMode === 'sign-up'} label="Create Account" onClick={() => setAuthMode('sign-up')} />
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
            </div>
          )}

          {authMessage ? <InlineNotice className="mt-4" tone="neutral" text={authMessage} /> : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.45fr]">
        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">Saved Regions</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">{activeRegionSummary.filterMode}</h2>
              </div>
              <StatusPill tone="neutral" text={session ? 'Signed-In View' : 'Guest View'} />
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-300">{activeRegionSummary.description}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricCard label="Saved Regions" value={session ? String(savedRegionKeys.length) : 'None'} />
              <MetricCard label="Browsing" value={session && savedRegionKeys.length > 0 ? 'Personalized' : 'Public live feed'} />
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
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    disabled={availableRegions.length === 0 || submittingRegion}
                    type="submit"
                  >
                    {availableRegions.length === 0 ? 'All Saved' : submittingRegion ? 'Saving...' : 'Save Region'}
                  </button>
                </form>

                <div className="mt-6 flex flex-wrap gap-3">
                  {regions.length === 0 ? (
                    <div className="w-full rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                      You are still seeing the public live feed. Save a region to make this view personal.
                    </div>
                  ) : (
                    regions.map((region) => (
                      <div
                        className="flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/80 px-4 py-3"
                        key={region.id}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{REGION_LABELS[region.region_key] ?? region.region_key}</p>
                        </div>
                        <button
                          className="rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-rose-100 transition hover:bg-rose-400/20"
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
                Sign in to save regions and keep a personalized flight view across sessions. The public live feed
                stays available either way.
              </div>
            )}

            {regionMessage ? <InlineNotice className="mt-4" tone="neutral" text={regionMessage} /> : null}
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_42%),linear-gradient(180deg,_rgba(15,23,42,0.92),_rgba(2,6,23,0.98))] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">Selected Flight</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {activeFlight ? activeFlight.callsign ?? activeFlight.icao24.toUpperCase() : 'No flight selected'}
                </h2>
              </div>
              <StatusPill tone={activeFlight?.on_ground ? 'neutral' : 'success'} text={activeFlight ? (activeFlight.on_ground ? 'On Ground' : 'In Flight') : 'Waiting'} />
            </div>

            {activeFlight ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StatusLine label="Origin" value={activeFlight.origin_country ?? 'Unknown'} />
                <StatusLine label="Region" value={REGION_LABELS[activeFlight.region_key] ?? activeFlight.region_key} />
                <StatusLine label="Latitude" value={formatCoordinate(activeFlight.latitude)} />
                <StatusLine label="Longitude" value={formatCoordinate(activeFlight.longitude)} />
                <StatusLine label="Altitude" value={formatNumber(activeFlight.baro_altitude, 'm')} />
                <StatusLine label="Speed" value={formatNumber(activeFlight.velocity, 'm/s')} />
                <StatusLine label="Track" value={formatTrack(activeFlight.true_track)} />
                <StatusLine label="Last Seen" value={formatRelativeTime(activeFlight.observed_at)} />
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                Choose a flight from the list or map to inspect it here.
              </div>
            )}
          </div>
        </div>

        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-6">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">Live Map</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">Current flight positions</h2>
              </div>

              <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                <MetricCard label="Visible Flights" value={String(flights.length)} />
                <MetricCard label="Mapped Flights" value={String(mapEligibleFlights.length)} />
                <MetricCard label="Live Updates" value={channelHealth === 'degraded' ? 'Limited' : 'Connected'} />
              </div>
            </div>

            {realtimeMessage ? <InlineNotice className="mt-6" tone="warning" text={realtimeMessage} /> : null}

            <div className="mt-6">
              <FlightMap
                activeFlightId={activeFlightId}
                emptyMessage="No flights with usable map coordinates are available for this view yet."
                errorMessage={flightMessage}
                flights={flights}
                loading={loadingFlights}
                onSelectFlight={setActiveFlightId}
              />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-6">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">Flight Feed</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">List and map stay in sync</h2>
              </div>

              <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                <MetricCard label="Latest Update" value={latestObservationAt ? formatRelativeTime(latestObservationAt) : 'Waiting'} />
                <MetricCard label="Flight Data" value={formatFreshnessLabel(dataState)} />
                <MetricCard label="System" value={systemStatus.shortLabel} />
              </div>
            </div>

            {flightMessage ? <InlineNotice className="mt-6" tone="error" text={flightMessage} /> : null}

            {loadingFlights ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                Loading the latest live flights...
              </div>
            ) : flights.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-300">
                No live flights match this view right now. Try again in a moment or broaden your saved regions.
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
                <div className="hidden grid-cols-[1.1fr_1fr_1fr_0.95fr_0.95fr_0.75fr_1fr_1fr] gap-3 bg-slate-950/80 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400 lg:grid">
                  <span>Flight</span>
                  <span>Origin</span>
                  <span>Latitude</span>
                  <span>Longitude</span>
                  <span>Altitude</span>
                  <span>Status</span>
                  <span>Region</span>
                  <span>Updated</span>
                </div>

                <div className="divide-y divide-white/10">
                  {flights.map((flight) => (
                    <article
                      className={`grid gap-3 px-4 py-4 transition lg:grid-cols-[1.1fr_1fr_1fr_0.95fr_0.95fr_0.75fr_1fr_1fr] lg:items-center ${
                        flight.id === activeFlightId ? 'bg-cyan-300/10' : 'bg-slate-950/55 hover:bg-white/5'
                      }`}
                      key={flight.id}
                    >
                      <button className="contents text-left" onClick={() => setActiveFlightId(flight.id)} type="button">
                        <FlightCell label="Flight" value={flight.callsign ?? flight.icao24.toUpperCase()} />
                        <FlightCell label="Origin" value={flight.origin_country ?? 'Unknown'} />
                        <FlightCell label="Latitude" value={formatCoordinate(flight.latitude)} />
                        <FlightCell label="Longitude" value={formatCoordinate(flight.longitude)} />
                        <FlightCell label="Altitude" value={formatNumber(flight.baro_altitude, 'm')} />
                        <FlightCell label="Status" value={flight.on_ground ? 'On ground' : 'In flight'} />
                        <FlightCell label="Region" value={REGION_LABELS[flight.region_key] ?? flight.region_key} />
                        <FlightCell label="Updated" value={formatRelativeTime(flight.observed_at)} />
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

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-white">{value}</span>
    </div>
  );
}

function InlineNotice({
  className,
  text,
  tone
}: {
  className?: string;
  text: string;
  tone: 'neutral' | 'warning' | 'error';
}) {
  const styles =
    tone === 'warning'
      ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
      : tone === 'error'
        ? 'border-rose-300/20 bg-rose-400/10 text-rose-100'
        : 'border-white/10 bg-white/5 text-slate-200';

  return <div className={`${className ?? ''} rounded-2xl border p-4 text-sm leading-6 ${styles}`}>{text}</div>;
}

function StatusPill({ text, tone }: { text: string; tone: 'neutral' | 'success' | 'warning' | 'error' }) {
  const styles =
    tone === 'success'
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
      : tone === 'warning'
        ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
        : tone === 'error'
          ? 'border-rose-300/20 bg-rose-400/10 text-rose-100'
          : 'border-white/10 bg-white/5 text-slate-200';

  return <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.25em] ${styles}`}>{text}</span>;
}

function formatCoordinate(value: number | null) {
  return value === null ? 'Unknown' : value.toFixed(3);
}

function formatNumber(value: number | null, suffix: string) {
  return value === null ? 'Unknown' : `${Math.round(value).toLocaleString()} ${suffix}`;
}

function formatTrack(value: number | null) {
  return value === null ? 'Unknown' : `${Math.round(value)}°`;
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

function getFreshnessState(ageMs: number | null, staleAfterMs: number): FreshnessState {
  if (ageMs === null || Number.isNaN(ageMs)) {
    return 'unknown';
  }

  return ageMs > staleAfterMs ? 'stale' : 'fresh';
}

function formatFreshnessLabel(state: FreshnessState) {
  if (state === 'fresh') {
    return 'Fresh';
  }

  if (state === 'stale') {
    return 'Delayed';
  }

  return 'Unknown';
}

function getSystemStatus(
  workerStatus: WorkerStatusRow | null,
  heartbeatState: FreshnessState,
  dataState: FreshnessState,
  channelHealth: ChannelHealth
) {
  if (!workerStatus) {
    return {
      label: 'Waiting For Live Data',
      shortLabel: 'Waiting',
      tone: 'warning' as const
    };
  }

  if (channelHealth === 'degraded' || heartbeatState === 'stale' || dataState === 'stale' || workerStatus.status !== 'healthy') {
    return {
      label: 'Live Feed Limited',
      shortLabel: 'Limited',
      tone: 'warning' as const
    };
  }

  return {
    label: 'Live Feed Healthy',
    shortLabel: 'Healthy',
    tone: 'success' as const
  };
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

function toUserMessage(sourceMessage: string, fallback: string) {
  const message = sourceMessage.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'That email and password combination was not recognized.';
  }

  if (message.includes('email not confirmed')) {
    return 'Your account needs email confirmation before you can sign in.';
  }

  if (message.includes('duplicate key value') || message.includes('duplicate')) {
    return 'That item is already saved.';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'A network issue interrupted the request. Please try again.';
  }

  if (message.includes('row-level security')) {
    return 'This action is not available for your current account.';
  }

  return fallback;
}
