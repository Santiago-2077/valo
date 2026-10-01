import { ArrowRight, Plus } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { BudgetList } from '../components/BudgetList'
import { useExpenseDialog } from '../components/ExpenseDialog'
import { Button, CardSwatch, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui'
import { cn } from '../lib/cn'
import { dueLabel, formatCycle, formatDayMonth, formatMoney, todayISO } from '../lib/format'
import { useCards, useCategories, useMonthInsights } from '../lib/queries'
import type { Card, StatementTotals } from '../lib/types'

type Payment = { card: Card; statement: StatementTotals; closed: boolean }

function upcomingPayments(cards: Card[]): Payment[] {
  const payments: Payment[] = []
  for (const card of cards) {
    if (!card.active) continue
    if (card.pending_statement && card.pending_statement.remaining > 0) {
      payments.push({ card, statement: card.pending_statement, closed: true })
    }
    if (card.current_statement) {
      payments.push({ card, statement: card.current_statement, closed: false })
    }
  }
  return payments.sort((a, b) => a.statement.due_date.localeCompare(b.statement.due_date))
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'bad'
}) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className={cn('num mt-1 text-2xl font-medium', tone === 'bad' && 'text-negative')}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[13px] text-muted">{hint}</p> : null}
    </div>
  )
}

export function DashboardPage() {
  const cards = useCards()
  const categories = useCategories()
  const month = todayISO().slice(0, 7)
  const insights = useMonthInsights(month)
  const openMovement = useExpenseDialog()
  const categoryById = useMemo(
    () => new Map(categories.data?.map((c) => [c.id, c])),
    [categories.data],
  )

  if (cards.error) return <ErrorState error={cards.error} onRetry={() => cards.refetch()} />
  if (cards.isPending || insights.isPending) {
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

  const m = insights.data
  const payments = upcomingPayments(cards.data)
  const toPayNow = payments.filter((p) => p.closed).reduce((s, p) => s + p.statement.remaining, 0)
  const nextDue = payments.find((p) => p.closed)
  const accumulating = payments.filter((p) => !p.closed).reduce((s, p) => s + p.statement.total, 0)
  const change =
    m && m.previous_expenses > 0 ? (m.expenses - m.previous_expenses) / m.previous_expenses : null
  const hasBudgets = Boolean(m?.categories.some((c) => c.budget))

  return (
    <>
      <PageHeader title="Resumen" description={`Así vas en ${formatCycle(month)}.`} />

      <section className="mb-12 grid gap-10 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-sm text-muted">
            {m && m.balance < 0 ? 'Gastaste más de lo que entró' : 'Te sobra este mes'}
          </p>
          <p
            className={cn(
              'num mt-1 text-5xl font-medium tracking-tight',
              m && m.balance < 0 && 'text-negative',
            )}
          >
            {formatMoney(Math.abs(m?.balance ?? 0))}
          </p>
          <p className="mt-2 text-sm text-muted">
            Entró <span className="num text-fg">{formatMoney(m?.income ?? 0)}</span> · salió{' '}
            <span className="num text-fg">{formatMoney(m?.expenses ?? 0)}</span>
          </p>
          {m && m.income === 0 ? (
            <Link
              to="/ingresos"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-fg underline-offset-2 hover:underline"
            >
              Cargá tus ingresos para ver cuánto te sobra <ArrowRight size={14} />
            </Link>
          ) : null}
        </div>
        <div className="border-t border-border pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-10">
          <p className="text-sm text-muted">Por pagar ahora</p>
          <p className="num mt-1 text-4xl font-medium tracking-tight">{formatMoney(toPayNow)}</p>
          <p className="mt-2 text-sm text-muted">
            {nextDue
              ? `${nextDue.card.name} vence ${formatDayMonth(nextDue.statement.due_date)} (${dueLabel(nextDue.statement.due_date)})`
              : 'Nada vencido pendiente'}
            {' · '}
            <span className="num">{formatMoney(accumulating)}</span> acumulando
          </p>
        </div>
      </section>

      <section className="mb-12 grid grid-cols-2 gap-x-6 gap-y-8 border-y border-border py-8 md:grid-cols-4">
        <Stat
          label="Impulsivo"
          value={formatMoney(m?.impulse ?? 0)}
          hint={
            m && m.expenses > 0
              ? `${Math.round((m.impulse / m.expenses) * 100)}% de lo gastado`
              : 'Nada todavía'
          }
          tone={m && m.expenses > 0 && m.impulse / m.expenses > 0.25 ? 'bad' : undefined}
        />
        <Stat
          label="Fijos"
          value={formatMoney(m?.fixed_monthly_cost ?? 0)}
          hint="Suscripciones y servicios al mes"
        />
        <Stat
          label="Cuotas este mes"
          value={formatMoney(m?.installments ?? 0)}
          hint="Compras a meses"
        />
        <Stat
          label="Vs. mes pasado"
          value={
            change === null ? 'Sin datos' : `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`
          }
          hint={m ? `Mes pasado: ${formatMoney(m.previous_expenses)}` : undefined}
        />
      </section>

      <div className="grid gap-12 md:grid-cols-[1fr_1.2fr]">
        <section>
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="font-medium">Presupuestos</h2>
            <Link to="/categorias" className="text-sm text-muted hover:text-fg">
              {hasBudgets ? 'Ver todos' : 'Definir topes'}
            </Link>
          </header>
          {hasBudgets && m ? (
            <BudgetList rows={m.categories} categories={categoryById} limit={5} />
          ) : (
            <p className="text-sm text-muted">
              Ponele un tope mensual a las categorías donde más se te va (comida, salidas) y acá ves
              cuánto te queda.
            </p>
          )}
        </section>

        <section>
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="font-medium">Próximos pagos</h2>
            <Link to="/tarjetas" className="text-sm text-muted hover:text-fg">
              Ver tarjetas
            </Link>
          </header>
          {payments.length === 0 ? (
            <p className="text-sm text-muted">No tenés tarjetas de crédito activas.</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {payments.map(({ card, statement: st, closed }) => (
                <li key={`${card.id}-${st.cycle}`}>
                  <Link
                    to={`/tarjetas/${card.id}?corte=${st.cycle}`}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-2 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <CardSwatch color={card.color} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-[15px]">
                        {card.name}
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            closed ? 'bg-warning-soft text-warning' : 'bg-track text-fg-2',
                          )}
                        >
                          {closed ? 'Por pagar' : 'Acumulando'}
                        </span>
                      </p>
                      <p className="text-[13px] text-muted">
                        Paga {formatDayMonth(st.due_date)} ({dueLabel(st.due_date)})
                        {closed && st.paid > 0 ? ` · pagaste ${formatMoney(st.paid)}` : ''}
                      </p>
                    </div>
                    <span className="num text-[15px] font-medium">
                      {formatMoney(closed ? st.remaining : st.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-10 md:hidden">
        <Button variant="secondary" className="w-full" onClick={() => openMovement()}>
          <Plus size={16} weight="bold" /> Anotar movimiento
        </Button>
      </div>
    </>
  )
}
