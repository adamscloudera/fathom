import { useState } from 'react'
import { clsx } from 'clsx'
import type { FathomInsights } from '../logic/types.ts'
import { CatalogSummaryCard } from './CatalogSummaryCard.tsx'
import { ToolBreakdownCard } from './ToolBreakdownCard.tsx'
import { LineageHealthCard } from './LineageHealthCard.tsx'
import { TopObjectsCard } from './TopObjectsCard.tsx'
import { InferredInsightsCard } from './InferredInsightsCard.tsx'
import { LineageDashboardCard } from './LineageDashboardCard.tsx'
import { OrphanedObjectsReport } from './OrphanedObjectsReport.tsx'
import { HighImpactReport } from './HighImpactReport.tsx'
import { DuplicateFlowsReport } from './DuplicateFlowsReport.tsx'
import { ConnectionHealthReport } from './ConnectionHealthReport.tsx'
import { SchemaCoverageReport } from './SchemaCoverageReport.tsx'
import { PipelineDepthReport } from './PipelineDepthReport.tsx'
import { KeywordScanReport } from './KeywordScanReport.tsx'

type Report = 'overview' | 'orphans' | 'high-impact' | 'duplicates' | 'connection-health' | 'schema-coverage' | 'pipeline-depth' | 'keyword-scan'

const REPORTS: { id: Report; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'orphans', label: 'Orphaned Objects' },
  { id: 'high-impact', label: 'High Impact' },
  { id: 'duplicates', label: 'Duplicate Flows' },
  { id: 'connection-health', label: 'Connection Health' },
  { id: 'schema-coverage', label: 'Schema Coverage' },
  { id: 'pipeline-depth', label: 'Pipeline Depth' },
  { id: 'keyword-scan', label: 'Keyword Scan' },
]

type Props = {
  insights: FathomInsights
  onReset: () => void
}

export function DashboardLayout({ insights, onReset }: Props) {
  const [activeReport, setActiveReport] = useState<Report>('overview')

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

      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/15 border border-border/60 self-start w-fit">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveReport(r.id)}
            className={clsx(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeReport === r.id
                ? 'bg-card text-foreground shadow-sm border border-border/80'
                : 'text-muted hover:text-foreground',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {activeReport === 'overview' && (
        <>
          {insights.inferredInsights.length > 0 && (
            <InferredInsightsCard insights={insights} />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(insights.lineageDashboard || insights.columnDashboard) && (
              <LineageDashboardCard insights={insights} />
            )}
            <CatalogSummaryCard insights={insights} />
            <ToolBreakdownCard insights={insights} />
            <LineageHealthCard insights={insights} />
            <TopObjectsCard insights={insights} />
          </div>
        </>
      )}

      {activeReport === 'orphans' && (
        <OrphanedObjectsReport insights={insights} />
      )}

      {activeReport === 'high-impact' && (
        <HighImpactReport insights={insights} />
      )}

      {activeReport === 'duplicates' && (
        <DuplicateFlowsReport insights={insights} />
      )}

      {activeReport === 'connection-health' && (
        <ConnectionHealthReport insights={insights} />
      )}

      {activeReport === 'schema-coverage' && (
        <SchemaCoverageReport insights={insights} />
      )}

      {activeReport === 'pipeline-depth' && (
        <PipelineDepthReport insights={insights} />
      )}

      {activeReport === 'keyword-scan' && (
        <KeywordScanReport />
      )}
    </div>
  )
}
