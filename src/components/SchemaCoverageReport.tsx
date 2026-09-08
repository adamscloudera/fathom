import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import { clsx } from 'clsx'
import type { FathomInsights, SchemaCoverageEntry } from '../logic/types.ts'

type CoverageFilter = 'all' | 'dark'

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

export function SchemaCoverageReport({ insights }: Props) {
  const [filter, setFilter] = useState<CoverageFilter>('all')
  const { schemaCoverage } = insights

  const darkCount = useMemo(
    () => schemaCoverage.filter((e) => e.coverageRate < 0.3).length,
    [schemaCoverage],
  )

  const filtered = useMemo<SchemaCoverageEntry[]>(
    () =>
      filter === 'dark'
        ? schemaCoverage.filter((e) => e.coverageRate < 0.3)
        : schemaCoverage,
    [schemaCoverage, filter],
  )

  function exportCsv() {
    const headers = [
      'Connection', 'Database', 'Schema', 'Tool',
      'Objects Seen', 'With Lineage', 'Coverage %',
    ]
    const escape = (v: string | number) =>
      typeof v === 'number' ? String(v) : `"${String(v).replace(/"/g, '""')}"`
    const rows = filtered.map((e: SchemaCoverageEntry) =>
      [
        e.connectionName, e.databaseName, e.schemaName, e.toolName,
        e.totalSeen, e.withLineage, Math.round(e.coverageRate * 100),
      ]
        .map(escape)
        .join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${insights.tenantName}-schema-coverage.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (schemaCoverage.length === 0) {
    return (
      <div className="surface-card p-8 text-center">
        <p className="text-sm text-muted">
          No schema data available. Run a lineage analysis first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Schema Coverage</h2>
            <p className="text-xs text-muted mt-0.5">
              Lineage coverage broken down by schema. Low-coverage schemas may indicate
              incomplete harvesting or inactive tables within that schema.
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums text-foreground shrink-0">
            {schemaCoverage.length}
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted rounded-lg bg-muted/10 border border-border/60 px-3 py-2">
          <span>
            <span className="font-medium text-foreground">{schemaCoverage.length}</span>{' '}
            schema{schemaCoverage.length === 1 ? '' : 's'}
          </span>
          <span>
            <span className="font-medium text-red-500">{darkCount}</span>{' '}
            dark schema{darkCount === 1 ? '' : 's'} below 30% coverage
          </span>
          <span className="ml-auto italic">
            Coverage is sample-based and may not reflect the full catalog.
          </span>
        </div>
      </div>

      <div className="surface-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {(['all', 'dark'] as CoverageFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  filter === f
                    ? 'bg-primary text-white'
                    : 'bg-muted/15 text-muted hover:text-foreground hover:bg-muted/30',
                )}
              >
                {f === 'all' ? 'All' : 'Dark (<30%)'}
                <span className={clsx('ml-1.5 tabular-nums', filter === f ? 'opacity-80' : '')}>
                  {f === 'all' ? schemaCoverage.length : darkCount}
                </span>
              </button>
            ))}
          </div>
          <button onClick={exportCsv} className="btn-ghost text-xs shrink-0">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted">No schemas match this filter.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-xs min-w-[760px]">
              <thead>
                <tr className="bg-muted/20 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted">Connection</th>
                  <th className="text-left px-3 py-2 font-medium text-muted">Database</th>
                  <th className="text-left px-3 py-2 font-medium text-muted">Schema</th>
                  <th className="text-left px-3 py-2 font-medium text-muted">Tool</th>
                  <th className="text-right px-3 py-2 font-medium text-muted w-20">Objects</th>
                  <th className="text-right px-3 py-2 font-medium text-muted w-24">With Lineage</th>
                  <th className="px-3 py-2 font-medium text-muted w-36">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr
                    key={e.key}
                    className={clsx(
                      'border-b last:border-0 border-border',
                      i % 2 === 0 ? 'bg-card' : 'bg-muted/10',
                    )}
                  >
                    <td
                      className="px-3 py-1.5 font-mono max-w-[160px] truncate"
                      title={e.connectionName}
                    >
                      {e.connectionName}
                    </td>
                    <td
                      className="px-3 py-1.5 text-muted max-w-[140px] truncate"
                      title={e.databaseName}
                    >
                      {e.databaseName}
                    </td>
                    <td
                      className="px-3 py-1.5 font-mono max-w-[140px] truncate"
                      title={e.schemaName}
                    >
                      {e.schemaName}
                    </td>
                    <td
                      className="px-3 py-1.5 text-muted max-w-[120px] truncate"
                      title={e.toolName}
                    >
                      {e.toolName}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                      {e.totalSeen}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted">
                      {e.withLineage}
                    </td>
                    <td className="px-3 py-1.5">
                      <CoverageBar rate={e.coverageRate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
