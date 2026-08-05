import { PlatformChrome } from './components/PlatformChrome.tsx'
import { LoginPanel } from './components/LoginPanel.tsx'
import { DashboardLayout } from './components/DashboardLayout.tsx'
import { useInsightsStore } from './stores/useInsightsStore.ts'
import { useSessionStore } from './stores/useSessionStore.ts'

export default function App() {
  const { insights, clearInsights } = useInsightsStore()
  const { clearSession } = useSessionStore()

  function handleReset() {
    clearInsights()
    clearSession()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 pt-4 pb-2">
        <PlatformChrome />
        <div className="mt-3 flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Fathom</h1>
          <span className="text-sm text-muted">CDL Tenant Insights</span>
        </div>
      </header>

      <main className="px-6 pb-10">
        {!insights ? (
          <div className="max-w-lg mt-8">
            <LoginPanel />
          </div>
        ) : (
          <DashboardLayout insights={insights} onReset={handleReset} />
        )}
      </main>
    </div>
  )
}
