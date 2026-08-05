import type { AssetItem } from '@adamscloudera/octopai-api'
import type {
  LineageResult, LineageNodeRaw, ToolBreakdownEntry, ConnectionBreakdownEntry,
  DegreeEntry, CrossToolFlow, FathomInsights, LineageDashboard,
} from './types.ts'

const MAX_TOP = 10
const MAX_ORPHANS = 20

export function selectSampleKeys(assets: AssetItem[], maxKeys = 50): string[] {
  const byConn = new Map<string, string[]>()
  for (const a of assets) {
    const conn = a.connectionName ?? '__unknown__'
    if (!byConn.has(conn)) byConn.set(conn, [])
    byConn.get(conn)!.push(a._key)
  }
  const connCount = byConn.size || 1
  const perConn = Math.ceil(maxKeys / connCount)
  const selected: string[] = []
  for (const keys of byConn.values()) {
    const step = Math.max(1, Math.floor(keys.length / perConn))
    for (let i = 0; i < keys.length && selected.length < maxKeys; i += step) {
      selected.push(keys[i])
    }
  }
  return selected.slice(0, maxKeys)
}

function toDegreeEntry(node: LineageNodeRaw, fallbackAsset?: AssetItem): DegreeEntry {
  const ins = node.ins ?? 0
  const outs = node.outs ?? 0
  return {
    key: node._key,
    objectName: node.objectName ?? fallbackAsset?.objectName ?? node._key.slice(-8),
    connectionName: node.connectionName ?? fallbackAsset?.connectionName ?? '',
    databaseName: node.databaseName ?? fallbackAsset?.databaseName ?? '',
    schemaName: node.schemaName ?? fallbackAsset?.schemaName ?? '',
    degree: ins + outs,
    ins,
    outs,
  }
}

export function analyze(
  tenantName: string,
  assets: AssetItem[],
  lineageResults: LineageResult[],
  catalogPhaseDurationMs: number,
  lineagePhaseDurationMs: number,
  fetchedAt: string,
  lineageDashboard: LineageDashboard | null = null,
): FathomInsights {
  // Catalog-level analytics
  const toolCounts = new Map<string, { toolType: string; count: number }>()
  const connCounts = new Map<string, { toolName: string; count: number }>()
  const dbs = new Set<string>()
  const schemas = new Set<string>()

  for (const a of assets) {
    const tool = a.toolName ?? 'Unknown'
    const existing = toolCounts.get(tool)
    if (existing) { existing.count++ } else { toolCounts.set(tool, { toolType: a.toolType ?? 'Unknown', count: 1 }) }

    const conn = a.connectionName ?? 'Unknown'
    const existingConn = connCounts.get(conn)
    if (existingConn) { existingConn.count++ } else { connCounts.set(conn, { toolName: a.toolName ?? 'Unknown', count: 1 }) }

    if (a.databaseName && a.databaseName !== '-1') dbs.add(a.databaseName.toLowerCase())
    if (a.schemaName && a.schemaName !== '-1') {
      schemas.add(`${a.databaseName ?? ''}.${a.schemaName}`.toLowerCase())
    }
  }

  const toolBreakdown: ToolBreakdownEntry[] = [...toolCounts.entries()]
    .map(([toolName, { toolType, count }]) => ({ toolName, toolType, count }))
    .sort((a, b) => b.count - a.count)

  const connectionBreakdown: ConnectionBreakdownEntry[] = [...connCounts.entries()]
    .map(([connectionName, { toolName, count }]) => ({ connectionName, toolName, count }))
    .sort((a, b) => b.count - a.count)

  // Lineage analytics
  const assetByKey = new Map<string, AssetItem>()
  for (const a of assets) assetByKey.set(a._key, a)

  const toolByKey = new Map<string, string>()
  for (const a of assets) {
    if (a.toolName) toolByKey.set(a._key, a.toolName)
  }

  // Collect best connectivity reading per unique node key
  const nodeMap = new Map<string, LineageNodeRaw>()
  for (const result of lineageResults) {
    for (const node of result.nodes) {
      const existing = nodeMap.get(node._key)
      if (!existing || (node.ins ?? 0) + (node.outs ?? 0) > (existing.ins ?? 0) + (existing.outs ?? 0)) {
        nodeMap.set(node._key, node)
        if (node.toolName) toolByKey.set(node._key, node.toolName)
      }
    }
  }

  const allDegrees: DegreeEntry[] = [...nodeMap.values()].map((n) =>
    toDegreeEntry(n, assetByKey.get(n._key))
  )

  const confirmedOrphans = allDegrees
    .filter((e) => e.ins === 0 && e.outs === 0)
    .slice(0, MAX_ORPHANS)

  const withConnections = allDegrees.filter((e) => e.degree > 0)
  const topByDegree = [...withConnections].sort((a, b) => b.degree - a.degree).slice(0, MAX_TOP)
  const lowDegree = [...withConnections].sort((a, b) => a.degree - b.degree).slice(0, MAX_TOP)

  // Cross-tool flows via edges
  const crossToolMap = new Map<string, number>()
  for (const result of lineageResults) {
    for (const edge of result.edges) {
      const fromTool = toolByKey.get(edge.from)
      const toTool = toolByKey.get(edge.to)
      if (fromTool && toTool && fromTool !== toTool) {
        const key = `${fromTool}→${toTool}`
        crossToolMap.set(key, (crossToolMap.get(key) ?? 0) + 1)
      }
    }
  }
  const crossToolFlows: CrossToolFlow[] = [...crossToolMap.entries()]
    .map((entry) => {
      const [fromTool, toTool] = entry[0].split('→')
      return { fromTool, toTool, linkCount: entry[1] }
    })
    .sort((a, b) => b.linkCount - a.linkCount)

  // Coverage rate: fraction of sampled keys whose lineage query returned any edges
  const coveredCount = lineageResults.filter((r) => r.edges.length > 0).length
  const lineageCoverageRate = lineageResults.length > 0 ? coveredCount / lineageResults.length : 0

  const inferredInsights = buildInferredInsights({
    toolBreakdown, distinctDatabases: dbs.size, distinctSchemas: schemas.size,
    lineageCoverageRate, lineageSampledCount: lineageResults.length,
    confirmedOrphans, topByDegree, crossToolFlows,
  })

  return {
    tenantName,
    fetchedAt,
    catalogPhaseDurationMs,
    lineagePhaseDurationMs,
    totalAssets: assets.length,
    toolBreakdown,
    distinctDatabases: dbs.size,
    distinctSchemas: schemas.size,
    connectionBreakdown,
    lineageSampledCount: lineageResults.length,
    lineageCoverageRate,
    confirmedOrphans,
    topByDegree,
    lowDegree,
    crossToolFlows,
    inferredInsights,
    lineageDashboard,
  }
}

