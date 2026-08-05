import { create } from 'zustand'

export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'scanning' | 'sampling' | 'done' | 'error'

export type ScanProgress = {
  phase: 'catalog' | 'lineage'
  done: number
  total: number
  startedAt: number
}

type SessionState = {
  company: string
  accessToken: string
  accessExpiry: string
  displayName: string
  status: SessionStatus
  error: string | null
  scanProgress: ScanProgress | null
  setConfig: (company: string) => void
  setTokens: (t: { accessToken: string; accessExpiry: string; displayName: string }) => void
  setStatus: (s: SessionStatus, error?: string | null) => void
  setScanProgress: (p: ScanProgress | null) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  company: '',
  accessToken: '',
  accessExpiry: '',
  displayName: '',
  status: 'idle',
  error: null,
  scanProgress: null,
  setConfig: (company) => set({ company }),
  setTokens: ({ accessToken, accessExpiry, displayName }) =>
    set({ accessToken, accessExpiry, displayName, status: 'connected', error: null }),
  setStatus: (status, error = null) => set({ status, error }),
  setScanProgress: (scanProgress) => set({ scanProgress }),
  clearSession: () =>
    set({
      company: '',
      accessToken: '',
      accessExpiry: '',
      displayName: '',
      status: 'idle',
      error: null,
      scanProgress: null,
    }),
}))
