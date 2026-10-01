import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { formatCycle, shiftMonth } from '../lib/format'
import { useStepAnimation } from '../lib/useStepAnimation'
import { IconButton } from './ui'

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const animation = useStepAnimation(month)
  return (
    <div className="-ml-3 flex items-center">
      <IconButton aria-label="Mes anterior" onClick={() => onChange(shiftMonth(month, -1))}>
        <CaretLeft size={18} />
      </IconButton>
      <h2
        key={month}
        style={{ animation }}
        className="min-w-[10ch] text-center text-lg font-medium first-letter:uppercase"
      >
        {formatCycle(month)}
      </h2>
      <IconButton aria-label="Mes siguiente" onClick={() => onChange(shiftMonth(month, 1))}>
        <CaretRight size={18} />
      </IconButton>
    </div>
  )
}
