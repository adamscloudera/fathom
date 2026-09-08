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

export const useInsightsStore = create<InsightsState>((set) => ({
  insights: null,
  rawAssets: [],
  deepOrphans: null,
  deepScanProgress: null,
  deepScanStatus: 'idle',
  deepScanError: null,
  setInsights: (insights) => set({ insights }),
  setRawAssets: (rawAssets) => set({ rawAssets }),
  clearInsights: () =>
    set({
      insights: null,
      rawAssets: [],
      deepOrphans: null,
      deepScanProgress: null,
      deepScanStatus: 'idle',
      deepScanError: null,
    }),
  setDeepOrphans: (deepOrphans) => set({ deepOrphans }),
  setDeepScanProgress: (deepScanProgress) => set({ deepScanProgress }),
  setDeepScanStatus: (deepScanStatus, error = null) =>
    set({ deepScanStatus, deepScanError: error }),
}))
