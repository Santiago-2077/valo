import {
  ArrowCircleDown,
  CloudSlash,
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
import { useOnline } from '../lib/useOnline'
import { cn } from '../lib/cn'
import { ExpenseDialogProvider, useExpenseDialog } from './ExpenseDialog'
import { Logo } from './Logo'
import { IconButton } from './ui'

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

// Mobile: sections that don't fit the 5-slot tab bar live in the header.
const HEADER_LINKS: NavItem[] = [
  { to: '/ingresos', label: 'Ingresos', icon: ArrowCircleDown },
  { to: '/fijos', label: 'Fijos', icon: Repeat },
  { to: '/categorias', label: 'Categorías', icon: Tag },
  { to: '/ajustes', label: 'Ajustes', icon: GearSix },
]

function Brand() {
  return (
    <Link to="/" aria-label="Valo, ir al resumen" className="flex items-center text-fg">
      <Logo className="h-6" />
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
            ? 'bg-surface font-medium text-fg shadow-[0_1px_2px_var(--shadow)] ring-1 ring-border'
            : 'text-muted hover:text-fg',
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
        cn('flex flex-col items-center gap-1 py-2.5 text-xs', isActive ? 'text-fg' : 'text-muted')
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
  const online = useOnline()

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-border px-4 py-6 md:flex">
        <div className="px-2">
          <Brand />
        </div>
        <button
          type="button"
          onClick={() => openExpense()}
          className="mt-8 flex h-10 items-center justify-between rounded-xl bg-primary px-3 text-sm font-medium text-on-primary transition-transform hover:bg-primary-hover active:scale-[0.98]"
        >
          <span className="flex items-center gap-2">
            <Plus size={16} weight="bold" /> Nuevo gasto
          </span>
          <kbd className="num rounded bg-on-primary/15 px-1.5 text-xs text-on-primary/80">N</kbd>
        </button>
        <nav className="mt-6 grid gap-1" aria-label="Principal">
          {NAV_ITEMS.map((item) => (
            <SideLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto grid gap-1 border-t border-border pt-4">
          <SideLink to="/ajustes" label="Ajustes" icon={GearSix} />
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="truncate text-sm text-muted">{user?.username}</span>
            <IconButton
              aria-label="Cerrar sesión"
              onClick={() => logout.mutate()}
              className="-mr-3"
            >
              <SignOut size={18} />
            </IconButton>
          </div>
        </div>
      </aside>

      <div className="flex min-h-[100dvh] min-w-0 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Brand />
          <div className="-mr-3 flex items-center">
            {HEADER_LINKS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className="grid size-11 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
              >
                <Icon size={20} />
              </Link>
            ))}
            <IconButton aria-label="Cerrar sesión" onClick={() => logout.mutate()}>
              <SignOut size={20} />
            </IconButton>
          </div>
        </header>
        {online ? null : (
          <div
            role="status"
            className="flex items-start gap-2 border-b border-border bg-warning-soft px-4 py-2.5 text-sm text-fg md:px-10"
          >
            <CloudSlash size={18} aria-hidden className="mt-px shrink-0 text-warning" />
            <span>
              <strong className="font-medium">Sin conexión.</strong> Lo que ves puede no estar al
              día y los cambios se guardan cuando vuelvas a tener red.
            </span>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-32 md:px-10 md:pt-12 md:pb-16">
          <Outlet />
        </main>
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-center border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <TabLink {...NAV_ITEMS[0]} />
          <TabLink {...NAV_ITEMS[1]} />
          <div className="grid place-items-center">
            <button
              type="button"
              onClick={() => openExpense()}
              aria-label="Nuevo gasto"
              className="grid size-12 place-items-center rounded-2xl bg-primary text-on-primary shadow-[0_8px_20px_-8px_var(--shadow)] transition-transform active:scale-95"
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
