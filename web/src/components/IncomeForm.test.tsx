import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card } from '../lib/types'
import { mockFetch, renderWithProviders } from '../test/render'
import { IncomeForm } from './IncomeForm'

const card = (over: Partial<Card>): Card => ({
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
  ...over,
})

afterEach(() => vi.restoreAllMocks())

describe('IncomeForm', () => {
  it('offers only debit/cash accounts and posts the income', async () => {
    const posted: unknown[] = []
    mockFetch((url, init) => {
      if (url.endsWith('/cards'))
        return [200, [card({}), card({ id: 2, name: 'Nómina', kind: 'debit' })]]
      if (url.endsWith('/incomes') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        posted.push(body)
        return [201, { ...body, id: 1, recurring_income_id: null, amount: 3500 }]
      }
      return [404, {}]
    })
    const onDone = vi.fn()
    renderWithProviders(<IncomeForm onDone={onDone} />)

    expect(await screen.findByRole('button', { name: /Nómina/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Oro/ })).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Monto recibido'), '3500')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Logo cafetería')
    await userEvent.click(screen.getByRole('button', { name: /Nómina/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ingreso' }))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(posted[0]).toMatchObject({
      amount: '3500',
      description: 'Logo cafetería',
      kind: 'freelance',
      account_id: 2,
      note: null,
    })
  })
})
