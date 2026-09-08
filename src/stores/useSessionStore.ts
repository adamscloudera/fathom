import { create } from 'zustand'

export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'scanning' | 'sampling' | 'done' | 'error'

export type ScanProgress = {
  phase: 'catalog' | 'lineage' | 'dashboard'
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

let _initialCompany = ''
try { _initialCompany = localStorage.getItem('fathom:company') ?? '' } catch (_) {}

export const useSessionStore = create<SessionState>((set) => ({
  company: _initialCompany,
  accessToken: '',
  accessExpiry: '',
  displayName: '',
  status: 'idle',
  error: null,
  scanProgress: null,
  setConfig: (company) => {
    set({ company })
    try { localStorage.setItem('fathom:company', company) } catch (_) {}
  },
  setTokens: ({ accessToken, accessExpiry, displayName }) =>
    set({ accessToken, accessExpiry, displayName, status: 'connected', error: null }),
  setStatus: (status, error = null) => set({ status, error }),
  setScanProgress: (scanProgress) => set({ scanProgress }),
  clearSession: () => {
    try { localStorage.removeItem('fathom:company') } catch (_) {}
    set({
      company: '',
      accessToken: '',
      accessExpiry: '',
      displayName: '',
      status: 'idle',
      error: null,
      scanProgress: null,
    })
  },
}))
