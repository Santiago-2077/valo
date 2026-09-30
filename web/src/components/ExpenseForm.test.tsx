import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders } from '../test/render'
import type { Card, Category } from '../lib/types'
import { ExpenseForm } from './ExpenseForm'

const card = (over: Partial<Card>): Card => ({
  id: 1,
  name: 'Oro',
  bank: 'BBVA',
  last4: '4821',
  kind: 'credit',
  closing_day: 20,
  due_day: 10,
  credit_limit: null,
  color: '#1c1917',
  active: true,
  current_statement: null,
  pending_statement: null,
  ...over,
})

const CARDS = [
  card({}),
  card({ id: 2, name: 'Nu', last4: '0193' }),
  card({ id: 3, name: 'Vieja', active: false }),
  card({ id: 4, name: 'Efectivo', kind: 'cash', last4: null, closing_day: null, due_day: null }),
]
const CATEGORIES: Category[] = [
  { id: 7, name: 'Comida', icon: 'fork-knife', color: '#c2410c', monthly_budget: null },
]

function setup() {
  const posted: unknown[] = []
  mockFetch((url, init) => {
    if (url.endsWith('/cards')) return [200, CARDS]
    if (url.endsWith('/categories')) return [200, CATEGORIES]
    if (url.endsWith('/installments') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      posted.push({ url: '/installments', ...body })
      return [
        201,
        {
          ...body,
          id: 5,
          monthly_amount: 1000,
          charges: [{ number: 1, due_date: '2026-10-10' }],
        },
      ]
    }
    if (url.endsWith('/expenses') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      posted.push(body)
      return [
        201,
        {
          ...body,
          id: 99,
          statement: {
            cycle: '2026-10',
            period_start: '2026-09-21',
            closing_date: '2026-10-20',
            due_date: '2026-11-10',
          },
        },
      ]
    }
    return [404, {}]
  })
  const onDone = vi.fn()
  renderWithProviders(<ExpenseForm onDone={onDone} />)
  return { posted, onDone }
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('ExpenseForm', () => {
  it('hides inactive cards and validates required fields', async () => {
    const { posted } = setup()
    expect(await screen.findByRole('button', { name: /Nu/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Vieja/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))
    expect(await screen.findByText(/Monto inválido/)).toBeInTheDocument()
    expect(screen.getByText('Contá en qué fue')).toBeInTheDocument()
    expect(posted).toHaveLength(0)
  })

  it('submits normalized payload and remembers the card', async () => {
    const { posted, onDone } = setup()
    await userEvent.type(await screen.findByLabelText('Monto'), '185,50')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Tacos')
    await userEvent.click(screen.getByRole('button', { name: /Nu/ }))
    await userEvent.click(screen.getByRole('button', { name: /Comida/ }))
    await userEvent.click(screen.getByRole('switch', { name: 'Fue impulsivo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(posted[0]).toMatchObject({
      amount: '185.50',
      description: 'Tacos',
      card_id: 2,
      category_id: 7,
      is_impulse: true,
      note: null,
    })
    expect(localStorage.getItem('valo:last-card')).toBe('2')
  })

  it('offers installments only for credit cards and posts a plan', async () => {
    const { posted, onDone } = setup()
    await userEvent.click(await screen.findByRole('button', { name: /Efectivo/ }))
    expect(screen.queryByRole('switch', { name: 'Compra a meses' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Oro/ }))
    await userEvent.click(screen.getByRole('switch', { name: 'Compra a meses' }))
    await userEvent.type(screen.getByLabelText('Monto total de la compra'), '6000')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Pantalla')
    await userEvent.click(screen.getByRole('button', { name: '6' }))
    expect(screen.getByText(/6 × \$1,000\.00/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar compra a meses' }))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(posted[0]).toMatchObject({
      url: '/installments',
      total: '6000',
      n_months: 6,
      interest_free: true,
      card_id: 1,
      description: 'Pantalla',
    })
  })
})
