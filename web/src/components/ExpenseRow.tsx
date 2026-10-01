import { Lightning, Repeat } from '@phosphor-icons/react'
import { formatDayMonth, formatMoney } from '../lib/format'
import type { Card, Category, Expense } from '../lib/types'
import { CategoryIcon } from './CategoryIcon'

type RowExpense = Pick<
  Expense,
  | 'id'
  | 'description'
  | 'amount_mxn'
  | 'category_id'
  | 'is_impulse'
  | 'installment'
  | 'recurring_id'
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
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-[background-color,scale] duration-150 ease-out hover:bg-surface-2 active:scale-[0.99]"
      >
        <CategoryIcon icon={category?.icon} color={category?.color} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] text-fg">
            <span className="truncate">{expense.description}</span>
            {expense.recurring_id ? (
              <Repeat size={13} className="shrink-0 text-muted" aria-label="Fijo" />
            ) : null}
            {expense.installment ? (
              <span className="num shrink-0 rounded-md bg-track px-1.5 py-px text-xs text-fg-2">
                {expense.installment.number}/{expense.installment.of}
              </span>
            ) : null}
          </p>
          <p className="flex items-center gap-1.5 truncate text-[13px] text-muted">
            {card ? (
              <>
                <span
                  className="size-2 shrink-0 rounded-full ring-1 ring-fg/15"
                  style={{ backgroundColor: card.color }}
                />
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
              className="grid size-6 place-items-center rounded-full bg-warning-soft text-warning"
            >
              <Lightning size={13} weight="fill" />
              <span className="sr-only">Impulsivo</span>
            </span>
          ) : null}
          <span className="num text-[15px] font-medium text-fg">
            {formatMoney(expense.amount_mxn)}
          </span>
        </div>
      </button>
    </li>
  )
}
