import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/Toast'
import { Skeleton } from './components/ui'
import { useMe } from './lib/auth'
import { CardDetailPage } from './pages/CardDetailPage'
import { CardsPage } from './pages/CardsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { DashboardPage } from './pages/DashboardPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { IncomesPage } from './pages/IncomesPage'
import { InstallmentsPage } from './pages/InstallmentsPage'
import { RecurringPage } from './pages/RecurringPage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'

function RequireAuth() {
  const { data: user, isPending } = useMe()
  if (isPending) {
    return (
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-12 md:px-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'gastos', element: <ExpensesPage /> },
          { path: 'ingresos', element: <IncomesPage /> },
          { path: 'tarjetas', element: <CardsPage /> },
          { path: 'tarjetas/:id', element: <CardDetailPage /> },
          { path: 'meses', element: <InstallmentsPage /> },
          { path: 'fijos', element: <RecurringPage /> },
          { path: 'categorias', element: <CategoriesPage /> },
          { path: 'ajustes', element: <SettingsPage /> },
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
