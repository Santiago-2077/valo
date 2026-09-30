import { Plus, Repeat } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Dialog } from '../components/Dialog'
import { useExpenseDialog } from '../components/ExpenseDialog'
import { MonthNav } from '../components/MonthNav'
import { RecurringIncomeForm } from '../components/RecurringIncomeForm'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui'
import { cn } from '../lib/cn'
import {
  dueLabel,
  formatDayMonth,
  formatLongDay,
  formatMoney,
  monthRange,
  todayISO,
} from '../lib/format'
import { INCOME_KIND_LABEL } from '../lib/incomeKinds'
import { useCards, useIncomes, useMonthInsights, useRecurringIncomes } from '../lib/queries'
import { scheduleLabel } from '../lib/schedule'
import type { RecurringIncome } from '../lib/types'

export function IncomesPage() {
  const [params, setParams] = useSearchParams()
  const month = params.get('mes') ?? todayISO().slice(0, 7)
  const range = monthRange(month)
  const incomes = useIncomes({ date_from: range.from, date_to: range.to })
  const insights = useMonthInsights(month)
  const sources = useRecurringIncomes()
  const cards = useCards()
  const openMovement = useExpenseDialog()
  const [editing, setEditing] = useState<{ item?: RecurringIncome } | null>(null)

  const cardById = useMemo(() => new Map(cards.data?.map((c) => [c.id, c])), [cards.data])
  const activeSources = sources.data?.filter((s) => s.active) ?? []
  const expectedMonthly = activeSources.reduce((s, r) => s + r.monthly_amount, 0)
  const balance = insights.data?.balance ?? 0

  return (
    <>
      <PageHeader
        title="Ingresos"
        description="Lo que entra, fijo o variable. Sin esto no sabés cuánto te sobra."
        actions={
          <Button variant="secondary" onClick={() => openMovement('income')}>
            <Plus size={16} weight="bold" /> Ingreso
          </Button>
        }
      />

      <section className="mb-10 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <MonthNav
          month={month}
          onChange={(m) => setParams(new URLSearchParams({ mes: m }), { replace: true })}
        />
        <div className="grid grid-cols-2 gap-8 md:text-right">
          <div>
            <p className="text-[13px] text-stone-500">Entró</p>
            <p className="num text-3xl font-medium tracking-tight">
              {incomes.data ? formatMoney(incomes.data.sum) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[13px] text-stone-500">{balance >= 0 ? 'Te sobra' : 'Te falta'}</p>
            <p
              className={cn(
                'num text-3xl font-medium tracking-tight',
                balance < 0 && 'text-red-700',
              )}
            >
              {insights.data ? formatMoney(Math.abs(balance)) : '—'}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <header className="mb-2 flex items-baseline justify-between px-2">
          <h2 className="font-medium">Fijos</h2>
          <button
            type="button"
            onClick={() => setEditing({})}
            className="text-sm text-stone-500 hover:text-stone-900"
          >
            + Agregar fijo
          </button>
        </header>
        {sources.isPending ? (
          <Skeleton className="h-16" />
        ) : activeSources.length === 0 && !sources.data?.length ? (
          <button
            type="button"
            onClick={() => setEditing({})}
            className="w-full rounded-2xl border border-dashed border-stone-300 px-4 py-5 text-left text-sm text-stone-600 hover:border-stone-400"
          >
            <span className="font-medium text-stone-800">¿Cobrás sueldo?</span> Agregalo como fijo
            (quincenal, mensual o anual) y se registra solo cada vez que te depositan.
          </button>
        ) : (
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {sources.data?.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ item: s })}
                  className={cn(
                    'grid w-full grid-cols-[1fr_auto] items-center gap-3 px-2 py-3.5 text-left hover:bg-stone-100',
                    !s.active && 'opacity-50',
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[15px]">{s.name}</p>
                    <p className="text-[13px] text-stone-500">
                      {INCOME_KIND_LABEL[s.kind]} · {scheduleLabel(s)}
                      {s.account_id ? ` · ${cardById.get(s.account_id)?.name ?? ''}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num text-[15px] font-medium">
                      {s.amount_is_estimate ? '~' : ''}
                      {formatMoney(s.amount)}
                    </p>
                    <p className="text-[13px] whitespace-nowrap text-stone-500">
                      {s.active
                        ? `${formatDayMonth(s.next_run)} · ${dueLabel(s.next_run)}`
                        : 'Pausado'}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {expectedMonthly > 0 ? (
          <p className="mt-2 px-2 text-[13px] text-stone-500">
            Esperás <span className="num">{formatMoney(expectedMonthly)}</span> al mes de ingresos
            fijos.
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 px-2 font-medium">Movimientos del mes</h2>
        {incomes.error ? (
          <ErrorState error={incomes.error} onRetry={() => incomes.refetch()} />
        ) : incomes.isPending ? (
          <Skeleton className="h-40" />
        ) : incomes.data.items.length === 0 ? (
          <EmptyState
            title="Sin ingresos este mes"
            description="Anotá lo que te entra para saber si lo que gastás te alcanza."
            action={
              <Button onClick={() => openMovement('income')}>
                <Plus size={16} weight="bold" /> Anotar ingreso
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {incomes.data.items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => openMovement(i)}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-2 py-3 text-left hover:bg-stone-100"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[15px]">
                      <span className="truncate">{i.description}</span>
                      {i.recurring_income_id ? (
                        <Repeat size={13} className="shrink-0 text-stone-400" aria-label="Fijo" />
                      ) : null}
                    </p>
                    <p className="text-[13px] text-stone-500 first-letter:uppercase">
                      {formatLongDay(i.date)} · {INCOME_KIND_LABEL[i.kind]}
                    </p>
                  </div>
                  <span className="num text-[15px] font-medium">+{formatMoney(i.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.item ? `Editar ${editing.item.name}` : 'Nuevo ingreso fijo'}
      >
        {editing ? (
          <RecurringIncomeForm
            key={editing.item?.id ?? 'new'}
            item={editing.item}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
    </>
  )
}
