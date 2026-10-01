import { cn } from '../lib/cn'
import { formatMoney } from '../lib/format'
import type { Category, CategorySpend } from '../lib/types'
import { CategoryIcon } from './CategoryIcon'

/** Spending vs monthly budget. State is spelled out in text, never color alone. */
export function BudgetList({
  rows,
  categories,
  limit,
}: {
  rows: CategorySpend[]
  categories: Map<number, Category>
  limit?: number
}) {
  const budgeted = rows
    .filter((r) => r.budget && r.category_id !== null)
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    .slice(0, limit)

  if (budgeted.length === 0) return null

  return (
    <ul className="grid gap-4">
      {budgeted.map((r) => {
        const category = categories.get(r.category_id!)
        const ratio = r.ratio ?? 0
        const over = ratio > 1
        const near = !over && ratio >= 0.8
        const left = (r.budget ?? 0) - r.spent
        return (
          <li key={r.category_id} className="grid grid-cols-[auto_1fr] items-center gap-3">
            <CategoryIcon icon={category?.icon} color={category?.color} size="sm" />
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{category?.name ?? 'Categoría'}</span>
                <span className="num shrink-0 text-muted">
                  <span className="text-fg">{formatMoney(r.spent)}</span> /{' '}
                  {formatMoney(r.budget ?? 0)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-track">
                <div
                  className={cn(
                    'h-full rounded-full',
                    over ? 'bg-mark-negative' : near ? 'bg-mark-warning' : 'bg-chart-1',
                  )}
                  style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[12px] text-muted">
                {over
                  ? `Te pasaste ${formatMoney(-left)} (${Math.round(ratio * 100)}%)`
                  : near
                    ? `Cerca del tope: quedan ${formatMoney(left)}`
                    : `Quedan ${formatMoney(left)}`}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
