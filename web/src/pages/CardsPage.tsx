import { Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { CardForm } from '../components/CardForm'
import { CardTile } from '../components/CardTile'
import { Dialog } from '../components/Dialog'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui'
import { useCards } from '../lib/queries'

export function CardsPage() {
  const cards = useCards()
  const [creating, setCreating] = useState(false)

  const active = cards.data?.filter((c) => c.active) ?? []
  const inactive = cards.data?.filter((c) => !c.active) ?? []

  return (
    <>
      <PageHeader
        title="Tarjetas"
        description="Cada corte, cuánto llevás y cuándo pagarlo."
        actions={
          <Button onClick={() => setCreating(true)} variant="secondary">
            <Plus size={16} weight="bold" /> Agregar
          </Button>
        }
      />

      {cards.error ? (
        <ErrorState error={cards.error} onRetry={() => cards.refetch()} />
      ) : cards.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : cards.data.length === 0 ? (
        <EmptyState
          title="Agregá tu primera tarjeta"
          description="Con el día de corte y el de pago, Valo te dice en qué resumen cae cada gasto. Sumá también efectivo o débito."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} weight="bold" /> Agregar tarjeta
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((c) => (
              <CardTile key={c.id} card={c} />
            ))}
          </div>
          {inactive.length ? (
            <section className="mt-10">
              <h2 className="mb-3 text-sm font-medium text-stone-500">Inactivas</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {inactive.map((c) => (
                  <CardTile key={c.id} card={c} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} title="Nueva tarjeta">
        <CardForm onDone={() => setCreating(false)} />
      </Dialog>
    </>
  )
}
