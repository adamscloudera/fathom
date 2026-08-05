import type { FathomInsights } from '../logic/types.ts'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xl font-bold text-foreground tabular-nums">{value.toLocaleString()}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}

type Props = { insights: FathomInsights }

export function CatalogSummaryCard({ insights }: Props) {
  const {
    totalAssets, toolBreakdown, distinctDatabases, distinctSchemas,
    connectionBreakdown, fetchedAt, catalogPhaseDurationMs, lineagePhaseDurationMs,
  } = insights

  const fetchTime = new Date(fetchedAt).toLocaleString()
  const totalMs = catalogPhaseDurationMs + lineagePhaseDurationMs
  const totalSecs = (totalMs / 1000).toFixed(1)

  return (
    <div className="surface-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Catalog Overview</h2>
        <span className="text-xs text-muted">{fetchTime} &middot; {totalSecs}s</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Total objects" value={totalAssets} />
        <Stat label="Tools" value={toolBreakdown.length} />
        <Stat label="Databases" value={distinctDatabases} />
        <Stat label="Schemas" value={distinctSchemas} />
      </div>

      <div className="pt-1 border-t border-border">
        <p className="text-xs text-muted mb-2">Connections ({connectionBreakdown.length})</p>
        <div className="space-y-1">
          {connectionBreakdown.slice(0, 8).map((c) => (
            <div key={c.connectionName} className="flex items-center gap-2 text-xs">
              <span className="truncate flex-1 text-foreground font-medium" title={c.connectionName}>
                {c.connectionName}
              </span>
              <span className="text-muted shrink-0">{c.toolName}</span>
              <span className="tabular-nums text-muted shrink-0 w-14 text-right">
                {c.count.toLocaleString()}
              </span>
            </div>
          ))}
          {connectionBreakdown.length > 8 && (
            <p className="text-xs text-muted">+{connectionBreakdown.length - 8} more</p>
          )}
        </div>
      </div>
    </div>
  )
}
