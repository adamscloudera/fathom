import { create } from 'zustand'
import type { FathomInsights, DeepOrphanEntry, DeepScanProgress } from '../logic/types.ts'
import type { AssetItem } from '@adamscloudera/octopai-api'

export type DeepScanStatus = 'idle' | 'scanning' | 'done' | 'error'

type InsightsState = {
  insights: FathomInsights | null
  rawAssets: AssetItem[]
  deepOrphans: DeepOrphanEntry[] | null
  deepScanProgress: DeepScanProgress | null
  deepScanStatus: DeepScanStatus
  deepScanError: string | null
  setInsights: (insights: FathomInsights) => void
  setRawAssets: (assets: AssetItem[]) => void
  clearInsights: () => void
  setDeepOrphans: (orphans: DeepOrphanEntry[]) => void
  setDeepScanProgress: (p: DeepScanProgress | null) => void
  setDeepScanStatus: (s: DeepScanStatus, error?: string | null) => void
}

let _initialInsights: FathomInsights | null = null
try { const _s = localStorage.getItem('fathom:insights'); if (_s) _initialInsights = JSON.parse(_s) } catch (_) {}

let _initialDeepOrphans: DeepOrphanEntry[] | null = null
try { const _s = localStorage.getItem('fathom:deepOrphans'); if (_s) _initialDeepOrphans = JSON.parse(_s) } catch (_) {}

let _initialDeepScanStatus: DeepScanStatus = 'idle'
try { const _s = localStorage.getItem('fathom:deepScanStatus'); if (_s === 'done') _initialDeepScanStatus = 'done' } catch (_) {}

export const useInsightsStore = create<InsightsState>((set) => ({
  insights: _initialInsights,
  rawAssets: [],
  deepOrphans: _initialDeepOrphans,
  deepScanProgress: null,
  deepScanStatus: _initialDeepScanStatus,
  deepScanError: null,
  setInsights: (insights) => {
    set({ insights })
    try { localStorage.setItem('fathom:insights', JSON.stringify(insights)) } catch (_) {}
  },
  setRawAssets: (rawAssets) => set({ rawAssets }),
  clearInsights: () => {
    try { ['fathom:insights', 'fathom:deepOrphans', 'fathom:deepScanStatus'].forEach(k => localStorage.removeItem(k)) } catch (_) {}
    set({
      insights: null,
      rawAssets: [],
      deepOrphans: null,
      deepScanProgress: null,
      deepScanStatus: 'idle',
      deepScanError: null,
    })
  },
  setDeepOrphans: (deepOrphans) => {
    set({ deepOrphans })
    try { localStorage.setItem('fathom:deepOrphans', JSON.stringify(deepOrphans)) } catch (_) {}
  },
  setDeepScanProgress: (deepScanProgress) => set({ deepScanProgress }),
  setDeepScanStatus: (deepScanStatus, error = null) => {
    if (deepScanStatus === 'done') {
      try { localStorage.setItem('fathom:deepScanStatus', 'done') } catch (_) {}
    }
    set({ deepScanStatus, deepScanError: error })
  },
}))
