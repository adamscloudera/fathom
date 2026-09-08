import type { AssetItem } from '@adamscloudera/octopai-api'

export type { AssetItem }

export type LineageNodeRaw = {
  _key: string
  objectName?: string
  schemaName?: string
  databaseName?: string
  objectType?: string
  connectionName?: string
  toolName?: string
  toolType?: string
  objectGUID?: string
  ins?: number
  outs?: number
}

export type LineageEdge = {
  from: string
  to: string
  type?: string
}

export type LineageResult = {
  queryKey: string
  nodes: LineageNodeRaw[]
  edges: LineageEdge[]
}

export type ToolBreakdownEntry = {
  toolName: string
  toolType: string
  count: number
}

export type ConnectionBreakdownEntry = {
  connectionName: string
  toolName: string
  count: number
}

export type DegreeEntry = {
  key: string
  objectName: string
  connectionName: string
  databaseName: string
  schemaName: string
  objectType: string
  degree: number
  ins: number
  outs: number
}

export type CrossToolFlow = {
  fromTool: string
  toTool: string
  linkCount: number
}

export type LineageDashboardBucket = {
  total: number
  byTool: Record<string, number>
}

export type LineageDashboard = {
  etl: LineageDashboardBucket
  db: LineageDashboardBucket
  report: LineageDashboardBucket
}

export type DeepOrphanEntry = {
  key: string
  objectName: string
  connectionName: string
  databaseName: string
  schemaName: string
  objectType: string
  toolName: string
  toolType: string
  source: 'sample' | 'deep'
}

export type DeepScanProgress = {
  done: number
  total: number
  startedAt: number
}

export type FathomInsights = {
  tenantName: string
  fetchedAt: string
  catalogPhaseDurationMs: number
  lineagePhaseDurationMs: number
  totalAssets: number
  toolBreakdown: ToolBreakdownEntry[]
  distinctDatabases: number
  distinctSchemas: number
  connectionBreakdown: ConnectionBreakdownEntry[]
  lineageSampledCount: number
  lineageCoverageRate: number
  confirmedOrphans: DegreeEntry[]
  topByDegree: DegreeEntry[]
  lowDegree: DegreeEntry[]
  crossToolFlows: CrossToolFlow[]
  inferredInsights: string[]
  lineageDashboard: LineageDashboard | null
  columnDashboard: LineageDashboard | null
}
