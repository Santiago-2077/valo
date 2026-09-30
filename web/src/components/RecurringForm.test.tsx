import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card, Category } from '../lib/types'
import { todayISO } from '../lib/format'
import { mockFetch, renderWithProviders } from '../test/render'
import { RecurringForm } from './RecurringForm'

const CARD: Card = {
  id: 1,
  name: 'Oro',
  bank: null,
  last4: null,
  kind: 'credit',
  closing_day: 20,
  due_day: 10,
  credit_limit: null,
  color: '#1c1917',
  active: true,
  current_statement: null,
  pending_statement: null,
}
const CATEGORIES: Category[] = [
  { id: 5, name: 'Suscripciones', icon: 'repeat', color: '#6d28d9', monthly_budget: null },
  { id: 6, name: 'Servicios', icon: 'lightning', color: '#b45309', monthly_budget: null },
]

function setup() {
  const posted: Record<string, unknown>[] = []
  mockFetch((url, init) => {
    if (url.endsWith('/cards')) return [200, [CARD]]
    if (url.endsWith('/categories')) return [200, CATEGORIES]
    if (url.endsWith('/recurring') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      posted.push(body)
      return [201, { ...body, id: 1, next_run: '2026-10-15' }]
    }
    return [404, {}]
  })
  const onDone = vi.fn()
  renderWithProviders(<RecurringForm onDone={onDone} />)
  return { posted, onDone }
}

afterEach(() => vi.restoreAllMocks())

describe('RecurringForm', () => {
  it('creates a monthly subscription and back-fills this month when asked', async () => {
    const { posted, onDone } = setup()
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Netflix')
    await userEvent.type(screen.getByLabelText('Monto'), '299')
    await userEvent.type(screen.getByLabelText('Día de cobro'), '15')
    await userEvent.click(screen.getByRole('switch', { name: 'Ya me lo cobraron este mes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(posted[0]).toMatchObject({
      name: 'Netflix',
      kind: 'subscription',
      amount: '299',
      card_id: 1,
      category_id: 5, // defaults to "Suscripciones"
      frequency: 'monthly',
      day_of_month: 15,
      month_of_year: null,
      starts_on: `${todayISO().slice(0, 7)}-01`,
    })
  })

  it('requires a month for yearly charges', async () => {
    const { posted } = setup()
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Amazon Prime')
    await userEvent.type(screen.getByLabelText('Monto'), '899')
    await userEvent.click(screen.getByRole('button', { name: 'Anual' }))
    await userEvent.type(screen.getByLabelText('Día de cobro'), '12')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(await screen.findByText('Elegí el mes')).toBeInTheDocument()
    expect(posted).toHaveLength(0)
  })
})
