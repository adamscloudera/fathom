import type { FathomInsights } from '../logic/types.ts'

const TYPE_COLORS: Record<string, string> = {
  DB: 'bg-blue-500',
  ETL: 'bg-violet-500',
  REPORT: 'bg-amber-500',
  Unknown: 'bg-gray-400',
}

const TYPE_LABELS: Record<string, string> = {
  DB: 'Database',
  ETL: 'ETL / Pipeline',
  REPORT: 'BI / Reporting',
}

type Props = { insights: FathomInsights }

export function ToolBreakdownCard({ insights }: Props) {
  const { toolBreakdown, totalAssets } = insights

  const grouped: Record<string, typeof toolBreakdown> = {}
  for (const t of toolBreakdown) {
    const g = t.toolType in TYPE_LABELS ? t.toolType : 'Unknown'
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(t)
  }

  return (
    <div className="surface-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Tool Breakdown</h2>

      {(['DB', 'ETL', 'REPORT', 'Unknown'] as const)
        .filter((g) => grouped[g]?.length)
        .map((group) => (
          <div key={group} className="space-y-1.5">
            <p className="text-xs font-medium text-muted">{TYPE_LABELS[group] ?? group}</p>
            {grouped[group].map((t) => {
              const pct = totalAssets > 0 ? (t.count / totalAssets) * 100 : 0
              return (
                <div key={t.toolName} className="flex items-center gap-2 text-xs">
                  <span className="w-32 truncate text-foreground font-medium shrink-0" title={t.toolName}>
                    {t.toolName}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full ${TYPE_COLORS[group] ?? TYPE_COLORS.Unknown}`}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-muted w-12 text-right shrink-0">
                    {t.count.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
    </div>
  )
}
