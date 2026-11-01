// A keyword scan costs one depth-10 lineage call per match. Measured on hmrc-poc at 10-wide
// concurrency: about 8 calls per second.
export const LARGE_SCAN_THRESHOLD = 200
export const SCAN_CALLS_PER_SECOND = 8

export function estimateLineageSeconds(calls: number): number {
  return Math.ceil(calls / SCAN_CALLS_PER_SECOND)
}

export function formatDuration(seconds: number): string {
  if (seconds < 90) return `${seconds}s`
  const min = Math.round(seconds / 60)
  return min < 60 ? `about ${min} min` : `about ${(min / 60).toFixed(1)} h`
}
