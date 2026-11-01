// Shared by the lineage sweeps (analysis, deep orphan scan, keyword scan). Each sweep used to drop
// rejected calls silently, so an expired token ended as "done" with empty results. The guard counts
// outcomes and throws once a whole batch has failed before any call has succeeded.
export class SweepGuard {
  ok = 0
  failed = 0

  record(results: PromiseSettledResult<unknown>[]): void {
    let firstError: unknown
    let batchFailed = 0
    for (const r of results) {
      if (r.status === 'fulfilled') this.ok++
      else { this.failed++; batchFailed++; firstError ??= r.reason }
    }
    if (this.ok === 0 && batchFailed > 0 && batchFailed === results.length) {
      const msg = firstError instanceof Error ? firstError.message : String(firstError)
      throw new Error(`Lineage requests are failing (${msg}). Check that the session token has not expired.`)
    }
  }
}
