export const HOUSEHOLD_ID = '7e2a1c0a-0f3e-4b9a-9c1d-a1b2c3d4e5f6'

export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
  )
}
