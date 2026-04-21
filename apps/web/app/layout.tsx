import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flight Tracker',
  description: 'Phase 4 live flight dashboard with Supabase realtime, region filters, and a synced map/list view.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
