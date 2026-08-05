import { Lightbulb } from 'lucide-react'
import type { FathomInsights } from '../logic/types.ts'

type Props = { insights: FathomInsights }

export function InferredInsightsCard({ insights }: Props) {
  const { inferredInsights } = insights

  if (inferredInsights.length === 0) {
    return null
  }

  return (
    <div className="surface-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        Inferred Insights
      </h2>
      <ul className="space-y-2">
        {inferredInsights.map((insight, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
            {insight}
          </li>
        ))}
      </ul>
    </div>
  )
}
