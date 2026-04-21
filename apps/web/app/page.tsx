export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Flight Tracker</p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Air traffic visibility is coming soon.
        </h1>
        <p className="max-w-2xl text-lg text-slate-300">
          This project is being set up as the foundation for a live flight-tracking experience.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/20">
        <h2 className="text-xl font-semibold text-white">Planned capabilities</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-200">
          <li>live aircraft positions will be shown later</li>
          <li>region filtering is planned</li>
          <li>realtime updates are planned</li>
        </ul>
      </section>
    </main>
  );
}
