import { useState } from 'react'
import { clsx } from 'clsx'
import type { FathomInsights } from '../logic/types.ts'

type Props = { insights: FathomInsights }

type Tab = 'top' | 'low'

export function TopObjectsCard({ insights }: Props) {
  const { topByDegree, lowDegree } = insights
  const [tab, setTab] = useState<Tab>('top')

  const rows = tab === 'top' ? topByDegree : lowDegree

  if (topByDegree.length === 0) {
    return (
      <div className="surface-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-2">Object Connectivity</h2>
        <p className="text-xs text-muted">No lineage data available.</p>
      </div>
    )
  }

  return (
    <div className="surface-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Object Connectivity</h2>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['top', 'low'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 py-1 transition-colors',
                tab === t ? 'bg-primary text-white' : 'text-muted hover:text-foreground hover:bg-muted/10',
              )}
            >
              {t === 'top' ? 'Most connected' : 'Least connected'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/20 border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-muted">Object</th>
              <th className="text-left px-3 py-2 font-medium text-muted">Connection</th>
              <th className="text-right px-3 py-2 font-medium text-muted">In</th>
              <th className="text-right px-3 py-2 font-medium text-muted">Out</th>
              <th className="text-right px-3 py-2 font-medium text-muted">Degree</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.key}
                className={clsx('border-b last:border-0 border-border', i % 2 === 0 ? 'bg-card' : 'bg-muted/10')}
              >
                <td className="px-3 py-1.5 font-mono max-w-[180px] truncate" title={r.objectName}>
                  {r.objectName}
                </td>
                <td className="px-3 py-1.5 text-muted max-w-[140px] truncate" title={r.connectionName}>
                  {r.connectionName || '—'}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.ins}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.outs}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{r.degree}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
