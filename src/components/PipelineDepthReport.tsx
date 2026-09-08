import { Download } from 'lucide-react'
import { clsx } from 'clsx'
import type { FathomInsights } from '../logic/types.ts'

type Props = { insights: FathomInsights }

export function PipelineDepthReport({ insights }: Props) {
  const { pipelineDepth } = insights

  if (!pipelineDepth) {
    return (
      <div className="surface-card p-8 text-center">
        <p className="text-sm text-muted">No lineage chains detected in the current sample.</p>
      </div>
    )
  }

  const { maxDepth, avgDepth, depthDistribution, longestChains } = pipelineDepth

  // Build sorted distribution rows: depth 0 through maxDepth
  const distRows: { depth: number; count: number }[] = []
  for (let d = 0; d <= maxDepth; d++) {
    const count = depthDistribution[d] ?? 0
    if (d === 0 || count > 0) distRows.push({ depth: d, count })
  }
  const maxCount = Math.max(...distRows.map((r) => r.count), 1)

  function exportCsv() {
    const headers = ['Rank', 'Depth', 'Source', 'Target', 'Full Path']
    const escape = (v: string | number) =>
      typeof v === 'number' ? String(v) : `"${String(v).replace(/"/g, '""')}"`
    const rows = longestChains.map((chain, i) =>
      [
        i + 1,
        chain.depth,
        chain.sourceLabel,
        chain.targetLabel,
        chain.pathLabels.join(' -> '),
      ]
        .map(escape)
        .join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${insights.tenantName}-pipeline-depth.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="surface-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Pipeline Depth</h2>
            <p className="text-xs text-muted mt-0.5">
              Longest lineage chains found across the sampled graph — source-to-target hop counts.
            </p>
          </div>
          <div className="flex items-end gap-6 shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums text-foreground">{maxDepth}</div>
              <div className="text-xs text-muted">max depth</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums text-foreground">{avgDepth}</div>
              <div className="text-xs text-muted">avg depth</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted">
          Based on {insights.lineageSampledCount} sampled lineage queries. Depths reflect the longest path to each terminal node in the sampled graph — not the full tenant DAG.
        </p>
      </div>

      {/* Depth distribution table */}
      <div className="surface-card p-5 space-y-3">
        <h3 className="text-xs font-semibold text-foreground">Depth Distribution</h3>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/20 border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-muted w-24">Depth (hops)</th>
                <th className="text-right px-3 py-2 font-medium text-muted w-20">Chains</th>
                <th className="px-3 py-2 font-medium text-muted">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {distRows.map((row, i) => (
                <tr
                  key={row.depth}
                  className={clsx(
                    'border-b last:border-0 border-border',
                    i % 2 === 0 ? 'bg-card' : 'bg-muted/10',
                  )}
                >
                  <td className="px-3 py-1.5 tabular-nums font-medium text-foreground">{row.depth}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted">{row.count}</td>
                  <td className="px-3 py-1.5">
                    {row.count > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Longest chains */}
      {longestChains.length > 0 && (
        <div className="surface-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-foreground">Longest Chains</h3>
            <button onClick={exportCsv} className="btn-ghost text-xs shrink-0">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
          <ol className="space-y-2">
            {longestChains.map((chain, i) => {
              const showFull = chain.pathLabels.length <= 5
              const intermediateCount = chain.pathLabels.length - 2
              return (
                <li
                  key={i}
                  className={clsx(
                    'rounded-lg border border-border px-3 py-2 text-xs',
                    i % 2 === 0 ? 'bg-card' : 'bg-muted/10',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-muted tabular-nums shrink-0 w-5 text-right">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <span className="inline-block bg-muted/20 text-muted rounded px-1.5 py-0.5 mr-2 shrink-0">
                        {chain.depth} hops
                      </span>
                      <span className="font-mono text-foreground break-all">
                        {showFull
                          ? chain.pathLabels.join(' → ')
                          : `${chain.sourceLabel} → (+${intermediateCount} intermediate) → ${chain.targetLabel}`}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
