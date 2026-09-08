import { useState } from 'react'
import { Search, X, Download, RefreshCw, Columns } from 'lucide-react'
import { clsx } from 'clsx'
import { useKeywordScan } from '../hooks/useKeywordScan.ts'
import { downloadCsv, TYPE_BADGE } from '../lib/reportUtils.tsx'
import type { KeywordMatchResult, ScanNode, ColumnMatchResult, ColumnScanNode } from '../logic/types.ts'
import type { ScanPhase } from '../hooks/useKeywordScan.ts'

function NodePill({ node }: { node: ScanNode }) {
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

function ColumnPill({ node }: { node: ColumnScanNode }) {
  const label = node.columnName || node.key
  const sub = node.tableName ? `${node.tableName}` : undefined
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-card text-xs">
      <span className="font-mono text-foreground truncate max-w-[140px]" title={label}>
        {label}
      </span>
      {sub && (
        <span className="text-muted truncate max-w-[80px]" title={sub}>
          {sub}
        </span>
      )}
      {node.toolType && (
        <span className={clsx('badge text-[10px] px-1 py-0', TYPE_BADGE[node.toolType] ?? 'badge-blue')}>
          {node.toolType}
        </span>
      )}
    </span>
  )
}

function ResultCard({ result }: { result: KeywordMatchResult }) {
  return (
    <div className="surface-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-medium text-sm text-foreground truncate">
              {result.objectName || result.key}
            </span>
            {result.toolType && (
              <span className={clsx('badge text-[10px]', TYPE_BADGE[result.toolType] ?? 'badge-blue')}>
                {result.toolType}
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
            {[result.databaseName, result.schemaName].filter(Boolean).join('.')}
            {result.connectionName && (
              <span className="ml-2 text-muted/70">{result.connectionName}</span>
            )}
          </p>
        </div>
        {!result.lineageFetched && (
          <RefreshCw className="w-3.5 h-3.5 text-muted animate-spin shrink-0 mt-1" />
        )}
      </div>

      {result.lineageFetched && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">
              Sources{' '}
              <span className="ml-1 font-mono normal-case text-muted/60">
                ({result.upstreamSources.length})
              </span>
            </p>
            {result.upstreamSources.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {result.upstreamSources.map(n => <NodePill key={n.key} node={n} />)}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No upstream sources in sample</p>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">
              Consumers{' '}
              <span className="ml-1 font-mono normal-case text-muted/60">
                ({result.downstreamConsumers.length})
              </span>
            </p>
            {result.downstreamConsumers.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {result.downstreamConsumers.map(n => <NodePill key={n.key} node={n} />)}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No downstream consumers in sample</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ColumnResultCard({ result }: { result: ColumnMatchResult }) {
  return (
    <div className="surface-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Columns className="w-3.5 h-3.5 text-muted shrink-0" />
            <span className="font-mono font-medium text-sm text-foreground truncate">
              {result.columnName || result.key}
            </span>
            {result.dataType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted font-mono">
                {result.dataType}
              </span>
            )}
            {result.toolType && (
              <span className={clsx('badge text-[10px]', TYPE_BADGE[result.toolType] ?? 'badge-blue')}>
                {result.toolType}
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
            {result.tableName && (
              <span className="font-mono">{result.tableName}</span>
            )}
            {[result.databaseName, result.schemaName].filter(Boolean).length > 0 && (
              <span className="ml-1">
                ({[result.databaseName, result.schemaName].filter(Boolean).join('.')})
              </span>
            )}
            {result.connectionName && (
              <span className="ml-2 text-muted/70">{result.connectionName}</span>
            )}
          </p>
        </div>
        {!result.lineageFetched && (
          <RefreshCw className="w-3.5 h-3.5 text-muted animate-spin shrink-0 mt-1" />
        )}
      </div>

      {result.lineageFetched && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">
              Source columns{' '}
              <span className="ml-1 font-mono normal-case text-muted/60">
                ({result.upstreamColumns.length})
              </span>
            </p>
            {result.upstreamColumns.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {result.upstreamColumns.map(n => <ColumnPill key={n.key} node={n} />)}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No upstream columns found</p>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">
              Consumer columns{' '}
              <span className="ml-1 font-mono normal-case text-muted/60">
                ({result.downstreamColumns.length})
              </span>
            </p>
            {result.downstreamColumns.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {result.downstreamColumns.map(n => <ColumnPill key={n.key} node={n} />)}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No downstream columns found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function phaseLabel(phase: ScanPhase): string {
  if (phase === 'fetching-columns') return 'Fetching column catalog'
  if (phase === 'columns') return 'Fetching column lineage'
  return 'Fetching object lineage'
}

export function KeywordScanReport() {
  const {
    runScan, cancelScan, reset, previewMatches,
    results, columnResults, scanStatus, scanProgress, scanError, lastKeyword, hasRawAssets,
  } = useKeywordScan()

  const [inputValue, setInputValue] = useState('')

  const previewCount = inputValue.trim() ? previewMatches(inputValue) : 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inputValue.trim()) return
    runScan(inputValue.trim())
  }

  function handleClear() {
    setInputValue('')
    reset()
  }

  function handleExportCsv() {
    const headers = [
      'Keyword', 'Level', 'Object/Column', 'Parent Table', 'DataType',
      'Database', 'Schema', 'Connection', 'Tool', 'Type',
      'Direction', 'Related Object/Column', 'Related Table', 'Related Database',
      'Related Schema', 'Related Connection', 'Related Tool', 'Related Type',
    ]
    const rows: Array<Array<string | number>> = []

    for (const r of results) {
      const base = [
        lastKeyword, 'object', r.objectName, '', '',
        r.databaseName, r.schemaName, r.connectionName, r.toolName, r.toolType,
      ]
      if (r.upstreamSources.length === 0 && r.downstreamConsumers.length === 0) {
        rows.push([...base, '', '', '', '', '', '', '', ''])
      }
      for (const s of r.upstreamSources) {
        rows.push([...base, 'upstream', s.objectName, '', s.databaseName, s.schemaName, s.connectionName, s.toolName, s.toolType])
      }
      for (const c of r.downstreamConsumers) {
        rows.push([...base, 'downstream', c.objectName, '', c.databaseName, c.schemaName, c.connectionName, c.toolName, c.toolType])
      }
    }

    for (const r of columnResults) {
      const base = [
        lastKeyword, 'column', r.columnName, r.tableName, r.dataType,
        r.databaseName, r.schemaName, r.connectionName, r.toolName, r.toolType,
      ]
      if (r.upstreamColumns.length === 0 && r.downstreamColumns.length === 0) {
        rows.push([...base, '', '', '', '', '', '', '', ''])
      }
      for (const s of r.upstreamColumns) {
        rows.push([...base, 'upstream', s.columnName, s.tableName, s.databaseName, s.schemaName, s.connectionName, s.toolName, s.toolType])
      }
      for (const c of r.downstreamColumns) {
        rows.push([...base, 'downstream', c.columnName, c.tableName, c.databaseName, c.schemaName, c.connectionName, c.toolName, c.toolType])
      }
    }

    downloadCsv(`${lastKeyword}-lineage-scan.csv`, headers, rows)
  }

  if (!hasRawAssets) {
    return (
      <div className="surface-card p-8 text-center">
        <p className="text-sm text-muted">No catalog loaded. Run an analysis first.</p>
      </div>
    )
  }

  const elapsed = scanProgress
    ? Math.floor((Date.now() - scanProgress.startedAt) / 1000)
    : 0

  const totalResults = results.length + columnResults.length
  const isDone = scanStatus === 'done'

  return (
    <div className="space-y-4">
      <div className="surface-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Keyword Lineage Scan</h2>
          <p className="text-xs text-muted mt-0.5">
            Find all catalog objects and columns matching a term, then fetch their full lineage.
            Use <strong>Sources</strong> to trace data provenance (audit), or{' '}
            <strong>Consumers</strong> to map exposure (compliance/PII).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="e.g. TotalProductCost, email, customer_id"
              className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              spellCheck={false}
              autoComplete="off"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {inputValue.trim() && scanStatus !== 'scanning' && (
            <span className="text-xs text-muted shrink-0">
              {previewCount > 0
                ? `${previewCount} table${previewCount === 1 ? '' : 's'} + columns`
                : 'columns will be scanned'}
            </span>
          )}

          <button
            type="submit"
            disabled={!inputValue.trim() || scanStatus === 'scanning'}
            className="btn-primary text-sm shrink-0"
          >
            {scanStatus === 'scanning' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            {scanStatus === 'scanning' ? 'Scanning...' : 'Scan lineage'}
          </button>

          {scanStatus === 'scanning' && (
            <button type="button" onClick={cancelScan} className="btn-ghost text-xs shrink-0">
              Cancel
            </button>
          )}
        </form>

        {scanProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {phaseLabel(scanProgress.phase)}
                {scanProgress.total > 0 && (
                  <span className="ml-1 font-mono">
                    {scanProgress.phase === 'fetching-columns'
                      ? scanProgress.done
                      : `${scanProgress.done} / ${scanProgress.total}`}
                  </span>
                )}
              </span>
              <span className="font-mono tabular-nums">{elapsed}s</span>
            </div>
            {scanProgress.total > 0 && scanProgress.phase !== 'fetching-columns' && (
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all duration-300"
                  style={{ width: `${Math.round((scanProgress.done / scanProgress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {scanError && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{scanError}</p>
        )}
      </div>

      {isDone && totalResults === 0 && (
        <div className="surface-card p-8 text-center">
          <p className="text-sm text-muted">
            No tables or columns matched <span className="font-mono">{lastKeyword}</span>.
          </p>
          <p className="text-xs text-muted mt-1">
            {scanError ? 'Column catalog could not be fetched — try a table name instead.' : 'Try a different or shorter term.'}
          </p>
        </div>
      )}

      {totalResults > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            {results.length > 0 && (
              <span>
                <span className="font-medium text-foreground">{results.length}</span>{' '}
                object{results.length === 1 ? '' : 's'}
              </span>
            )}
            {results.length > 0 && columnResults.length > 0 && (
              <span className="mx-1.5 text-muted/40">·</span>
            )}
            {columnResults.length > 0 && (
              <span>
                <span className="font-medium text-foreground">{columnResults.length}</span>{' '}
                column{columnResults.length === 1 ? '' : 's'}
              </span>
            )}
            {isDone && ' matched'}
          </p>
          {isDone && (
            <button onClick={handleExportCsv} className="btn-ghost text-xs">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.length > 0 && columnResults.length > 0 && (
            <p className="text-xs font-medium text-muted uppercase tracking-wide px-1">Objects</p>
          )}
          {results.map(r => (
            <ResultCard key={r.key} result={r} />
          ))}
        </div>
      )}

      {columnResults.length > 0 && (
        <div className="space-y-2">
          {results.length > 0 && (
            <p className="text-xs font-medium text-muted uppercase tracking-wide px-1">Columns</p>
          )}
          {columnResults.map(r => (
            <ColumnResultCard key={r.key} result={r} />
          ))}
        </div>
      )}
    </div>
  )
}
