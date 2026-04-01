import { createClient } from '@supabase/supabase-js'
import { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } from '@/variables'

const supabaseUrl = VITE_SUPABASE_URL
const supabaseAnonKey = VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Auth features will be unavailable.')
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder')
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
