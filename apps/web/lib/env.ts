export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
};

export const isSupabaseConfigured =
  publicEnv.supabaseUrl.length > 0 && publicEnv.supabaseAnonKey.length > 0;
