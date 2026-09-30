import { ArrowRight, Plus } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { useExpenseDialog } from '../components/ExpenseDialog'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui'
import { cn } from '../lib/cn'
import {
  dueLabel,
  formatCycle,
  formatDayMonth,
  formatMoney,
  monthRange,
  todayISO,
} from '../lib/format'
import { useCards, useExpenses } from '../lib/queries'
import type { Card, StatementRef } from '../lib/types'

type Payment = { card: Card; statement: StatementRef & { total: number }; closed: boolean }

function upcomingPayments(cards: Card[]): Payment[] {
  const payments: Payment[] = []
  for (const card of cards) {
    if (!card.active) continue
    if (card.pending_statement && card.pending_statement.total > 0) {
      payments.push({ card, statement: card.pending_statement, closed: true })
    }
    if (card.current_statement) {
      payments.push({ card, statement: card.current_statement, closed: false })
    }
  }
  return payments.sort((a, b) => a.statement.due_date.localeCompare(b.statement.due_date))
}

export function DashboardPage() {
  const cards = useCards()
  const month = todayISO().slice(0, 7)
  const { from, to } = monthRange(month)
  const monthExpenses = useExpenses({ date_from: from, date_to: to, limit: 1 })
  const impulse = useExpenses({ date_from: from, date_to: to, is_impulse: true, limit: 1 })
  const openExpense = useExpenseDialog()

  if (cards.error) return <ErrorState error={cards.error} onRetry={() => cards.refetch()} />
  if (cards.isPending) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (cards.data.length === 0) {
    return (
      <>
        <PageHeader title="Resumen" />
        <EmptyState
          title="Empezá por tus tarjetas"
          description="Cargá cada tarjeta con su día de corte y de pago. Desde ahí, cada gasto cae solo en el resumen correcto."
          action={
            <Link to="/tarjetas">
              <Button>
                Agregar tarjetas <ArrowRight size={16} />
              </Button>
            </Link>
          }
        />
      </>
    )
  }

  const payments = upcomingPayments(cards.data)
  const toPayNow = payments.filter((p) => p.closed).reduce((s, p) => s + p.statement.total, 0)
  const accumulating = payments.filter((p) => !p.closed).reduce((s, p) => s + p.statement.total, 0)
  const monthTotal = monthExpenses.data?.sum_mxn ?? 0
  const impulseTotal = impulse.data?.sum_mxn ?? 0

  return (
    <>
      <PageHeader title="Resumen" description={`Así vas en ${formatCycle(month)}.`} />

      <section className="mb-12 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-sm text-stone-500">Por pagar ahora</p>
          <p className="num mt-1 text-5xl font-medium tracking-tight">{formatMoney(toPayNow)}</p>
          <p className="mt-2 text-sm text-stone-500">
            Cortes cerrados · {formatMoney(accumulating)} acumulando en los abiertos
          </p>
        </div>
        <div className="border-t border-stone-200 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-8">
          <p className="text-sm text-stone-500">Gastado este mes</p>
          <p className="num mt-1 text-2xl font-medium">{formatMoney(monthTotal)}</p>
          <p className="mt-1 text-[13px] text-stone-500">
            {monthExpenses.data?.total ?? 0} movimientos, todos los medios
          </p>
        </div>
        <div className="border-t border-stone-200 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-8">
          <p className="text-sm text-stone-500">Impulsivo este mes</p>
          <p className="num mt-1 text-2xl font-medium text-amber-700">
            {formatMoney(impulseTotal)}
          </p>
          <p className="mt-1 text-[13px] text-stone-500">
            {monthTotal > 0
              ? `${Math.round((impulseTotal / monthTotal) * 100)}% de lo gastado`
              : 'Nada todavía'}
          </p>
        </div>
      </section>

      <section>
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium">Próximos pagos</h2>
          <Link to="/tarjetas" className="text-sm text-stone-500 hover:text-stone-900">
            Ver tarjetas
          </Link>
        </header>
        {payments.length === 0 ? (
          <p className="text-sm text-stone-500">No tenés tarjetas de crédito activas.</p>
        ) : (
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {payments.map(({ card, statement: st, closed }) => (
              <li key={`${card.id}-${st.cycle}`}>
                <Link
                  to={`/tarjetas/${card.id}?corte=${st.cycle}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-2 py-3.5 transition-colors hover:bg-stone-100"
                >
                  <span
                    className="h-8 w-1.5 rounded-full"
                    style={{ backgroundColor: card.color }}
                  />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-[15px]">
                      {card.name}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          closed ? 'bg-amber-100 text-amber-800' : 'bg-stone-200/70 text-stone-600',
                        )}
                      >
                        {closed ? 'Por pagar' : 'Acumulando'}
                      </span>
                    </p>
                    <p className="text-[13px] text-stone-500">
                      {closed
                        ? `Cortó ${formatDayMonth(st.closing_date)}`
                        : `Corta ${formatDayMonth(st.closing_date)}`}{' '}
                      · paga {formatDayMonth(st.due_date)} ({dueLabel(st.due_date)})
                    </p>
                  </div>
                  <span className="num text-[15px] font-medium">{formatMoney(st.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 md:hidden">
        <Button variant="secondary" className="w-full" onClick={() => openExpense()}>
          <Plus size={16} weight="bold" /> Anotar gasto
        </Button>
      </div>
    </>
  )
}
