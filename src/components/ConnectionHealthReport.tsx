import { Download } from 'lucide-react'
import { clsx } from 'clsx'
import type { FathomInsights, ConnectionHealthEntry } from '../logic/types.ts'

type Props = { insights: FathomInsights }

function CoverageBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  const colorClass =
    pct < 30 ? 'bg-red-500' : pct < 70 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={clsx('h-full rounded-full', colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={clsx(
          'tabular-nums font-medium w-10 text-right text-xs',
          pct < 30
            ? 'text-red-500'
            : pct < 70
            ? 'text-amber-500'
            : 'text-green-600',
        )}
      >
        {pct}%
      </span>
    </div>
  )
}

export function ConnectionHealthReport({ insights }: Props) {
  const { connectionHealth } = insights

  function exportCsv() {
    const headers = [
      'Connection', 'Tool', 'Type', 'Objects Seen',
      'With Lineage', 'Orphans', 'Avg Degree', 'Max Degree', 'Coverage %',
    ]
    const escape = (v: string | number) =>
      typeof v === 'number' ? String(v) : `"${String(v).replace(/"/g, '""')}"`
    const rows = connectionHealth.map((e: ConnectionHealthEntry) =>
      [
        e.connectionName, e.toolName, e.toolType, e.totalSeen,
        e.withLineage, e.orphanCount, e.avgDegree, e.maxDegree,
        Math.round(e.coverageRate * 100),
      ]
        .map(escape)
        .join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${insights.tenantName}-connection-health.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (connectionHealth.length === 0) {
    return (
      <div className="surface-card p-8 text-center">
        <p className="text-sm text-muted">
          No connection data available. Run a lineage analysis first.
        </p>
      </div>
    )
  }

  const worstCoverage = connectionHealth[0]
  const avgCoveragePct = Math.round(
    (connectionHealth.reduce((s, e) => s + e.coverageRate, 0) / connectionHealth.length) * 100,
  )

  return (
    <div className="space-y-4">
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Connection Health</h2>
            <p className="text-xs text-muted mt-0.5">
              Per-connection lineage coverage based on the lineage sample.
              Low coverage may indicate incomplete harvesting or inactive connections.
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums text-foreground shrink-0">
            {connectionHealth.length}
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted rounded-lg bg-muted/10 border border-border/60 px-3 py-2">
          <span>
            <span className="font-medium text-foreground">{connectionHealth.length}</span> connection{connectionHealth.length === 1 ? '' : 's'}
          </span>
          <span>
            Avg coverage{' '}
            <span
              className={clsx(
                'font-medium',
                avgCoveragePct < 30
                  ? 'text-red-500'
                  : avgCoveragePct < 70
                  ? 'text-amber-500'
                  : 'text-green-600',
              )}
            >
              {avgCoveragePct}%
            </span>
          </span>
          {worstCoverage && (
            <span>
              Lowest:{' '}
              <span className="font-mono text-foreground">{worstCoverage.connectionName}</span>{' '}
              <span className="text-red-500 font-medium">
                ({Math.round(worstCoverage.coverageRate * 100)}%)
              </span>
            </span>
          )}
          <span className="ml-auto italic">
            Coverage is sample-based and may not reflect the full catalog.
          </span>
        </div>
      </div>

      <div className="surface-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">Sorted worst coverage first.</p>
          <button onClick={exportCsv} className="btn-ghost text-xs shrink-0">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="bg-muted/20 border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-muted">Connection</th>
                <th className="text-left px-3 py-2 font-medium text-muted">Tool</th>
                <th className="text-left px-3 py-2 font-medium text-muted">Type</th>
                <th className="text-right px-3 py-2 font-medium text-muted w-16">Objects</th>
                <th className="text-right px-3 py-2 font-medium text-muted w-20">With Lineage</th>
                <th className="text-right px-3 py-2 font-medium text-muted w-16">Orphans</th>
                <th className="text-right px-3 py-2 font-medium text-muted w-16">Avg Deg</th>
                <th className="px-3 py-2 font-medium text-muted w-36">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {connectionHealth.map((e, i) => (
                <tr
                  key={e.connectionName}
                  className={clsx(
                    'border-b last:border-0 border-border',
                    i % 2 === 0 ? 'bg-card' : 'bg-muted/10',
                  )}
                >
                  <td
                    className="px-3 py-1.5 font-mono max-w-[200px] truncate"
                    title={e.connectionName}
                  >
                    {e.connectionName}
                  </td>
                  <td className="px-3 py-1.5 text-muted max-w-[140px] truncate" title={e.toolName}>
                    {e.toolName}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="badge badge-blue">{e.toolType}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                    {e.totalSeen}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted">
                    {e.withLineage}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted">
                    {e.orphanCount > 0 ? (
                      <span className="text-red-500">{e.orphanCount}</span>
                    ) : (
                      e.orphanCount
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted">
                    {e.avgDegree}
                  </td>
                  <td className="px-3 py-1.5">
                    <CoverageBar rate={e.coverageRate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
