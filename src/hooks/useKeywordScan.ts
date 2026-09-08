import { useState, useRef } from 'react'
import { octopai } from '../logic/octopaiApi.ts'
import type { AssetItem } from '@adamscloudera/octopai-api'
import type { KeywordMatchResult, ScanNode, ColumnMatchResult, ColumnScanNode } from '../logic/types.ts'
import { useSessionStore } from '../stores/useSessionStore.ts'
import { useInsightsStore } from '../stores/useInsightsStore.ts'

const CONCURRENCY = 10

export type KeywordScanStatus = 'idle' | 'scanning' | 'done' | 'error'

export type ScanPhase = 'objects' | 'fetching-columns' | 'columns'

export type KeywordScanProgress = {
  phase: ScanPhase
  done: number
  total: number
  startedAt: number
}

// Type for a lineage node as it arrives from the API — LineageNode extended with
// the tool fields that normalizeItem spreads in at runtime but are absent from the
// typed LineageNode interface.
type NormalizedNode = {
  _key: string
  objectName?: string
  connectionName?: string
  databaseName?: string
  schemaName?: string
  toolName?: string
  toolType?: string
  assetName?: string   // column name for assetType:1 nodes
  dataType?: string
}

function matchObjectAssets(keyword: string, assets: AssetItem[]): AssetItem[] {
  const term = keyword.toLowerCase().trim()
  if (!term) return []
  return assets.filter(a =>
    (a.objectName ?? '').toLowerCase().includes(term) ||
    (a.schemaName ?? '').toLowerCase().includes(term) ||
    (a.databaseName ?? '').toLowerCase().includes(term)
  )
}

function matchColumnAssets(keyword: string, assets: AssetItem[]): AssetItem[] {
  const term = keyword.toLowerCase().trim()
  if (!term) return []
  return assets.filter(a => (a.assetName ?? '').toLowerCase().includes(term))
}

const bareKey = (k: string) => {
  const s = k.lastIndexOf('/')
  return s >= 0 ? k.slice(s + 1) : k
}

