import type { AssetItem } from '@adamscloudera/octopai-api'
import { octopai } from './octopaiApi.ts'
import type { DeepOrphanEntry } from './types.ts'

const CONCURRENCY = 10

// Cap to keep scan time reasonable on large catalogs.
// At concurrency=10, ~1s/call: 2000 objects ≈ 3-4 minutes.
export const DEEP_SCAN_MAX = 2000

const bareKey = (k: string): string => {
  const s = k.lastIndexOf('/')
  return s >= 0 ? k.slice(s + 1) : k
}

// Only scan DB (tables/views) and ETL (pipeline jobs) — reports are terminal nodes
// by definition and will never have downstream connections.
export function selectDeepScanCandidates(assets: AssetItem[]): AssetItem[] {
  return assets
    .filter((a) => a.toolType === 'DB' || a.toolType === 'ETL')
    .slice(0, DEEP_SCAN_MAX)
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
        octopai.queryLineage(company, accessToken, asset._key, 1, signal).then((r) => ({
          asset,
          links: (r.links ?? []) as Array<{ from: unknown; to: unknown }>,
        })),
      ),
    )
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const { asset, links } = r.value
      const bk = bareKey(asset._key)
      const hasOutbound = links.some((e) => bareKey(String(e.from)) === bk)
      if (!hasOutbound) {
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
