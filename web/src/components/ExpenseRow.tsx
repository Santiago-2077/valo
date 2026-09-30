import { Lightning } from '@phosphor-icons/react'
import { formatDayMonth, formatMoney } from '../lib/format'
import type { Card, Category, Expense } from '../lib/types'
import { CategoryIcon } from './CategoryIcon'

type RowExpense = Pick<
  Expense,
  'id' | 'description' | 'amount_mxn' | 'category_id' | 'is_impulse'
> &
  Partial<Pick<Expense, 'card_id' | 'date'>>

export function ExpenseRow({
  expense,
  category,
  card,
  showDate,
  onClick,
}: {
  expense: RowExpense
  category?: Category
  card?: Card
  showDate?: boolean
  onClick?: () => void
}) {
  const meta = [
    showDate && expense.date ? formatDayMonth(expense.date) : null,
    category?.name ?? 'Sin categoría',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-stone-100 active:scale-[0.995]"
      >
        <CategoryIcon icon={category?.icon} color={category?.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-stone-900">{expense.description}</p>
          <p className="flex items-center gap-1.5 truncate text-[13px] text-stone-500">
            {card ? (
              <>
                <span className="size-2 rounded-full" style={{ backgroundColor: card.color }} />
                {card.name} ·
              </>
            ) : null}
            <span>{meta}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expense.is_impulse ? (
            <span
              title="Impulsivo"
              className="grid size-6 place-items-center rounded-full bg-amber-100 text-amber-700"
            >
              <Lightning size={13} weight="fill" />
              <span className="sr-only">Impulsivo</span>
            </span>
          ) : null}
          <span className="num text-[15px] font-medium text-stone-900">
            {formatMoney(expense.amount_mxn)}
          </span>
        </div>
      </button>
    </li>
  )
}
