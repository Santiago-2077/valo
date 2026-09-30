import {
  ArrowCircleDown,
  CalendarDots,
  CreditCard,
  GearSix,
  Plus,
  Receipt,
  Repeat,
  SignOut,
  SquaresFour,
  Tag,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Link, NavLink, Outlet } from 'react-router'
import { useLogout, useMe } from '../lib/auth'
import { cn } from '../lib/cn'
import { ExpenseDialogProvider, useExpenseDialog } from './ExpenseDialog'

type NavItem = { to: string; label: string; icon: Icon }

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Resumen', icon: SquaresFour },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/ingresos', label: 'Ingresos', icon: ArrowCircleDown },
  { to: '/tarjetas', label: 'Tarjetas', icon: CreditCard },
  { to: '/meses', label: 'Meses', icon: CalendarDots },
  { to: '/fijos', label: 'Fijos', icon: Repeat },
  { to: '/categorias', label: 'Categorías', icon: Tag },
]

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#1c1917" />
        <path
          d="M9 10l7 13 7-13"
          fill="none"
          stroke="#6ee7b7"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">valo</span>
    </Link>
  )
}

function SideLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
          isActive
            ? 'bg-white font-medium text-stone-900 shadow-[0_1px_2px_rgb(28_25_23/0.06)] ring-1 ring-stone-200/80'
            : 'text-stone-500 hover:text-stone-900',
        )
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  )
}

function TabLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 py-2.5 text-[11px]',
          isActive ? 'text-stone-900' : 'text-stone-400',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
          {label}
        </>
      )}
    </NavLink>
  )
}

function Shell() {
  const { data: user } = useMe()
  const logout = useLogout()
  const openExpense = useExpenseDialog()

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-stone-200/80 px-4 py-6 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <button
          type="button"
          onClick={() => openExpense()}
          className="mt-8 flex h-10 items-center justify-between rounded-xl bg-stone-900 px-3 text-sm font-medium text-stone-50 transition-transform hover:bg-stone-800 active:scale-[0.98]"
        >
          <span className="flex items-center gap-2">
            <Plus size={16} weight="bold" /> Nuevo gasto
          </span>
          <kbd className="num rounded bg-stone-700 px-1.5 text-[11px] text-stone-300">N</kbd>
        </button>
        <nav className="mt-6 grid gap-1" aria-label="Principal">
          {NAV_ITEMS.map((item) => (
            <SideLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto grid gap-1 border-t border-stone-200/80 pt-4">
          <SideLink to="/ajustes" label="Ajustes" icon={GearSix} />
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="truncate text-sm text-stone-500">{user?.username}</span>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
              aria-label="Cerrar sesión"
            >
              <SignOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-[100dvh] min-w-0 flex-col">
        <header className="flex items-center justify-between border-b border-stone-200/80 px-4 py-3 md:hidden">
          <Logo />
          <div className="flex items-center">
            <Link
              to="/categorias"
              className="rounded-lg p-2 text-stone-500"
              aria-label="Categorías"
            >
              <Tag size={20} />
            </Link>
            <Link to="/ajustes" className="rounded-lg p-2 text-stone-500" aria-label="Ajustes">
              <GearSix size={20} />
            </Link>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="rounded-lg p-2 text-stone-500"
              aria-label="Cerrar sesión"
            >
              <SignOut size={20} />
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-32 md:px-10 md:pt-12 md:pb-16">
          <Outlet />
        </main>
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-center border-t border-stone-200/80 bg-stone-50/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <TabLink {...NAV_ITEMS[0]} />
          <TabLink {...NAV_ITEMS[1]} />
          <div className="grid place-items-center">
            <button
              type="button"
              onClick={() => openExpense()}
              aria-label="Nuevo gasto"
              className="grid size-12 place-items-center rounded-2xl bg-stone-900 text-stone-50 shadow-[0_8px_20px_-8px_rgb(28_25_23/0.6)] transition-transform active:scale-95"
            >
              <Plus size={22} weight="bold" />
            </button>
          </div>
          <TabLink {...NAV_ITEMS[3]} />
          <TabLink {...NAV_ITEMS[4]} />
        </nav>
      </div>
    </div>
  )
}

export function AppShell() {
  return (
    <ExpenseDialogProvider>
      <Shell />
    </ExpenseDialogProvider>
  )
}
