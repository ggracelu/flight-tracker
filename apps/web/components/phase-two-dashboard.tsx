'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { isSupabaseConfigured } from '@/lib/env';
import { REGION_LABELS, REGION_OPTIONS, type UserRegion } from '@/lib/types';

type AuthMode = 'sign-in' | 'sign-up';

const supabase = isSupabaseConfigured ? getSupabaseBrowserClient() : null;

export function PhaseTwoDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regions, setRegions] = useState<UserRegion[]>([]);
  const [selectedRegionKey, setSelectedRegionKey] = useState(REGION_OPTIONS[0]?.key ?? '');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [regionMessage, setRegionMessage] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [submittingRegion, setSubmittingRegion] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
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

    if (authMode === 'sign-up') {
      setAuthMessage('Account created. Check your email if your Supabase project requires confirmation.');
    } else {
      setAuthMessage('Signed in.');
    }

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

  const availableRegions = useMemo(() => {
    const selectedKeys = new Set(regions.map((region) => region.region_key));
    return REGION_OPTIONS.filter((option) => !selectedKeys.has(option.key));
  }, [regions]);

  useEffect(() => {
    if (availableRegions.length > 0 && !availableRegions.some((region) => region.key === selectedRegionKey)) {
      setSelectedRegionKey(availableRegions[0].key);
    }
  }, [availableRegions, selectedRegionKey]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-10">
      <section className="grid gap-6 rounded-[2rem] border border-sky-400/20 bg-slate-950/80 p-8 shadow-[0_30px_80px_rgba(2,8,23,0.55)] backdrop-blur lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Flight Tracker</p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Phase 2 sets the data and account foundation for live aircraft tracking.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              The frontend now connects to Supabase for authentication and saved regional preferences.
              Shared flight telemetry, the live map, and the OpenSky ingestion worker arrive in later phases.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard
              title="Auth Ready"
              text="Email/password sign up and sign in are wired for Supabase Auth."
            />
            <InfoCard
              title="Realtime Ready"
              text="The database foundation is prepared for a shared flights feed via Supabase Realtime."
            />
            <InfoCard
              title="Personalization"
              text="Users can save the regions they want to monitor before the live telemetry UI lands."
            />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/90 p-6">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-400">Account</p>
          {!isSupabaseConfigured ? (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `apps/web/.env.local`
              to enable auth and personalization.
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
                <AuthModeButton
                  active={authMode === 'sign-in'}
                  label="Sign In"
                  onClick={() => setAuthMode('sign-in')}
                />
                <AuthModeButton
                  active={authMode === 'sign-up'}
                  label="Sign Up"
                  onClick={() => setAuthMode('sign-up')}
                />
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

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/80 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">My Regions</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Personalization scaffold</h2>
            </div>
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-200">
              Supabase
            </span>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Saved regions define which geographic areas the signed-in user wants to prioritize later.
            Phase 2 stores these preferences now so the live telemetry and map phases can build on them.
          </p>

          {session ? (
            <>
              <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleAddRegion}>
                <select
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                  disabled={availableRegions.length === 0 || submittingRegion}
                  onChange={(event) => setSelectedRegionKey(event.target.value)}
                  value={selectedRegionKey}
                >
                  {availableRegions.map((option) => (
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
                    No saved regions yet. Add one to prepare your personalized dashboard.
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
              Sign in to save your preferred regions.
            </div>
          )}

          {regionMessage ? <p className="mt-4 text-sm text-slate-300">{regionMessage}</p> : null}
        </div>

        <div className="space-y-6 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,0.95))] p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">Dashboard Status</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">What exists now</h2>
          </div>

          <ul className="space-y-3 text-sm leading-7 text-slate-200">
            <li>Supabase Auth is the account system for personalization.</li>
            <li>`user_regions` stores each user&apos;s saved regional interests.</li>
            <li>`flights` is prepared as the shared telemetry table for later OpenSky ingestion.</li>
            <li>Supabase Realtime will later broadcast flight updates to the frontend.</li>
          </ul>

          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Later Phases</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              The live aircraft list, moving map, and Railway worker are intentionally deferred. This phase
              focuses on durable schema, access control, and user-specific preferences so later telemetry work
              lands on a stable foundation.
            </p>
          </div>
        </div>
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
