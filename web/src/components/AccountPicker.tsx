import { cn } from '../lib/cn'
import { useCards } from '../lib/queries'

/** Debit accounts and cash, where money comes in. Null = not specified. */
export function AccountPicker({
  value,
  onChange,
  current,
}: {
  value: number | null
  onChange: (id: number | null) => void
  current?: number | null
}) {
  const cards = useCards()
  const accounts = (cards.data ?? []).filter(
    (c) => c.kind !== 'credit' && (c.active || c.id === current),
  )
  const chip = (active: boolean) =>
    cn(
      'flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm transition-colors',
      active
        ? 'border-stone-900 bg-stone-900 text-stone-50'
        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300',
    )
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-stone-700">Llega a</legend>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {accounts.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={value === c.id}
            onClick={() => onChange(c.id)}
            className={chip(value === c.id)}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={chip(value === null)}
        >
          Sin especificar
        </button>
      </div>
    </fieldset>
  )
}
