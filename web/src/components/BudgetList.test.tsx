import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Category } from '../lib/types'
import { BudgetList } from './BudgetList'

const cat = (id: number, name: string): Category => ({
  id,
  name,
  icon: 'tag',
  color: '#78716c',
  monthly_budget: null,
})

describe('BudgetList', () => {
  it('orders by usage and spells out each state', () => {
    render(
      <BudgetList
        categories={
          new Map([
            [1, cat(1, 'Comida')],
            [2, cat(2, 'Salidas')],
            [3, cat(3, 'Ropa')],
          ])
        }
        rows={[
          { category_id: 1, spent: 1500, budget: 2000, ratio: 0.75 },
          { category_id: 2, spent: 650, budget: 500, ratio: 1.3 },
          { category_id: 3, spent: 900, budget: 1000, ratio: 0.9 },
          { category_id: null, spent: 999, budget: null, ratio: null },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.textContent?.split('$')[0])).toEqual(['Salidas', 'Ropa', 'Comida'])
    expect(items[0]).toHaveTextContent('Te pasaste $150.00 (130%)')
    expect(items[1]).toHaveTextContent('Cerca del tope: quedan $100.00')
    expect(items[2]).toHaveTextContent('Quedan $500.00')
  })
})
