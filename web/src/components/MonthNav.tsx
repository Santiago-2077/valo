import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { formatCycle, shiftMonth } from '../lib/format'

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="rounded-lg p-2 text-stone-500 hover:bg-stone-200/60 hover:text-stone-900"
      >
        <CaretLeft size={18} />
      </button>
      <h2 className="min-w-[10ch] text-center text-lg font-medium first-letter:uppercase">
        {formatCycle(month)}
      </h2>
      <button
        type="button"
        aria-label="Mes siguiente"
        onClick={() => onChange(shiftMonth(month, 1))}
        className="rounded-lg p-2 text-stone-500 hover:bg-stone-200/60 hover:text-stone-900"
      >
        <CaretRight size={18} />
      </button>
    </div>
  )
}
