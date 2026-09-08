import type { AssetItem } from '@adamscloudera/octopai-api'
import { octopai } from './octopaiApi.ts'
import type { DeepOrphanEntry } from './types.ts'

const CONCURRENCY = 10

// Cap to keep scan time reasonable on large catalogs.
// At concurrency=10, ~1s/call: 2000 objects ≈ 3-4 minutes.
export const DEEP_SCAN_MAX = 2000

// Only scan DB (tables/views) and ETL (pipeline jobs) — reports are terminal nodes
// by definition and will never have downstream connections.
// Deduplicate by objectName+connectionName: a column-level catalog has N rows per table;
// querying all N would repeat the same lineage check N times for the same underlying object.
export function selectDeepScanCandidates(assets: AssetItem[]): AssetItem[] {
  const seen = new Set<string>()
  const candidates: AssetItem[] = []
  for (const a of assets) {
    if (a.toolType !== 'DB' && a.toolType !== 'ETL') continue
    const tableKey = `${a.connectionName ?? ''}||${a.objectName ?? ''}`
    if (seen.has(tableKey)) continue
    seen.add(tableKey)
    candidates.push(a)
    if (candidates.length >= DEEP_SCAN_MAX) break
  }
  return candidates
}

export function estimateScanSeconds(assets: AssetItem[]): number {
  return Math.ceil(selectDeepScanCandidates(assets).length / CONCURRENCY)
}

export async function runDeepOrphanScan(
  company: string,
  accessToken: string,
  assets: AssetItem[],
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<DeepOrphanEntry[]> {
  const candidates = selectDeepScanCandidates(assets)
  const total = candidates.length
  let done = 0
  const orphans: DeepOrphanEntry[] = []

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    if (signal.aborted) break
    const batch = candidates.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((asset) =>
        // direction: 0 = bidirectional; depth: 1 = one hop is enough to confirm any connection.
        // A true orphan has zero edges in either direction.
        octopai.queryLineage(company, accessToken, asset._key, 1, signal, 0).then((r) => ({
          asset,
          links: r.links ?? [],
        })),
      ),
    )
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const { asset, links } = r.value
      if (links.length === 0) {
        orphans.push({
          key: asset._key,
          objectName: asset.objectName ?? '',
          connectionName: asset.connectionName ?? '',
          databaseName: asset.databaseName ?? '',
          schemaName: asset.schemaName ?? '',
          objectType: asset.objectType ?? '',
          toolName: asset.toolName ?? '',
          toolType: asset.toolType ?? '',
          source: 'deep',
        })
      }
    }
    done += batch.length
    onProgress(done, total)
  }

  return orphans
}
