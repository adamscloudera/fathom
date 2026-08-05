import { create } from 'zustand'
import type { FathomInsights } from '../logic/types.ts'

type InsightsState = {
  insights: FathomInsights | null
  setInsights: (insights: FathomInsights) => void
  clearInsights: () => void
}

export const useInsightsStore = create<InsightsState>((set) => ({
  insights: null,
  setInsights: (insights) => set({ insights }),
  clearInsights: () => set({ insights: null }),
}))
