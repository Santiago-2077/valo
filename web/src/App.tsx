import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/Toast'
import { CloudSlash } from '@phosphor-icons/react'
import { Button, Skeleton } from './components/ui'
import { useMe } from './lib/auth'
import { useOnline } from './lib/useOnline'

// Each page is its own chunk, downloaded the first time it's visited.
const page = (load: () => Promise<Record<string, React.ComponentType>>, name: string) => ({
  lazy: async () => ({ Component: (await load())[name] }),
})

function PageSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-12 md:px-10">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function Unreachable({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-6">
      <div className="max-w-sm text-center">
        <CloudSlash size={32} aria-hidden className="mx-auto text-muted" />
        <h1 className="mt-4 text-lg font-semibold">
          {offline ? 'Sin conexión' : 'No se pudo conectar con tu servidor'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {offline
            ? 'Valo necesita red para mostrarte tus números al día.'
            : 'Revisá que el homelab esté encendido y que estés conectado a Tailscale.'}
        </p>
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    </div>
  )
}

function RequireAuth() {
  const me = useMe()
  const online = useOnline()
  // Offline, React Query pauses the request forever: say so instead of spinning.
  if (me.fetchStatus === 'paused' || (me.isError && !me.data)) {
    return <Unreachable offline={!online} onRetry={() => void me.refetch()} />
  }
  if (me.isPending) return <PageSkeleton />
  return me.data ? <Outlet /> : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  {
    path: '/login',
    hydrateFallbackElement: <PageSkeleton />,
    ...page(() => import('./pages/LoginPage'), 'LoginPage'),
  },
  {
    element: <RequireAuth />,
    hydrateFallbackElement: <PageSkeleton />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, ...page(() => import('./pages/DashboardPage'), 'DashboardPage') },
          { path: 'gastos', ...page(() => import('./pages/ExpensesPage'), 'ExpensesPage') },
          { path: 'ingresos', ...page(() => import('./pages/IncomesPage'), 'IncomesPage') },
          { path: 'tarjetas', ...page(() => import('./pages/CardsPage'), 'CardsPage') },
          {
            path: 'tarjetas/:id',
            ...page(() => import('./pages/CardDetailPage'), 'CardDetailPage'),
          },
          { path: 'meses', ...page(() => import('./pages/InstallmentsPage'), 'InstallmentsPage') },
          { path: 'fijos', ...page(() => import('./pages/RecurringPage'), 'RecurringPage') },
          {
            path: 'categorias',
            ...page(() => import('./pages/CategoriesPage'), 'CategoriesPage'),
          },
          { path: 'ajustes', ...page(() => import('./pages/SettingsPage'), 'SettingsPage') },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  )
}
