import type { Session, User } from '@supabase/supabase-js'
import { createStore, useStore } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface SupabaseAuthState {
  session: Session | null
  user: User | null
  loading: boolean
  initialized: boolean
}

interface SupabaseAuthActions {
  initialize: () => void
  signInWithGoogle: () => Promise<{ error: string | null }>
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  getAccessToken: () => string | null
}

let initStarted = false

export const supabaseAuthStore = createStore<SupabaseAuthState & SupabaseAuthActions>()(
  subscribeWithSelector((set, get) => ({
    session: null,
    user: null,
    loading: true,
    initialized: false,

    initialize: () => {
      if (initStarted) return
      initStarted = true

      if (!isSupabaseConfigured) {
        set({ loading: false, initialized: true })
        return
      }

      supabase.auth.getSession().then(({ data: { session } }) => {
        set({
          session,
          user: session?.user ?? null,
          loading: false,
          initialized: true,
        })
      })

      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user ?? null,
          loading: false,
          initialized: true,
        })
      })
    },

    signInWithGoogle: async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (error) return { error: error.message }
      return { error: null }
    },

    signInWithEmail: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      return { error: null }
    },

    signUpWithEmail: async (email: string, password: string) => {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) return { error: error.message }
      return { error: null }
    },

    signOut: async () => {
      await supabase.auth.signOut()
      set({ session: null, user: null })
    },

    getAccessToken: () => {
      return get().session?.access_token ?? null
    },
  }))
)

export function useSupabaseAuthStore<U>(selector: Parameters<typeof useStore<typeof supabaseAuthStore, U>>[1]) {
  return useStore<typeof supabaseAuthStore, U>(supabaseAuthStore, selector)
}

export const useSupabaseSession = () => useSupabaseAuthStore((s) => s.session)
export const useSupabaseUser = () => useSupabaseAuthStore((s) => s.user)
export const useSupabaseLoading = () => useSupabaseAuthStore((s) => s.loading)
export const useSupabaseInitialized = () => useSupabaseAuthStore((s) => s.initialized)
