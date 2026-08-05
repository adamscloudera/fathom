import { useState, useRef, useEffect } from 'react'
import { Plug, LogOut, Search, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { octopai } from '../logic/octopaiApi.ts'
import { selectSampleKeys, analyze } from '../logic/analyzer.ts'
import type { AssetItem } from '@adamscloudera/octopai-api'
import type { LineageResult, LineageDashboard } from '../logic/types.ts'
import { useSessionStore } from '../stores/useSessionStore.ts'
import { useInsightsStore } from '../stores/useInsightsStore.ts'

function TokenExpiry({ expiry }: { expiry: string }) {
  if (!expiry) return null
  const ms = new Date(expiry).getTime() - Date.now()
  if (ms <= 0) return <span className="text-xs text-red-500">Token expired</span>
  const mins = Math.round(ms / 60000)
  if (mins < 60) return <span className="text-xs text-amber-600">Token expires in {mins}m</span>
  const hrs = Math.round(ms / 3600000)
  return <span className="text-xs text-muted">Token expires in {hrs}h</span>
}

export function LoginPanel() {
  const {
    company, accessToken, accessExpiry, displayName, status, error,
    scanProgress, setConfig, setTokens, setStatus, setScanProgress, clearSession,
  } = useSessionStore()
  const { setInsights, clearInsights } = useInsightsStore()

  const [companyInput, setCompanyInput] = useState(company)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [elapsed, setElapsed] = useState(0)

  const analyzeAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!scanProgress) { setElapsed(0); return }
    const { startedAt } = scanProgress
    setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [scanProgress?.startedAt])

  const isConnected = !!accessToken
  const isBusy = status === 'connecting' || status === 'scanning' || status === 'sampling'

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!companyInput.trim() || !email.trim() || !password.trim()) return
    setConfig(companyInput.trim())
    setStatus('connecting', null)
    try {
      const resp = await octopai.login(companyInput.trim(), email, password)
      setTokens({
        accessToken: resp.accessToken,
        accessExpiry: resp.expiration,
        displayName: resp.displayName || resp.userName,
      })
      setPassword('')
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : String(err))
    }
  }

  async function handleAnalyze() {
    if (!accessToken) return
    clearInsights()
    analyzeAbortRef.current?.abort()
    const controller = new AbortController()
    analyzeAbortRef.current = controller

    const catalogStart = Date.now()
    setStatus('scanning', null)
    setScanProgress({ phase: 'catalog', done: 0, total: 0, startedAt: catalogStart })

    let assets: AssetItem[] = []
    try {
      assets = await octopai.queryAllAssets(
        company,
        accessToken,
        (fetched) => setScanProgress({ phase: 'catalog', done: fetched, total: 0, startedAt: catalogStart }),
        controller.signal,
      )
    } catch (err) {
      if (controller.signal.aborted) { setScanProgress(null); return }
      const msg = err instanceof Error ? err.message : String(err)
      setScanProgress(null)
      setStatus('error', msg)
      return
    }

    if (controller.signal.aborted || analyzeAbortRef.current !== controller) {
      setScanProgress(null)
      return
    }

    const catalogPhaseDurationMs = Date.now() - catalogStart
    const toolCount = new Set(assets.map((a) => a.toolName ?? 'UNK')).size
    // Scale sample count: at least 20 per tool or 2% of catalog, whichever is larger, capped at 500.
    const targetSamples = Math.min(500, Math.max(toolCount * 20, Math.ceil(assets.length * 0.02)))
    const sampleKeys = selectSampleKeys(assets, targetSamples)
    const lineageStart = Date.now()
    setStatus('sampling', null)
    setScanProgress({ phase: 'lineage', done: 0, total: sampleKeys.length, startedAt: lineageStart })

    const lineageResults: LineageResult[] = []
    let completed = 0
    const CONCURRENCY = 10

    for (let batch = 0; batch < sampleKeys.length; batch += CONCURRENCY) {
      if (controller.signal.aborted || analyzeAbortRef.current !== controller) break
      const chunk = sampleKeys.slice(batch, batch + CONCURRENCY)
      const settled = await Promise.allSettled(
        chunk.map((key) =>
          octopai.queryLineage(company, accessToken, key, 2, controller.signal).then((raw) => ({
            key,
            raw,
          }))
        )
      )
      for (const r of settled) {
        if (r.status === 'fulfilled') {
          const { key, raw } = r.value
          lineageResults.push({
            queryKey: key,
            nodes: (raw.nodes ?? []) as LineageResult['nodes'],
            edges: raw.links ?? [],
          })
        }
      }
      completed += chunk.length
      setScanProgress({ phase: 'lineage', done: completed, total: sampleKeys.length, startedAt: lineageStart })
    }

    if (controller.signal.aborted || analyzeAbortRef.current !== controller) {
      setScanProgress(null)
      return
    }

    const lineagePhaseDurationMs = Date.now() - lineageStart

    // Phase 3: read Cross System Lineage Dashboard counts via internal API
    setScanProgress({ phase: 'dashboard', done: 0, total: 3, startedAt: Date.now() })

    let lineageDashboard: LineageDashboard | null = null
    let columnDashboard: LineageDashboard | null = null
    const connectionIds = [...new Set(
      assets.map((a) => a.connectionId).filter((id): id is string => Boolean(id))
    )]

    if (!controller.signal.aborted && analyzeAbortRef.current === controller) {
      const [etlRes, dbRes, reportRes, colEtlRes, colDbRes, colReportRes] = await Promise.allSettled([
        octopai.queryLineageDashboard(company, accessToken, connectionIds, 'ETL', controller.signal),
        octopai.queryLineageDashboard(company, accessToken, connectionIds, 'DB', controller.signal),
        octopai.queryLineageDashboard(company, accessToken, connectionIds, 'REPORT', controller.signal),
        octopai.queryColumnDashboard(company, accessToken, connectionIds, 'ETL', controller.signal),
        octopai.queryColumnDashboard(company, accessToken, connectionIds, 'DB', controller.signal),
        octopai.queryColumnDashboard(company, accessToken, connectionIds, 'REPORT', controller.signal),
      ])

      if (
        etlRes.status === 'fulfilled' &&
        dbRes.status === 'fulfilled' &&
        reportRes.status === 'fulfilled'
      ) {
        lineageDashboard = {
          etl: { total: etlRes.value.total?.ETL ?? 0, byTool: etlRes.value.total?.etldetails ?? {} },
          db: { total: dbRes.value.total?.DB ?? 0, byTool: dbRes.value.total?.DBdetails ?? {} },
          report: { total: reportRes.value.total?.REPORT ?? 0, byTool: reportRes.value.total?.REPORTDETAILS ?? {} },
        }
      }

      if (
        colEtlRes.status === 'fulfilled' &&
        colDbRes.status === 'fulfilled' &&
        colReportRes.status === 'fulfilled'
      ) {
        columnDashboard = {
          etl: { total: colEtlRes.value.total ?? 0, byTool: colEtlRes.value.details ?? {} },
          db: { total: colDbRes.value.total ?? 0, byTool: colDbRes.value.details ?? {} },
          report: { total: colReportRes.value.total ?? 0, byTool: colReportRes.value.details ?? {} },
        }
      }
    }

    // Phase 4: enrich nodes that lack objectName by querying lineage for them directly.
    // When a node is the queried object (rather than a neighbor), the v2.0 API may
    // populate its objectName in the response even if it was empty as a neighbor.
    if (!controller.signal.aborted && analyzeAbortRef.current === controller) {
      // Collect unique unnamed node keys (dedup across results)
      const unnamedByKey = new Map<string, Array<{ ri: number; ni: number }>>()
      for (let ri = 0; ri < lineageResults.length; ri++) {
        for (let ni = 0; ni < lineageResults[ri].nodes.length; ni++) {
          const node = lineageResults[ri].nodes[ni]
          if (!node.objectName) {
            if (!unnamedByKey.has(node._key)) unnamedByKey.set(node._key, [])
            unnamedByKey.get(node._key)!.push({ ri, ni })
          }
        }
      }
      const keysToQuery = [...unnamedByKey.keys()].slice(0, 20)
      console.log('[fathom 4] unnamed nodes:', unnamedByKey.size, '| querying', keysToQuery.length)
      if (keysToQuery.length > 0) {
        const directResults = await Promise.allSettled(
          keysToQuery.map((key) =>
            octopai.queryLineage(company, accessToken, key, 1, controller.signal)
              .then((r) => ({ key, response: r }))
          )
        )
        let enrichedCount = 0
        for (const r of directResults) {
          if (r.status !== 'fulfilled') continue
          const { key, response } = r.value
          const mainKey = response.mainNode
          // Find the queried node in the response — match by exact key or bare id
          const bareMain = mainKey.includes('/') ? mainKey.split('/').pop()! : mainKey
          const mainNode = response.nodes.find((n) => {
            const bare = n._key.includes('/') ? n._key.split('/').pop()! : n._key
            return n._key === mainKey || n._key === key || bare === bareMain || bare === key
          })
          if (!mainNode?.objectName) continue
          enrichedCount++
          for (const { ri, ni } of unnamedByKey.get(key) ?? []) {
            const node = lineageResults[ri].nodes[ni]
            node.objectName = mainNode.objectName
            if (mainNode.objectType && !node.objectType) node.objectType = mainNode.objectType
          }
        }
        console.log('[fathom 4] enriched', enrichedCount, 'of', keysToQuery.length)
      }
    }

    setScanProgress(null)

    const insights = analyze(
      company,
      assets,
      lineageResults,
      catalogPhaseDurationMs,
      lineagePhaseDurationMs,
      new Date().toISOString(),
      lineageDashboard,
      columnDashboard,
    )
    setInsights(insights)
    setStatus('done', null)
  }

  function handleDisconnect() {
    analyzeAbortRef.current?.abort()
    clearSession()
    clearInsights()
  }

  if (!isConnected) {
    return (
      <div className="surface-card p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Plug className="w-4 h-4 text-primary" />
            Connect to a tenant
          </h2>
          <p className="mt-1 text-sm text-muted">
            Enter your Octopai tenant and credentials to pull a full catalog scan and lineage sample.
          </p>
        </div>

        <form onSubmit={handleConnect} className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Company name</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                placeholder="acme"
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoComplete="off"
                spellCheck={false}
              />
              <span className="text-xs text-muted whitespace-nowrap">.octopai.com</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isBusy || !companyInput.trim() || !email.trim() || !password.trim()}
              className="btn-primary"
            >
              {status === 'connecting' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plug className="w-4 h-4" />
              )}
              {status === 'connecting' ? 'Connecting…' : 'Connect'}
            </button>
          </div>

          {status === 'error' && error && (
            <p className="flex items-start gap-2 text-xs text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              {error}
            </p>
          )}
        </form>
      </div>
    )
  }

  return (
    <div className="surface-card p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{company}.octopai.com</span>
              <TokenExpiry expiry={accessExpiry} />
            </div>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isBusy}
          className={clsx('btn-primary', status === 'done' && 'opacity-80')}
        >
          {isBusy ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {status === 'scanning' ? 'Scanning catalog…'
            : status === 'sampling' ? 'Sampling lineage…'
            : status === 'done' ? 'Re-analyze'
            : 'Analyze'}
        </button>

        <button onClick={handleDisconnect} disabled={isBusy} className="btn-ghost">
          <LogOut className="w-4 h-4" />
          Disconnect
        </button>
      </div>

      {scanProgress && (
        <div className="space-y-1.5 p-3 rounded-lg bg-muted/20 border border-border/60">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {scanProgress.phase === 'catalog'
                ? scanProgress.done > 0
                  ? `Catalog: ${scanProgress.done.toLocaleString()} objects fetched…`
                  : 'Fetching catalog…'
                : scanProgress.phase === 'lineage'
                ? `Lineage sample: ${scanProgress.done} / ${scanProgress.total}`
                : 'Reading lineage dashboard…'}
            </span>
            <span className="font-mono text-muted tabular-nums">{elapsed}s</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            {scanProgress.phase === 'lineage' && scanProgress.total > 0 ? (
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-300"
                style={{ width: `${Math.round((scanProgress.done / scanProgress.total) * 100)}%` }}
              />
            ) : (
              <div className="h-full rounded-full bg-primary/60 animate-pulse w-full" />
            )}
          </div>
        </div>
      )}

      {status === 'error' && error && (
        <p className="flex items-start gap-2 text-xs text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
          {error}
        </p>
      )}
    </div>
  )
}
