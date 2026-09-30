import { Plus } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { CommitmentChart } from '../components/CommitmentChart'
import { useExpenseDialog } from '../components/ExpenseDialog'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui'
import { cn } from '../lib/cn'
import { dueLabel, formatCycle, formatDayMonth, formatMoney } from '../lib/format'
import { useCards, useCommitments, usePlans } from '../lib/queries'
import type { Card, Plan } from '../lib/types'

function PlanRow({ plan, card, onClick }: { plan: Plan; card?: Card; onClick: () => void }) {
  const progress = plan.paid_count / plan.n_months
  const next = plan.next_charge
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="grid w-full gap-3 px-2 py-4 text-left transition-colors hover:bg-stone-100 md:grid-cols-[1fr_15rem_12.5rem] md:items-center md:gap-8"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[15px]">
            <span className="truncate">{plan.description}</span>
            {!plan.interest_free ? (
              <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-px text-[11px] text-amber-800">
                con intereses
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-stone-500">
            {card ? (
              <span className="size-2 rounded-full" style={{ backgroundColor: card.color }} />
            ) : null}
            {card?.name} · compraste {formatMoney(plan.total)} el{' '}
            {formatDayMonth(plan.purchase_date)}
          </p>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between gap-3 text-[13px] whitespace-nowrap">
            <span className="text-stone-500">
              <span className="num text-stone-900">{plan.paid_count}</span> de{' '}
              <span className="num">{plan.n_months}</span> pagadas
            </span>
            <span className="num text-stone-600">{formatMoney(plan.monthly_amount)}/mes</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-stone-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={plan.n_months}
            aria-valuenow={plan.paid_count}
            aria-label="Cuotas pagadas"
          >
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
        <div className="md:text-right">
          <p className="text-[15px]">
            <span className="num font-medium">{formatMoney(plan.remaining_amount)}</span>{' '}
            <span className="text-[12px] text-stone-400">restante</span>
          </p>
          <p className="text-[13px] whitespace-nowrap text-stone-500">
            {next
              ? `Próxima: ${formatDayMonth(next.due_date)} · ${dueLabel(next.due_date)}`
              : 'Terminada'}
          </p>
        </div>
      </button>
    </li>
  )
}

export function InstallmentsPage() {
  const [showFinished, setShowFinished] = useState(false)
  const plans = usePlans(showFinished)
  const commitments = useCommitments(7)
  const cards = useCards()
  const openExpense = useExpenseDialog()
  const cardById = useMemo(() => new Map(cards.data?.map((c) => [c.id, c])), [cards.data])

  const active = plans.data?.filter((p) => p.next_charge) ?? []
  const remaining = active.reduce((s, p) => s + p.remaining_amount, 0)
  // This month's installments may all be paid already; then start the chart next month.
  const months = commitments.data
    ? (commitments.data[0]?.total ? commitments.data : commitments.data.slice(1)).slice(0, 6)
    : undefined
  const nextPayment = months?.find((m) => m.total > 0)

  return (
    <>
      <PageHeader
        title="Compras a meses"
        description="Lo que ya compraste y todavía estás pagando."
        actions={
          <Button variant="secondary" onClick={() => openExpense()}>
            <Plus size={16} weight="bold" /> Nueva compra
          </Button>
        }
      />

      {plans.error ? (
        <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
      ) : plans.isPending ? (
        <div className="grid gap-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
        </div>
      ) : plans.data.length === 0 && !showFinished ? (
        <EmptyState
          title="No tenés compras a meses activas"
          description="Al cargar un gasto con tarjeta de crédito, activá “Compra a meses” y Valo reparte las cuotas en cada corte."
          action={
            <Button onClick={() => openExpense()}>
              <Plus size={16} weight="bold" /> Cargar compra
            </Button>
          }
        />
      ) : (
        <>
          <section className="mb-12 grid gap-10 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-sm text-stone-500">Te falta pagar</p>
              <p className="num mt-1 text-5xl font-medium tracking-tight">
                {formatMoney(remaining)}
              </p>
              <p className="mt-2 text-sm text-stone-500">
                {active.length} {active.length === 1 ? 'compra activa' : 'compras activas'}
                {nextPayment ? (
                  <>
                    {' '}
                    · <span className="num">{formatMoney(nextPayment.total)}</span> en{' '}
                    {formatCycle(nextPayment.month).split(' ')[0]}
                  </>
                ) : null}
              </p>
            </div>
            <div>
              <h2 className="mb-4 text-sm text-stone-500">Cuotas por mes de pago</h2>
              {months ? <CommitmentChart data={months} /> : <Skeleton className="h-48" />}
            </div>
          </section>

          <section>
            <header className="mb-2 flex items-center justify-between">
              <h2 className="font-medium">Compras</h2>
              <button
                type="button"
                onClick={() => setShowFinished((v) => !v)}
                className="text-sm text-stone-500 hover:text-stone-900"
              >
                {showFinished ? 'Ocultar terminadas' : 'Mostrar terminadas'}
              </button>
            </header>
            <ul
              className={cn(
                'divide-y divide-stone-200 border-y border-stone-200',
                plans.isFetching && 'opacity-70',
              )}
            >
              {plans.data.map((p) => (
                <PlanRow
                  key={p.id}
                  plan={p}
                  card={cardById.get(p.card_id)}
                  onClick={() => openExpense(p)}
                />
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}
