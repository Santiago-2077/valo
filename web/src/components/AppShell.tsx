import { GearSix, SignOut, SquaresFour } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { NavLink, Outlet } from 'react-router'
import { useLogout, useMe } from '../lib/auth'
import { cn } from '../lib/cn'

type NavItem = { to: string; label: string; icon: Icon }

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Resumen', icon: SquaresFour },
  { to: '/ajustes', label: 'Ajustes', icon: GearSix },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
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
    </div>
  )
}

export function AppShell() {
  const { data: user } = useMe()
  const logout = useLogout()

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-stone-200/80 px-4 py-6 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-10 grid gap-1" aria-label="Principal">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
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
              <Icon size={18} weight="regular" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between border-t border-stone-200/80 px-2 pt-4">
          <span className="truncate text-sm text-stone-600">{user?.username}</span>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
            aria-label="Cerrar sesión"
          >
            <SignOut size={18} />
          </button>
        </div>
      </aside>

      <div className="flex min-h-[100dvh] flex-col">
        <header className="flex items-center justify-between border-b border-stone-200/80 px-4 py-3 md:hidden">
          <Logo />
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="rounded-lg p-2 text-stone-500"
            aria-label="Cerrar sesión"
          >
            <SignOut size={20} />
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:px-10 md:pt-12 md:pb-12">
          <Outlet />
        </main>
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-20 grid border-t border-stone-200/80 bg-stone-50/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
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
          ))}
        </nav>
      </div>
    </div>
  )
}
