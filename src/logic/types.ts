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
  degree: number
  ins: number
  outs: number
}

export type CrossToolFlow = {
  fromTool: string
  toTool: string
  linkCount: number
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
}
