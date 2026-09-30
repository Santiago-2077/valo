import { ArrowLeft, CaretLeft, CaretRight, PencilSimple } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { CardForm } from '../components/CardForm'
import { Dialog } from '../components/Dialog'
import { useExpenseDialog } from '../components/ExpenseDialog'
import { ExpenseRow } from '../components/ExpenseRow'
import { useToast } from '../components/Toast'
import { Button, EmptyState, ErrorState, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { cn } from '../lib/cn'
import {
  dueLabel,
  formatCycle,
  formatDayMonth,
  formatMoney,
  monthRange,
  todayISO,
} from '../lib/format'
import { useCards, useCategories, useDeleteCard, useExpenses, useStatement } from '../lib/queries'
import type { Card, Expense } from '../lib/types'

const STATUS = {
  open: { label: 'Abierto', className: 'bg-accent-100 text-accent-700' },
  closed: { label: 'Cerrado · por pagar', className: 'bg-amber-100 text-amber-800' },
  past_due_date: { label: 'Fecha de pago pasada', className: 'bg-stone-200 text-stone-600' },
} as const

function useCategoryMap() {
  const categories = useCategories()
  return useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data])
}

function CreditStatement({ card }: { card: Card }) {
  const [params, setParams] = useSearchParams()
  const cycle = params.get('corte') ?? undefined
  const statement = useStatement(card.id, cycle)
  const categoryById = useCategoryMap()
  const openExpense = useExpenseDialog()

  if (statement.error)
    return <ErrorState error={statement.error} onRetry={() => statement.refetch()} />
  if (statement.isPending) return <Skeleton className="h-64" />
  const st = statement.data
  const go = (c: string) => setParams({ corte: c }, { replace: true })

  return (
    <>
      <section className="mb-8 grid gap-6 border-y border-stone-200 py-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-1">
            <button
              type="button"
              aria-label="Corte anterior"
              onClick={() => go(st.previous_cycle)}
              className="-ml-2 rounded-lg p-1.5 text-stone-500 hover:bg-stone-200/60"
            >
              <CaretLeft size={16} />
            </button>
            <h2 className="font-medium first-letter:uppercase">Corte de {formatCycle(st.cycle)}</h2>
            <button
              type="button"
              aria-label="Corte siguiente"
              onClick={() => go(st.next_cycle)}
              className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-200/60"
            >
              <CaretRight size={16} />
            </button>
          </div>
          <p
            className={cn(
              'num text-4xl font-medium tracking-tight',
              statement.isPlaceholderData && 'opacity-50',
            )}
          >
            {formatMoney(st.total)}
          </p>
          <span
            className={cn(
              'mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
              STATUS[st.status].className,
            )}
          >
            {STATUS[st.status].label}
          </span>
        </div>
        <dl className="grid content-start gap-3 text-sm">
          <div>
            <dt className="text-stone-500">Periodo</dt>
            <dd className="num">
              {formatDayMonth(st.period_start)} – {formatDayMonth(st.closing_date)}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Pagar antes del</dt>
            <dd>
              <span className="num">{formatDayMonth(st.due_date)}</span>
              {st.status !== 'past_due_date' ? (
                <span className="text-stone-500"> · {dueLabel(st.due_date)}</span>
              ) : null}
            </dd>
          </div>
        </dl>
        <dl className="grid content-start gap-3 text-sm">
          <div>
            <dt className="text-stone-500">Impulsivo</dt>
            <dd className="num">
              {formatMoney(st.impulse_total)}
              {st.total > 0 ? (
                <span className="text-stone-500">
                  {' '}
                  · {Math.round((st.impulse_total / st.total) * 100)}%
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Movimientos</dt>
            <dd className="num">{st.expenses.length}</dd>
          </div>
        </dl>
      </section>

      {st.expenses.length === 0 ? (
        <EmptyState
          title="Sin gastos en este corte"
          description="Lo que cargues con esta tarjeta entre esas fechas aparece acá."
        />
      ) : (
        <ul className={cn(statement.isPlaceholderData && 'opacity-60')}>
          {st.expenses.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              showDate
              category={e.category_id ? categoryById.get(e.category_id) : undefined}
              onClick={async () => openExpense(await api.get<Expense>(`/expenses/${e.id}`))}
            />
          ))}
        </ul>
      )}
    </>
  )
}

function NonCreditActivity({ card }: { card: Card }) {
  const month = todayISO().slice(0, 7)
  const { from, to } = monthRange(month)
  const expenses = useExpenses({ card_id: card.id, date_from: from, date_to: to, limit: 200 })
  const categoryById = useCategoryMap()
  const openExpense = useExpenseDialog()

  if (expenses.error) return <ErrorState error={expenses.error} />
  if (expenses.isPending) return <Skeleton className="h-64" />
  return (
    <>
      <section className="mb-8 border-y border-stone-200 py-6">
        <h2 className="font-medium first-letter:uppercase">{formatCycle(month)}</h2>
        <p className="num mt-2 text-4xl font-medium tracking-tight">
          {formatMoney(expenses.data.sum_mxn)}
        </p>
      </section>
      {expenses.data.items.length === 0 ? (
        <EmptyState
          title="Sin gastos este mes"
          description="Todavía no cargaste nada con este medio."
        />
      ) : (
        <ul>
          {expenses.data.items.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              showDate
              category={e.category_id ? categoryById.get(e.category_id) : undefined}
              onClick={() => openExpense(e)}
            />
          ))}
        </ul>
      )}
    </>
  )
}

export function CardDetailPage() {
  const { id } = useParams()
  const cards = useCards()
  const navigate = useNavigate()
  const remove = useDeleteCard()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const card = cards.data?.find((c) => c.id === Number(id))

  if (cards.isPending) return <Skeleton className="h-64" />
  if (!card) {
    return (
      <EmptyState
        title="No existe esa tarjeta"
        description="Puede que la hayas borrado."
        action={
          <Link to="/tarjetas" className="text-sm font-medium underline">
            Volver a tarjetas
          </Link>
        }
      />
    )
  }

  return (
    <>
      <Link
        to="/tarjetas"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft size={14} /> Tarjetas
      </Link>
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-9 w-1.5 rounded-full" style={{ backgroundColor: card.color }} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{card.name}</h1>
            <p className="text-sm text-stone-500">
              {[card.bank, card.last4 && `•• ${card.last4}`].filter(Boolean).join(' · ') ||
                (card.kind === 'cash' ? 'Efectivo' : 'Débito')}
              {card.kind === 'credit'
                ? ` · corta el ${card.closing_day}, paga el ${card.due_day}`
                : ''}
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          <PencilSimple size={16} /> Editar
        </Button>
      </header>

      {card.kind === 'credit' ? <CreditStatement card={card} /> : <NonCreditActivity card={card} />}

      <div className="mt-12 border-t border-stone-200 pt-6">
        {remove.error ? <p className="mb-2 text-sm text-red-700">{remove.error.message}</p> : null}
        <button
          type="button"
          className="text-sm text-stone-500 hover:text-red-700"
          onClick={() => {
            if (window.confirm(`¿Eliminar ${card.name}?`)) {
              remove.mutate(card.id, {
                onSuccess: () => {
                  toast({ title: 'Tarjeta eliminada' })
                  navigate('/tarjetas')
                },
              })
            }
          }}
        >
          Eliminar tarjeta
        </button>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar tarjeta">
        <CardForm card={card} onDone={() => setEditing(false)} />
      </Dialog>
    </>
  )
}
