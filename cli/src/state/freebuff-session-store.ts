import { create } from 'zustand'

import type { FreebuffSessionResponse } from '../types/freebuff-session'

interface FreebuffSessionStore {
  session: FreebuffSessionResponse | null
  error: string | null

  setSession: (session: FreebuffSessionResponse | null) => void
  setError: (error: string | null) => void
}

export const useFreebuffSessionStore = create<FreebuffSessionStore>((set) => ({
  session: null,
  error: null,
  setSession: (session) => set({ session }),
  setError: (error) => set({ error }),
}))
