import { Plus } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { CategoryIcon } from '../components/CategoryIcon'
import { Dialog } from '../components/Dialog'
import { RecurringForm } from '../components/RecurringForm'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui'
import { cn } from '../lib/cn'
import { dueLabel, formatDayMonth, formatMoney } from '../lib/format'
import { useCards, useCategories, useRecurring } from '../lib/queries'
import { scheduleLabel } from '../lib/schedule'
import type { Recurring } from '../lib/types'

function Section({
  title,
  items,
  onOpen,
}: {
  title: string
  items: Recurring[]
  onOpen: (r: Recurring) => void
}) {
  const cards = useCards()
  const categories = useCategories()
  const cardById = useMemo(() => new Map(cards.data?.map((c) => [c.id, c])), [cards.data])
  const categoryById = useMemo(
    () => new Map(categories.data?.map((c) => [c.id, c])),
    [categories.data],
  )
  if (items.length === 0) return null
  const monthly = items.filter((r) => r.active).reduce((s, r) => s + r.monthly_cost, 0)

  return (
    <section className="mb-10">
      <header className="mb-2 flex items-baseline justify-between px-2">
        <h2 className="font-medium">{title}</h2>
        <span className="num text-sm text-muted">{formatMoney(monthly)}/mes</span>
      </header>
      <ul className="divide-y divide-border border-y border-border">
        {items.map((r) => {
          const card = cardById.get(r.card_id)
          const category = r.category_id ? categoryById.get(r.category_id) : undefined
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onOpen(r)}
                className={cn(
                  'grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-2 py-3.5 text-left transition-colors hover:bg-surface-2',
                  !r.active && 'opacity-50',
                )}
              >
                <CategoryIcon icon={category?.icon} color={category?.color} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px]">
                    <span className="truncate">{r.name}</span>
                    {!r.active ? (
                      <span className="rounded-md bg-track px-1.5 py-px text-xs text-fg-2">
                        Pausado
                      </span>
                    ) : null}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-[13px] text-muted">
                    {card ? (
                      <span
                        className="size-2 shrink-0 rounded-full ring-1 ring-fg/15"
                        style={{ backgroundColor: card.color }}
                      />
                    ) : null}
                    {card?.name} · {scheduleLabel(r)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-[15px] font-medium">
                    {r.amount_is_estimate ? '~' : ''}
                    {formatMoney(r.amount)}
                  </p>
                  <p className="text-[13px] whitespace-nowrap text-muted">
                    {r.active
                      ? `${formatDayMonth(r.next_run)} · ${dueLabel(r.next_run)}`
                      : 'sin cobros'}
                  </p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function RecurringPage() {
  const recurring = useRecurring()
  const [editing, setEditing] = useState<{ item?: Recurring } | null>(null)

  const items = recurring.data ?? []
  const active = items.filter((r) => r.active)
  const monthly = active.reduce((s, r) => s + r.monthly_cost, 0)
  const yearly = active.reduce((s, r) => s + r.yearly_cost, 0)
  const subscriptions = items.filter((r) => r.kind === 'subscription')
  const services = items.filter((r) => r.kind === 'service')
  const soon = active[0] // the API sorts active items by next charge date

  return (
    <>
      <PageHeader
        title="Fijos"
        description="Suscripciones y servicios que se anotan solos cada vez que se cobran."
        actions={
          <Button variant="secondary" onClick={() => setEditing({})}>
            <Plus size={16} weight="bold" /> Agregar
          </Button>
        }
      />

      {recurring.error ? (
        <ErrorState error={recurring.error} onRetry={() => recurring.refetch()} />
      ) : recurring.isPending ? (
        <div className="grid gap-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin suscripciones ni servicios"
          description="Agregá Netflix, Spotify, el gimnasio, la luz o el internet. Se cargan solos el día que te cobran, así no se te escapan del resumen."
          action={
            <Button onClick={() => setEditing({})}>
              <Plus size={16} weight="bold" /> Agregar el primero
            </Button>
          }
        />
      ) : (
        <>
          <section className="mb-12 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <p className="text-sm text-muted">Te cuestan al mes</p>
              <p className="num mt-1 text-5xl font-medium tracking-tight">{formatMoney(monthly)}</p>
              <p className="mt-2 text-sm text-muted">
                {active.length} activos · anuales prorrateados
              </p>
            </div>
            <div className="border-t border-border pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-8">
              <p className="text-sm text-muted">Al año</p>
              <p className="num mt-1 text-2xl font-medium">{formatMoney(yearly)}</p>
              <p className="mt-1 text-[13px] text-muted">Lo que suman en 12 meses</p>
            </div>
            <div className="border-t border-border pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-8">
              <p className="text-sm text-muted">Próximo cobro</p>
              {soon ? (
                <>
                  <p className="mt-1 text-2xl font-medium">{soon.name}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    <span className="num">{formatMoney(soon.amount)}</span> ·{' '}
                    {formatDayMonth(soon.next_run)} ({dueLabel(soon.next_run)})
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted">Nada programado</p>
              )}
            </div>
          </section>
          <Section
            title="Suscripciones"
            items={subscriptions}
            onOpen={(item) => setEditing({ item })}
          />
          <Section title="Servicios" items={services} onOpen={(item) => setEditing({ item })} />
        </>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.item ? `Editar ${editing.item.name}` : 'Nuevo fijo'}
      >
        {editing ? (
          <RecurringForm
            key={editing.item?.id ?? 'new'}
            item={editing.item}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
    </>
  )
}
