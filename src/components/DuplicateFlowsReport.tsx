import { Download, GitFork } from 'lucide-react'
import { clsx } from 'clsx'
import type { FathomInsights, DuplicateFlowNode } from '../logic/types.ts'
import { downloadCsv, TYPE_BADGE } from '../lib/reportUtils.tsx'

function NodePill({ node }: { node: DuplicateFlowNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-card text-xs">
      <span className="font-mono text-foreground truncate max-w-[160px]" title={node.objectName}>
        {node.objectName || node.key}
      </span>
      {node.toolType && (
        <span className={clsx('badge text-[10px] px-1 py-0', TYPE_BADGE[node.toolType] ?? 'badge-blue')}>
          {node.toolType}
        </span>
      )}
      {node.connectionName && (
        <span className="text-muted truncate max-w-[80px]" title={node.connectionName}>
          {node.connectionName}
        </span>
      )}
    </span>
  )
}

type Props = { insights: FathomInsights }

export function DuplicateFlowsReport({ insights }: Props) {
  const groups = insights.duplicateFlowGroups

  function exportCsv() {
    const rows: Array<Array<string | number>> = []
    for (const g of groups) {
      for (const s of g.sources) {
        rows.push([g.id, 'source', s.objectName, s.objectType, s.toolName, s.toolType, s.connectionName])
      }
      for (const t of g.targets) {
        rows.push([g.id, 'target', t.objectName, t.objectType, t.toolName, t.toolType, t.connectionName])
      }
    }
    downloadCsv(
      `${insights.tenantName}-duplicate-flows.csv`,
      ['Group', 'Role', 'Object', 'Object Type', 'Tool', 'Tool Type', 'Connection'],
      rows,
    )
  }

  return (
    <div className="space-y-4">
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Duplicate Flows</h2>
            <p className="text-xs text-muted mt-0.5">
              Target objects that receive from identical upstream source sets — potential redundant pipelines or data copies.
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums text-foreground shrink-0">{groups.length}</span>
        </div>

        <div className="text-xs text-muted rounded-lg bg-muted/10 border border-border/60 px-3 py-2 space-y-1">
          <p>
            Detection method: targets sharing two or more identical direct upstream sources are flagged as potential duplicates.
            Results are drawn from the lineage sample ({insights.lineageSampledCount} objects) and may not reflect the full catalog.
          </p>
          {groups.length === 0 && (
            <p className="text-foreground">No duplicate flow patterns found in the current sample.</p>
          )}
        </div>

        {groups.length > 0 && (
          <div className="flex justify-end">
            <button onClick={exportCsv} className="btn-ghost text-xs">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {groups.map((g) => (
        <div key={g.id} className="surface-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-muted shrink-0" />
            <span className="text-xs font-medium text-foreground">
              {g.targets.length} target{g.targets.length === 1 ? '' : 's'} fed by{' '}
              {g.sources.length} identical upstream source{g.sources.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted font-medium uppercase tracking-wide">Shared sources</p>
            <div className="flex flex-wrap gap-1.5">
              {g.sources.map((s) => (
                <NodePill key={s.key} node={s} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted font-medium uppercase tracking-wide">
              Potentially duplicate targets
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.targets.map((t) => (
                <NodePill key={t.key} node={t} />
              ))}
            </div>
          </div>

          <p className="text-xs text-muted border-t border-border/60 pt-3">
            These objects all receive data from the same source pattern. This may indicate redundant ETL runs, mirrored staging tables, or test/prod copies of the same pipeline.
          </p>
        </div>
      ))}

      {groups.length === 0 && (
        <div className="surface-card p-8 text-center">
          <p className="text-sm text-muted">No duplicate flow patterns detected in the current sample.</p>
          <p className="text-xs text-muted mt-1">
            Detection requires targets sharing two or more common direct upstream sources.
          </p>
        </div>
      )}
    </div>
  )
}
