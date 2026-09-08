import { clsx } from 'clsx'

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  const escape = (v: string | number) =>
    typeof v === 'number' ? String(v) : '"' + String(v).replace(/"/g, '""') + '"'
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function CoverageBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  const colorClass =
    pct < 30 ? 'bg-red-500' : pct < 70 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={clsx('h-full rounded-full', colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={clsx(
          'tabular-nums font-medium w-10 text-right text-xs',
          pct < 30
            ? 'text-red-500'
            : pct < 70
            ? 'text-amber-500'
            : 'text-green-600',
        )}
      >
        {pct}%
      </span>
    </div>
  )
}

export const TYPE_BADGE: Record<string, string> = {
  DB: 'badge-blue',
  ETL: 'bg-purple-100 text-purple-800 border-purple-200',
  REPORT: 'bg-orange-100 text-orange-800 border-orange-200',
}

export function FilterTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; count: number }>
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'px-3 py-1 rounded-md text-xs font-medium transition-colors',
            active === tab.id
              ? 'bg-primary text-white'
              : 'bg-muted/15 text-muted hover:text-foreground hover:bg-muted/30',
          )}
        >
          {tab.label}
          <span className={clsx('ml-1.5 tabular-nums', active === tab.id ? 'opacity-80' : '')}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  )
}
