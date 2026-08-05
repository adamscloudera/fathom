import type { FathomInsights } from '../logic/types.ts'
import { CatalogSummaryCard } from './CatalogSummaryCard.tsx'
import { ToolBreakdownCard } from './ToolBreakdownCard.tsx'
import { LineageHealthCard } from './LineageHealthCard.tsx'
import { TopObjectsCard } from './TopObjectsCard.tsx'
import { InferredInsightsCard } from './InferredInsightsCard.tsx'
import { LineageDashboardCard } from './LineageDashboardCard.tsx'

type Props = {
  insights: FathomInsights
  onReset: () => void
}

export function DashboardLayout({ insights, onReset }: Props) {
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">{insights.tenantName}.octopai.com</span>
          {' — '}{insights.totalAssets.toLocaleString()} objects, {insights.lineageSampledCount} lineage samples
        </p>
        <button onClick={onReset} className="btn-ghost text-xs">
          New analysis
        </button>
      </div>

      {insights.inferredInsights.length > 0 && (
        <InferredInsightsCard insights={insights} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(insights.lineageDashboard || insights.columnDashboard) && <LineageDashboardCard insights={insights} />}
        <CatalogSummaryCard insights={insights} />
        <ToolBreakdownCard insights={insights} />
        <LineageHealthCard insights={insights} />
        <TopObjectsCard insights={insights} />
      </div>
    </div>
  )
}
