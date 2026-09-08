import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import { clsx } from 'clsx'
import { downloadCsv, FilterTabs, TYPE_BADGE } from '../lib/reportUtils.tsx'
import type { FathomInsights, DegreeEntry } from '../logic/types.ts'

type TypeFilter = 'all' | 'DB' | 'ETL' | 'REPORT'


type Props = { insights: FathomInsights }

export function HighImpactReport({ insights }: Props) {
  const [filter, setFilter] = useState<TypeFilter>('all')

  const countsByType = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of insights.allConnectedDegrees) {
      const t = e.toolType ?? 'unknown'
      counts[t] = (counts[t] ?? 0) + 1
    }
    return counts
  }, [insights.allConnectedDegrees])

  const filtered = useMemo<DegreeEntry[]>(
    () =>
      filter === 'all'
        ? insights.allConnectedDegrees
        : insights.allConnectedDegrees.filter((e) => e.toolType === filter),
    [insights.allConnectedDegrees, filter],
  )

  const maxDegree = filtered.length > 0 ? filtered[0].degree : 1

  function exportCsv() {
    downloadCsv(
      `${insights.tenantName}-high-impact-objects.csv`,
      ['Object', 'Object Type', 'Tool', 'Tool Type', 'Connection', 'Database', 'Schema', 'In', 'Out', 'Degree'],
      filtered.map((e) => [
        e.objectName, e.objectType, e.toolName ?? '', e.toolType ?? '',
        e.connectionName, e.databaseName, e.schemaName,
        e.ins, e.outs, e.degree,
      ]),
    )
  }

  const top = insights.allConnectedDegrees[0]

  return (
    <div className="space-y-4">
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">High-Impact Objects</h2>
            <p className="text-xs text-muted mt-0.5">
              Objects with the most upstream and downstream connections — tables, ETL jobs, and reports.
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums text-foreground shrink-0">
            {insights.allConnectedDegrees.length}
          </span>
        </div>

        {top && (
          <div className="text-xs rounded-lg bg-muted/10 border border-border/60 px-3 py-2 space-y-0.5">
            <span className="text-muted">Most connected: </span>
            <span className="font-medium text-foreground font-mono">{top.objectName || top.key}</span>
            {top.connectionName && (
              <span className="text-muted"> ({top.connectionName})</span>
            )}
            <span className="text-muted"> — degree </span>
            <span className="font-medium text-foreground">{top.degree}</span>
            <span className="text-muted"> ({top.ins} in, {top.outs} out)</span>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="surface-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <FilterTabs
              tabs={(['all', 'DB', 'ETL', 'REPORT'] as TypeFilter[])
                .filter((t) => t === 'all' || (countsByType[t] ?? 0) > 0)
                .map((t) => ({
                  id: t,
                  label: t === 'all' ? 'All' : t === 'DB' ? 'Database' : t === 'ETL' ? 'ETL' : 'Reports',
                  count: t === 'all' ? insights.allConnectedDegrees.length : (countsByType[t] ?? 0),
                }))}
              active={filter}
              onChange={setFilter}
            />
            <button onClick={exportCsv} className="btn-ghost text-xs shrink-0">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="bg-muted/20 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted">Object</th>
                  <th className="text-left px-3 py-2 font-medium text-muted">Type</th>
                  <th className="text-left px-3 py-2 font-medium text-muted">Connection</th>
                  <th className="text-right px-3 py-2 font-medium text-muted w-12">In</th>
                  <th className="text-right px-3 py-2 font-medium text-muted w-12">Out</th>
                  <th className="px-3 py-2 font-medium text-muted w-40">Degree</th>
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
                    <td className="px-3 py-1.5 font-mono max-w-[200px] truncate" title={e.objectName}>
                      {e.objectName || <span className="text-muted italic">unnamed</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      {e.toolType ? (
                        <span className={clsx('badge', TYPE_BADGE[e.toolType] ?? 'badge-blue')}>
                          {e.toolType}
                        </span>
                      ) : (
                        <span className="text-muted">{e.objectType || '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-muted max-w-[160px] truncate" title={e.connectionName}>
                      {e.connectionName || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted">{e.ins}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted">{e.outs}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${Math.round((e.degree / maxDegree) * 100)}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-foreground font-medium w-8 text-right">
                          {e.degree}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="surface-card p-8 text-center">
          <p className="text-sm text-muted">No connected objects found in this category.</p>
        </div>
      )}
    </div>
  )
}
