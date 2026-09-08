import { useState, useRef } from 'react'
import { octopai } from '../logic/octopaiApi.ts'
import type { AssetItem } from '@adamscloudera/octopai-api'
import type { ColumnMatchResult, ColumnScanNode } from '../logic/types.ts'
import { useSessionStore } from '../stores/useSessionStore.ts'

const CONCURRENCY = 10

export type KeywordScanStatus = 'idle' | 'scanning' | 'done' | 'error'

export type ScanPhase = 'searching' | 'lineage'

export type KeywordScanProgress = {
  phase: ScanPhase
  done: number
  total: number
  startedAt: number
}

type NormalizedNode = {
  _key: string
  objectName?: string
  connectionName?: string
  databaseName?: string
  schemaName?: string
  toolName?: string
  toolType?: string
  assetName?: string
  dataType?: string
}

const bareKey = (k: string) => {
  const s = k.lastIndexOf('/')
  return s >= 0 ? k.slice(s + 1) : k
}

function toScanNode(node: NormalizedNode): ColumnScanNode {
  return {
    key: bareKey(node._key),
    columnName: node.assetName ?? '',
    tableName: node.objectName ?? '',
    connectionName: node.connectionName ?? '',
    databaseName: node.databaseName ?? '',
    schemaName: node.schemaName ?? '',
    toolName: node.toolName ?? '',
    toolType: node.toolType ?? '',
  }
}

export function useKeywordScan() {
  const { company, accessToken } = useSessionStore()

  const [columnResults, setColumnResults] = useState<ColumnMatchResult[]>([])
  const [scanStatus, setScanStatus] = useState<KeywordScanStatus>('idle')
  const [scanProgress, setScanProgress] = useState<KeywordScanProgress | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [lastKeyword, setLastKeyword] = useState<string>('')
  const abortRef = useRef<AbortController | null>(null)

  async function runScan(keyword: string) {
    if (!accessToken || !keyword.trim()) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLastKeyword(keyword)
    setScanStatus('scanning')
    setScanError(null)
    setColumnResults([])

    // Phase 1: server-side name search
    const searchStart = Date.now()
    setScanProgress({ phase: 'searching', done: 0, total: 0, startedAt: searchStart })

    let matchedAssets: AssetItem[] = []
    try {
      matchedAssets = await octopai.queryAssetsByName(
        company,
        accessToken,
        [keyword],
        controller.signal,
      )
    } catch (err) {
      if (controller.signal.aborted) {
        setScanStatus('idle')
        setScanProgress(null)
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      setScanStatus('error')
      setScanError(msg)
      setScanProgress(null)
      return
    }

    if (controller.signal.aborted) {
      setScanStatus('idle')
      setScanProgress(null)
      return
    }

    if (matchedAssets.length === 0) {
      setScanStatus('done')
      setScanProgress(null)
      return
    }

    // Phase 2: bidirectional lineage for each matched asset (direction: 0, depth: 10)
    const initialResults: ColumnMatchResult[] = matchedAssets.map(a => ({
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
    setColumnResults(initialResults)

    const lineageStart = Date.now()
    setScanProgress({ phase: 'lineage', done: 0, total: matchedAssets.length, startedAt: lineageStart })

    let completed = 0
    const updatedResults = [...initialResults]

    for (let batch = 0; batch < matchedAssets.length; batch += CONCURRENCY) {
      if (controller.signal.aborted) break
      const chunk = matchedAssets.slice(batch, batch + CONCURRENCY)

      const settled = await Promise.allSettled(
        chunk.map(a =>
          octopai.queryLineage(company, accessToken, a._key, 10, controller.signal, 0).then(raw => ({
            key: a._key,
            raw,
          }))
        )
      )

      for (const r of settled) {
        if (r.status !== 'fulfilled') continue
        const { key, raw } = r.value
        const bk = bareKey(key)

        const links = raw.links ?? []
        const allFrom = new Set(links.map(e => bareKey(e.from)))
        const allTo = new Set(links.map(e => bareKey(e.to)))

        // Upstream: nodes that push data (appear as _from) but receive nothing (_not_ in allTo)
        // These are the leaf sources — the original data origins.
        const upstream: ColumnScanNode[] = (raw.nodes ?? [])
          .filter(n => {
            const k = bareKey((n as NormalizedNode)._key)
            return k !== bk && allFrom.has(k) && !allTo.has(k)
          })
          .map(n => toScanNode(n as NormalizedNode))

        // Downstream: nodes that receive data (_to) but push nothing (_not_ in allFrom)
        // These are the leaf consumers — the terminal destinations.
        const downstream: ColumnScanNode[] = (raw.nodes ?? [])
          .filter(n => {
            const k = bareKey((n as NormalizedNode)._key)
            return k !== bk && allTo.has(k) && !allFrom.has(k)
          })
          .map(n => toScanNode(n as NormalizedNode))

        const dedup = (nodes: ColumnScanNode[]) => {
          const seen = new Set<string>()
          return nodes.filter(n => { if (seen.has(n.key)) return false; seen.add(n.key); return true })
        }

        const idx = updatedResults.findIndex(x => x.key === key || x.key === bk)
        if (idx >= 0) {
          updatedResults[idx] = {
            ...updatedResults[idx],
            upstreamColumns: dedup(upstream),
            downstreamColumns: dedup(downstream),
            lineageFetched: true,
          }
        }
      }

      completed += chunk.length
      setScanProgress({ phase: 'lineage', done: completed, total: matchedAssets.length, startedAt: lineageStart })
      setColumnResults([...updatedResults])
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
    setColumnResults([])
    setLastKeyword('')
    setScanError(null)
  }

  return {
    runScan,
    cancelScan,
    reset,
    columnResults,
    scanStatus,
    scanProgress,
    scanError,
    lastKeyword,
  }
}
