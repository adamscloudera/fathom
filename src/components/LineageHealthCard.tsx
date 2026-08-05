import type { FathomInsights } from '../logic/types.ts'

type Props = { insights: FathomInsights }

export function LineageHealthCard({ insights }: Props) {
  const { lineageSampledCount, lineageCoverageRate, confirmedOrphans, crossToolFlows } = insights

  if (lineageSampledCount === 0) {
    return (
      <div className="surface-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-2">Lineage Health</h2>
        <p className="text-xs text-muted">No lineage data sampled.</p>
      </div>
    )
  }

  const coveragePct = Math.round(lineageCoverageRate * 100)
  const coverageColor =
    coveragePct >= 70 ? 'bg-green-500' : coveragePct >= 40 ? 'bg-amber-500' : 'bg-red-400'
  const coverageTextColor =
    coveragePct >= 70 ? 'text-green-700' : coveragePct >= 40 ? 'text-amber-700' : 'text-red-600'

  return (
    <div className="surface-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Lineage Health</h2>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Coverage ({lineageSampledCount} sampled)</span>
          <span className={`font-semibold tabular-nums ${coverageTextColor}`}>{coveragePct}%</span>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div
            className={`h-full rounded-full ${coverageColor} transition-all duration-500`}
            style={{ width: `${coveragePct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-muted/10 border border-border/60">
          <span className="text-lg font-bold tabular-nums text-foreground">{confirmedOrphans.length}</span>
          <span className="text-xs text-muted">Orphaned objects</span>
        </div>
        <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-muted/10 border border-border/60">
          <span className="text-lg font-bold tabular-nums text-foreground">{crossToolFlows.length}</span>
          <span className="text-xs text-muted">Cross-tool flows</span>
        </div>
      </div>

      {confirmedOrphans.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted mb-1.5">Orphaned objects (sample)</p>
          <div className="space-y-1">
            {(() => {
              // Split into named (have at least one identifying field) and anonymous
              const named = confirmedOrphans.filter(
                (o) => o.objectName || o.databaseName || o.schemaName
              )
              const anon = confirmedOrphans.filter(
                (o) => !o.objectName && !o.databaseName && !o.schemaName
              )

              // Group anonymous by "ConnectionName · ObjectType"
              const anonGroups = new Map<string, number>()
              for (const o of anon) {
                const groupKey = [o.connectionName || 'Unknown', o.objectType || 'Object'].join(' · ')
                anonGroups.set(groupKey, (anonGroups.get(groupKey) ?? 0) + 1)
              }

              return (
                <>
                  {named.slice(0, 5).map((o) => {
                    const parts = [o.databaseName, o.schemaName, o.objectName].filter(Boolean)
                    const label = parts.join('.')
                    return (
                      <div key={o.key} className="flex items-center gap-2 text-xs">
                        <span className="truncate flex-1 text-foreground font-mono" title={label}>
                          {label}
                        </span>
                        <span className="text-muted shrink-0 flex gap-1.5 items-center">
                          {o.objectType && <span className="opacity-60">{o.objectType}</span>}
                          {o.connectionName && (
                            <span className="truncate max-w-[100px]">{o.connectionName}</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                  {[...anonGroups.entries()].map(([groupKey, count]) => (
                    <div key={groupKey} className="flex items-center gap-2 text-xs">
                      <span className="truncate flex-1 text-muted italic">
                        {count}× {groupKey} — no name metadata
                      </span>
                    </div>
                  ))}
                  {named.length > 5 && (
                    <p className="text-xs text-muted">+{named.length - 5} more named</p>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {crossToolFlows.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted mb-1.5">Cross-tool flows</p>
          <div className="space-y-1">
            {crossToolFlows.slice(0, 5).map((f) => (
              <div key={`${f.fromTool}→${f.toTool}`} className="flex items-center gap-2 text-xs">
                <span className="badge badge-blue shrink-0">{f.fromTool}</span>
                <span className="text-muted">→</span>
                <span className="badge badge-blue shrink-0">{f.toTool}</span>
                <span className="tabular-nums text-muted ml-auto shrink-0">
                  {f.linkCount} link{f.linkCount === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
