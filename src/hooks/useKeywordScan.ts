import { useState, useRef } from 'react'
import { octopai } from '../logic/octopaiApi.ts'
import type { AssetItem } from '@adamscloudera/octopai-api'
import type { KeywordMatchResult, ScanNode } from '../logic/types.ts'
import { useSessionStore } from '../stores/useSessionStore.ts'
import { useInsightsStore } from '../stores/useInsightsStore.ts'

const CONCURRENCY = 10

export type KeywordScanStatus = 'idle' | 'scanning' | 'done' | 'error'

export type KeywordScanProgress = {
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
}

function matchAssets(keyword: string, assets: AssetItem[]): AssetItem[] {
  const term = keyword.toLowerCase().trim()
  if (!term) return []
  return assets.filter(a =>
    (a.objectName ?? '').toLowerCase().includes(term) ||
    (a.schemaName ?? '').toLowerCase().includes(term) ||
    (a.databaseName ?? '').toLowerCase().includes(term)
  )
}

const bareKey = (k: string) => {
  const s = k.lastIndexOf('/')
  return s >= 0 ? k.slice(s + 1) : k
}

export function useKeywordScan() {
  const { company, accessToken } = useSessionStore()
  const { rawAssets } = useInsightsStore()

  const [results, setResults] = useState<KeywordMatchResult[]>([])
  const [scanStatus, setScanStatus] = useState<KeywordScanStatus>('idle')
  const [scanProgress, setScanProgress] = useState<KeywordScanProgress | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [lastKeyword, setLastKeyword] = useState<string>('')
  const abortRef = useRef<AbortController | null>(null)

  // Instant catalog match (no network) — call on every keystroke
  function previewMatches(keyword: string): number {
    return matchAssets(keyword, rawAssets).length
  }

  async function runScan(keyword: string) {
    if (!accessToken || !keyword.trim()) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const matched = matchAssets(keyword, rawAssets)
    setLastKeyword(keyword)

    if (matched.length === 0) {
      setResults([])
      setScanStatus('done')
      setScanProgress(null)
      return
    }

    // Initialise results with empty lineage so UI can show the match list immediately
    const initialResults: KeywordMatchResult[] = matched.map(a => ({
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
    setScanStatus('scanning')
    setScanError(null)

    const startedAt = Date.now()
    setScanProgress({ done: 0, total: matched.length, startedAt })

    let completed = 0
    const updatedResults = [...initialResults]

    for (let batch = 0; batch < matched.length; batch += CONCURRENCY) {
      if (controller.signal.aborted) break
      const chunk = matched.slice(batch, batch + CONCURRENCY)

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
      setScanProgress({ done: completed, total: matched.length, startedAt })
      setResults([...updatedResults])
    }

    if (controller.signal.aborted) {
      setScanStatus('idle')
      setScanProgress(null)
      return
    }

    setScanProgress(null)
    setScanStatus('done')
    setResults([...updatedResults])
  }

  function cancelScan() {
    abortRef.current?.abort()
    setScanStatus('idle')
    setScanProgress(null)
  }

  function reset() {
    cancelScan()
    setResults([])
    setLastKeyword('')
    setScanError(null)
  }

  return {
    runScan,
    cancelScan,
    reset,
    previewMatches,
    results,
    scanStatus,
    scanProgress,
    scanError,
    lastKeyword,
    hasRawAssets: rawAssets.length > 0,
  }
}