type InsightInputs = {
  toolBreakdown: ToolBreakdownEntry[]
  distinctDatabases: number
  distinctSchemas: number
  lineageCoverageRate: number
  lineageSampledCount: number
  confirmedOrphans: DegreeEntry[]
  topByDegree: DegreeEntry[]
  crossToolFlows: CrossToolFlow[]
}

function buildInferredInsights(i: InsightInputs): string[] {
  const out: string[] = []

  // Catalog breadth
  const toolCount = i.toolBreakdown.length
  if (toolCount >= 2) {
    const dbTools = i.toolBreakdown.filter((t) => t.toolType === 'DB').length
    const etlTools = i.toolBreakdown.filter((t) => t.toolType === 'ETL').length
    const biTools = i.toolBreakdown.filter((t) => t.toolType === 'REPORT').length
    const parts: string[] = []
    if (dbTools > 0) parts.push(`${dbTools} DB`)
    if (etlTools > 0) parts.push(`${etlTools} ETL`)
    if (biTools > 0) parts.push(`${biTools} BI/reporting`)
    out.push(
      `Catalog spans ${toolCount} tool${toolCount === 1 ? '' : 's'} (${parts.join(', ')}) across ${i.distinctDatabases} database${i.distinctDatabases === 1 ? '' : 's'}.`
    )
  }

  // Lineage coverage
  if (i.lineageSampledCount > 0) {
    const pct = Math.round(i.lineageCoverageRate * 100)
    if (pct < 30) {
      out.push(
        `Low lineage coverage: only ${pct}% of sampled objects have active connections. Harvesting may be incomplete or connections recently added.`
      )
    } else if (pct >= 70) {
      out.push(`Strong lineage coverage: ${pct}% of sampled objects have active connections.`)
    }
  }

  // Orphans
  if (i.confirmedOrphans.length > 0) {
    out.push(
      `${i.confirmedOrphans.length} orphaned object${i.confirmedOrphans.length === 1 ? '' : 's'} found with no lineage connections — likely missing connector coverage or inactive tables.`
    )
  }

  // Cross-tool flows
  if (i.crossToolFlows.length > 0) {
    const top = i.crossToolFlows[0]
    out.push(
      `Most active cross-tool flow: ${top.fromTool} → ${top.toTool} (${top.linkCount} link${top.linkCount === 1 ? '' : 's'} in sample).`
    )
  }

  // Isolated tools (have assets but no cross-tool edges)
  if (i.lineageSampledCount > 0) {
    const toolsInFlows = new Set(i.crossToolFlows.flatMap((f) => [f.fromTool, f.toTool]))
    const isolated = i.toolBreakdown.filter((t) => !toolsInFlows.has(t.toolName)).map((t) => t.toolName)
    if (isolated.length > 0) {
      out.push(
        `No cross-tool lineage detected for: ${isolated.join(', ')}. These tools may be isolated or require additional harvesting.`
      )
    }
  }

  // High-value object
  if (i.topByDegree.length > 0) {
    const top = i.topByDegree[0]
    out.push(
      `Most connected object: ${top.objectName}${top.connectionName ? ` (${top.connectionName})` : ''} — degree ${top.degree} (${top.ins} in, ${top.outs} out).`
    )
  }

  return out
}
