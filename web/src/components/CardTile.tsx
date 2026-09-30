import { Link } from 'react-router'
import { cn } from '../lib/cn'
import { dueLabel, formatDayMonth, formatMoney } from '../lib/format'
import type { Card } from '../lib/types'

export function CardTile({ card }: { card: Card }) {
  const st = card.current_statement
  const pending = card.pending_statement
  const usage = st && card.credit_limit ? Math.min(st.total / card.credit_limit, 1) : null

  return (
    <Link
      to={`/tarjetas/${card.id}`}
      className={cn(
        'group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-3xl p-5 text-stone-50 transition-transform duration-300 ease-out-soft hover:-translate-y-0.5 active:scale-[0.99]',
        !card.active && 'opacity-50 grayscale',
      )}
      style={{ backgroundColor: card.color }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgb(255_255_255/0.16),transparent_60%)]"
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="font-medium">{card.name}</p>
          <p className="text-[13px] text-white/60">
            {card.bank ?? (card.kind === 'cash' ? 'Efectivo' : 'Débito')}
          </p>
        </div>
        {card.last4 ? <span className="num text-sm text-white/70">•• {card.last4}</span> : null}
      </div>

      {st ? (
        <div className="relative mt-6">
          {pending && pending.total > 0 ? (
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[12px]">
              Por pagar {formatMoney(pending.total)} · {dueLabel(pending.due_date)}
            </p>
          ) : null}
          <p className="text-[12px] tracking-wide text-white/60 uppercase">Este corte</p>
          <p className="num text-[28px] leading-tight font-medium tracking-tight">
            {formatMoney(st.total)}
          </p>
          <p className="mt-1 text-[13px] text-white/70">
            Corta {formatDayMonth(st.closing_date)} · paga {formatDayMonth(st.due_date)}
          </p>
          {usage !== null ? (
            <div
              className="mt-3 h-1 overflow-hidden rounded-full bg-white/20"
              title="Uso del límite"
            >
              <div
                className={cn('h-full rounded-full', usage > 0.8 ? 'bg-amber-300' : 'bg-white/80')}
                style={{ width: `${Math.max(usage * 100, 2)}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="relative text-sm text-white/70">Sin corte · se descuenta al momento</p>
      )}
    </Link>
  )
}
