import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useExpenseDialog } from '../components/ExpenseDialog'
import { ExpenseRow } from '../components/ExpenseRow'
import { MonthNav } from '../components/MonthNav'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui'
import { cn } from '../lib/cn'
import { formatLongDay, formatMoney, monthRange, todayISO } from '../lib/format'
import { useCards, useCategories, useExpenses } from '../lib/queries'
import type { Expense, ExpenseFilters } from '../lib/types'
import { useDebounced } from '../lib/useDebounced'

const PAGE_SIZE = 200

function groupByDay(items: Expense[]) {
  const groups = new Map<string, Expense[]>()
  for (const e of items) groups.set(e.date, [...(groups.get(e.date) ?? []), e])
  return [...groups.entries()]
}

export function ExpensesPage() {
  const [params, setParams] = useSearchParams()
  const month = params.get('mes') ?? todayISO().slice(0, 7)
  const cardId = params.get('tarjeta')
  const categoryId = params.get('categoria')
  const onlyImpulse = params.get('impulsivos') === '1'
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q)

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )

  const filters: ExpenseFilters = {
    ...(() => {
      const { from, to } = monthRange(month)
      return { date_from: from, date_to: to }
    })(),
    card_id: cardId ? Number(cardId) : undefined,
    category_id: categoryId && categoryId !== 'none' ? Number(categoryId) : undefined,
    uncategorized: categoryId === 'none' || undefined,
    is_impulse: onlyImpulse || undefined,
    q: debouncedQ.trim() || undefined,
    limit: PAGE_SIZE,
  }

  const expenses = useExpenses(filters)
  const cards = useCards()
  const categories = useCategories()
  const openExpense = useExpenseDialog()

  const cardById = useMemo(() => new Map(cards.data?.map((c) => [c.id, c])), [cards.data])
  const categoryById = useMemo(
    () => new Map(categories.data?.map((c) => [c.id, c])),
    [categories.data],
  )
  const groups = useMemo(() => groupByDay(expenses.data?.items ?? []), [expenses.data])
  const hasFilters = Boolean(cardId || categoryId || onlyImpulse || q)

  const chip = (active: boolean) =>
    cn(
      'h-9 shrink-0 rounded-full border px-3.5 text-sm transition-colors',
      active
        ? 'border-stone-900 bg-stone-900 text-stone-50'
        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300',
    )

  return (
    <>
      <PageHeader
        title="Gastos"
        actions={
          <Button onClick={() => openExpense()} className="hidden md:inline-flex">
            <Plus size={16} weight="bold" /> Nuevo gasto
            <kbd className="num ml-1 rounded bg-stone-700 px-1.5 text-[11px] text-stone-300">N</kbd>
          </Button>
        }
      />

      <section className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <MonthNav month={month} onChange={(m) => setParam('mes', m)} />
        <div className="md:text-right">
          <p className="text-[13px] text-stone-500">
            {expenses.data ? `${expenses.data.total} gastos` : ' '}
          </p>
          <p className="num text-3xl font-medium tracking-tight">
            {expenses.data ? formatMoney(expenses.data.sum_mxn) : '—'}
          </p>
        </div>
      </section>

      <section className="mb-6 grid gap-3">
        <div className="relative">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por descripción"
            aria-label="Buscar gastos"
            className="h-10 w-full rounded-xl border border-stone-200 bg-white pr-3 pl-9 text-sm focus:border-stone-400 focus:outline-none md:max-w-xs"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <button
            type="button"
            className={chip(onlyImpulse)}
            onClick={() => setParam('impulsivos', onlyImpulse ? null : '1')}
          >
            Impulsivos
          </button>
          <select
            aria-label="Filtrar por tarjeta"
            value={cardId ?? ''}
            onChange={(e) => setParam('tarjeta', e.target.value)}
            className={chip(Boolean(cardId))}
          >
            <option value="">Todas las tarjetas</option>
            {cards.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por categoría"
            value={categoryId ?? ''}
            onChange={(e) => setParam('categoria', e.target.value)}
            className={chip(Boolean(categoryId))}
          >
            <option value="">Todas las categorías</option>
            <option value="none">Sin categoría</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {hasFilters ? (
            <button
              type="button"
              className="h-9 shrink-0 px-2 text-sm text-stone-500 underline-offset-2 hover:underline"
              onClick={() => {
                setQ('')
                setParams(new URLSearchParams({ mes: month }), { replace: true })
              }}
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </section>

      {expenses.error ? (
        <ErrorState error={expenses.error} onRetry={() => expenses.refetch()} />
      ) : expenses.isPending ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Nada con esos filtros' : 'Sin gastos este mes'}
          description={
            hasFilters
              ? 'Probá quitando algún filtro o cambiando de mes.'
              : 'Anotá cada gasto en el momento: es la única forma de que el resumen no te sorprenda.'
          }
          action={
            hasFilters ? undefined : (
              <Button onClick={() => openExpense()}>
                <Plus size={16} weight="bold" /> Anotar gasto
              </Button>
            )
          }
        />
      ) : (
        <div
          className={cn(
            'grid gap-6 transition-opacity',
            expenses.isPlaceholderData && 'opacity-60',
          )}
        >
          {groups.map(([day, items]) => (
            <section key={day}>
              <header className="mb-1 flex items-baseline justify-between border-b border-stone-200 px-2 pb-2">
                <h3 className="text-sm font-medium text-stone-600 first-letter:uppercase">
                  {formatLongDay(day)}
                </h3>
                <span className="num text-sm text-stone-500">
                  {formatMoney(items.reduce((s, e) => s + e.amount_mxn, 0))}
                </span>
              </header>
              <ul>
                {items.map((e) => (
                  <ExpenseRow
                    key={e.id}
                    expense={e}
                    card={cardById.get(e.card_id)}
                    category={e.category_id ? categoryById.get(e.category_id) : undefined}
                    onClick={() => openExpense(e)}
                  />
                ))}
              </ul>
            </section>
          ))}
          {expenses.data && expenses.data.total > PAGE_SIZE ? (
            <p className="text-center text-sm text-stone-500">
              Mostrando {PAGE_SIZE} de {expenses.data.total}. Filtrá para ver el resto.
            </p>
          ) : null}
        </div>
      )}
    </>
  )
}
