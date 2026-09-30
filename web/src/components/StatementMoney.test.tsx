import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StatementDetail } from '../lib/types'
import { mockFetch, renderWithProviders } from '../test/render'
import { StatementMoney } from './StatementMoney'

const base: StatementDetail = {
  cycle: '2026-09',
  period_start: '2026-08-21',
  closing_date: '2026-09-20',
  due_date: '2026-10-10',
  card_id: 1,
  status: 'closed',
  total: 1500.5,
  paid: 600,
  remaining: 900.5,
  settled: false,
  bank_total: null,
  difference: null,
  payments: [{ id: 1, card_id: 1, cycle: '2026-09', date: '2026-09-30', amount: 600, note: null }],
  impulse_total: 0,
  previous_cycle: '2026-08',
  next_cycle: '2026-10',
  expenses: [],
}

afterEach(() => vi.restoreAllMocks())

describe('StatementMoney', () => {
  it('shows what is left to pay and offers paying the total', () => {
    mockFetch(() => [200, {}])
    renderWithProviders(<StatementMoney st={base} />)
    expect(screen.getByText(/Falta/)).toHaveTextContent('$900.50')
    expect(screen.getByRole('button', { name: /Pagué el total/ })).toHaveTextContent('$900.50')
  })

  it('explains a positive difference as missing expenses', () => {
    mockFetch(() => [200, {}])
    renderWithProviders(<StatementMoney st={{ ...base, bank_total: 1649.5, difference: 149 }} />)
    expect(screen.getByText(/más de lo que/)).toHaveTextContent('$149.00')
    expect(screen.getByText(/Te falta cargar algún gasto/)).toBeInTheDocument()
  })

  it('explains a negative difference as over-logging', () => {
    mockFetch(() => [200, {}])
    renderWithProviders(<StatementMoney st={{ ...base, bank_total: 1400.5, difference: -100 }} />)
    expect(screen.getByText(/más que el banco/)).toHaveTextContent('$100.00')
  })

  it('confirms when it matches and hides the payment form when settled', () => {
    mockFetch(() => [200, {}])
    renderWithProviders(
      <StatementMoney
        st={{
          ...base,
          paid: 1500.5,
          remaining: 0,
          settled: true,
          bank_total: 1500.5,
          difference: 0,
        }}
      />,
    )
    expect(screen.getByText('Cuadra al centavo.')).toBeInTheDocument()
    expect(screen.getByText('Pagado completo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Monto del pago')).not.toBeInTheDocument()
  })
})