export function useKeywordScan() {
  const { company, accessToken } = useSessionStore()
  const { rawAssets } = useInsightsStore()

  const [results, setResults] = useState<KeywordMatchResult[]>([])
  const [columnResults, setColumnResults] = useState<ColumnMatchResult[]>([])
  const [scanStatus, setScanStatus] = useState<KeywordScanStatus>('idle')
  const [scanProgress, setScanProgress] = useState<KeywordScanProgress | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [lastKeyword, setLastKeyword] = useState<string>('')
  const abortRef = useRef<AbortController | null>(null)

  // Instant catalog match (no network) — call on every keystroke to preview object hits
  function previewMatches(keyword: string): number {
    return matchObjectAssets(keyword, rawAssets).length
  }

  async function runScan(keyword: string) {
    if (!accessToken || !keyword.trim()) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLastKeyword(keyword)
    setScanStatus('scanning')
    setScanError(null)
    setResults([])
    setColumnResults([])

    // --- Phase 1: Object scan (uses already-fetched rawAssets) ---
    const matchedObjects = matchObjectAssets(keyword, rawAssets)

    if (matchedObjects.length > 0) {
      const initialResults: KeywordMatchResult[] = matchedObjects.map(a => ({
        key: a._key,
        objectName: a.objectName ?? '',
        connectionName: a.connectionName ?? '',
        databaseName: a.databaseName ?? '',
        schemaName: a.schemaName ?? '',
        objectType: a.objectType ?? '',
        toolName: a.toolName ?? '',
        toolType: a.toolType ?? '',
        upstreamSources: [],
        downstreamConsumers: [],
        lineageFetched: false,
      }))
      setResults(initialResults)

      const objectStart = Date.now()
      setScanProgress({ phase: 'objects', done: 0, total: matchedObjects.length, startedAt: objectStart })

      let completed = 0
      const updatedResults = [...initialResults]

      for (let batch = 0; batch < matchedObjects.length; batch += CONCURRENCY) {
        if (controller.signal.aborted) break
        const chunk = matchedObjects.slice(batch, batch + CONCURRENCY)

        const settled = await Promise.allSettled(
          chunk.map(a =>
            octopai.queryLineage(company, accessToken, a._key, 2, controller.signal).then(raw => ({
              key: a._key,
              raw,
            }))
          )
        )

        for (const r of settled) {
          if (r.status !== 'fulfilled') continue
          const { key, raw } = r.value
          const bk = bareKey(key)

          const nodeInfo = (nk: string): ScanNode => {
            const found = (raw.nodes ?? []).find(n => bareKey(n._key) === bareKey(nk))
            const node = found as NormalizedNode | undefined
            return {
              key: bareKey(nk),
              objectName: node?.objectName ?? '',
              connectionName: node?.connectionName ?? '',
              databaseName: node?.databaseName ?? '',
              schemaName: node?.schemaName ?? '',
              toolName: node?.toolName ?? '',
              toolType: node?.toolType ?? '',
            }
          }

          const upstream: ScanNode[] = []
          const downstream: ScanNode[] = []
          for (const edge of (raw.links ?? [])) {
            const fromBk = bareKey(edge.from)
            const toBk = bareKey(edge.to)
            if (toBk === bk && fromBk !== bk) upstream.push(nodeInfo(edge.from))
            if (fromBk === bk && toBk !== bk) downstream.push(nodeInfo(edge.to))
          }

          const dedup = (nodes: ScanNode[]) => {
            const seen = new Set<string>()
            return nodes.filter(n => { if (seen.has(n.key)) return false; seen.add(n.key); return true })
          }

          const idx = updatedResults.findIndex(x => x.key === key || x.key === bk)
          if (idx >= 0) {
            updatedResults[idx] = {
              ...updatedResults[idx],
              upstreamSources: dedup(upstream),
              downstreamConsumers: dedup(downstream),
              lineageFetched: true,
            }
          }
        }

        completed += chunk.length
        setScanProgress({ phase: 'objects', done: completed, total: matchedObjects.length, startedAt: objectStart })
        setResults([...updatedResults])
      }
    }

    if (controller.signal.aborted) {
      setScanStatus('idle')
      setScanProgress(null)
      return
    }

    // --- Phase 2: Column scan (fetch column catalog from API, filter, fetch column lineage) ---
    let columnAssets: AssetItem[] = []
    try {
      const colFetchStart = Date.now()
      setScanProgress({ phase: 'fetching-columns', done: 0, total: 0, startedAt: colFetchStart })
      columnAssets = await octopai.queryAllColumnAssets(
        company,
        accessToken,
        (fetched) => setScanProgress({ phase: 'fetching-columns', done: fetched, total: 0, startedAt: colFetchStart }),
        controller.signal,
      )
    } catch (err) {
      if (controller.signal.aborted) {
        setScanStatus('idle')
        setScanProgress(null)
        return
      }
      // Column fetch failure is non-fatal — surface as a warning and continue with object results only
      const msg = err instanceof Error ? err.message : String(err)
      setScanError(`Column catalog unavailable: ${msg}`)
    }

    if (controller.signal.aborted) {
      setScanStatus('idle')
      setScanProgress(null)
      return
    }

    const matchedColumns = matchColumnAssets(keyword, columnAssets)

    if (matchedColumns.length > 0) {
      const initialColumnResults: ColumnMatchResult[] = matchedColumns.map(a => ({
        key: a._key,
        columnName: a.assetName ?? '',
        tableName: a.objectName ?? '',
        dataType: (a as AssetItem & { dataType?: string }).dataType ?? '',
        connectionName: a.connectionName ?? '',
        databaseName: a.databaseName ?? '',
        schemaName: a.schemaName ?? '',
        toolName: a.toolName ?? '',
        toolType: a.toolType ?? '',
        upstreamColumns: [],
        downstreamColumns: [],
        lineageFetched: false,
      }))
      setColumnResults(initialColumnResults)

      const colLineageStart = Date.now()
      setScanProgress({ phase: 'columns', done: 0, total: matchedColumns.length, startedAt: colLineageStart })

      let completedCols = 0
      const updatedColResults = [...initialColumnResults]

      for (let batch = 0; batch < matchedColumns.length; batch += CONCURRENCY) {
        if (controller.signal.aborted) break
        const chunk = matchedColumns.slice(batch, batch + CONCURRENCY)

        const settled = await Promise.allSettled(
          chunk.map(a =>
            octopai.queryColumnLineage(company, accessToken, a._key, 2, controller.signal).then(raw => ({
              key: a._key,
              raw,
            }))
          )
        )

        for (const r of settled) {
          if (r.status !== 'fulfilled') continue
          const { key, raw } = r.value
          const bk = bareKey(key)

          const colNodeInfo = (nk: string): ColumnScanNode => {
            const found = (raw.nodes ?? []).find(n => bareKey(n._key) === bareKey(nk))
            const node = found as NormalizedNode | undefined
            return {
              key: bareKey(nk),
              columnName: node?.assetName ?? '',
              tableName: node?.objectName ?? '',
              connectionName: node?.connectionName ?? '',
              databaseName: node?.databaseName ?? '',
              schemaName: node?.schemaName ?? '',
              toolName: node?.toolName ?? '',
              toolType: node?.toolType ?? '',
            }
          }

          const upstream: ColumnScanNode[] = []
          const downstream: ColumnScanNode[] = []
          for (const edge of (raw.links ?? [])) {
            const fromBk = bareKey(edge.from)
            const toBk = bareKey(edge.to)
            if (toBk === bk && fromBk !== bk) upstream.push(colNodeInfo(edge.from))
            if (fromBk === bk && toBk !== bk) downstream.push(colNodeInfo(edge.to))
          }

          const dedup = (nodes: ColumnScanNode[]) => {
            const seen = new Set<string>()
            return nodes.filter(n => { if (seen.has(n.key)) return false; seen.add(n.key); return true })
          }

          const idx = updatedColResults.findIndex(x => x.key === key || x.key === bk)
          if (idx >= 0) {
            updatedColResults[idx] = {
              ...updatedColResults[idx],
              upstreamColumns: dedup(upstream),
              downstreamColumns: dedup(downstream),
              lineageFetched: true,
            }
          }
        }

        completedCols += chunk.length
        setScanProgress({ phase: 'columns', done: completedCols, total: matchedColumns.length, startedAt: colLineageStart })
        setColumnResults([...updatedColResults])
      }
    }

    if (controller.signal.aborted) {
      setScanStatus('idle')
      setScanProgress(null)
      return
    }

    setScanProgress(null)
    setScanStatus('done')
  }

  function cancelScan() {
    abortRef.current?.abort()
    setScanStatus('idle')
    setScanProgress(null)
  }

  function reset() {
    cancelScan()
    setResults([])
    setColumnResults([])
    setLastKeyword('')
    setScanError(null)
  }

  return {
    runScan,
    cancelScan,
    reset,
    previewMatches,
    results,
    columnResults,
    scanStatus,
    scanProgress,
    scanError,
    lastKeyword,
    hasRawAssets: rawAssets.length > 0,
  }
}
