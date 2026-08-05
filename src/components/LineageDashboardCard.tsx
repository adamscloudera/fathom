import type { FathomInsights, LineageDashboardBucket } from '../logic/types.ts'

function BucketColumn({ label, bucket }: { label: string; bucket: LineageDashboardBucket }) {
  const entries = Object.entries(bucket.byTool).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-2xl font-bold text-foreground tabular-nums">
          {bucket.total.toLocaleString()}
        </span>
        <p className="text-xs text-muted mt-0.5">{label}</p>
      </div>
      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.slice(0, 6).map(([tool, count]) => (
            <div key={tool} className="flex items-center gap-2 text-xs">
              <span className="truncate flex-1 text-foreground font-medium" title={tool}>
                {tool}
              </span>
              <span className="tabular-nums text-muted shrink-0">
                {count.toLocaleString()}
              </span>
            </div>
          ))}
          {entries.length > 6 && (
            <p className="text-xs text-muted">+{entries.length - 6} more</p>
          )}
        </div>
      )}
    </div>
  )
}

type Props = { insights: FathomInsights }

export function LineageDashboardCard({ insights }: Props) {
  const { lineageDashboard } = insights
  if (!lineageDashboard) return null

  return (
    <div className="surface-card p-5 space-y-4 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Cross System Lineage</h2>
        <span className="text-xs text-muted">from lineage dashboard</span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <BucketColumn label="ETL objects" bucket={lineageDashboard.etl} />
        <BucketColumn label="DB objects" bucket={lineageDashboard.db} />
        <BucketColumn label="Report objects" bucket={lineageDashboard.report} />
      </div>
    </div>
  )
}
