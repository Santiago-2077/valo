import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders } from '../test/render'
import { LoginPage } from './LoginPage'

afterEach(() => vi.restoreAllMocks())

describe('LoginPage', () => {
  it('validates empty fields without calling the API', async () => {
    const fetchMock = mockFetch(() => [401, { detail: 'Not authenticated' }])
    renderWithProviders(<LoginPage />, { route: '/login' })
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Ingresá tu usuario')).toBeInTheDocument()
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/auth/me'))).toBe(true)
  })

  it('shows the server error on bad credentials', async () => {
    mockFetch((url) =>
      url.endsWith('/auth/login')
        ? [401, { detail: 'Usuario o contraseña incorrectos' }]
        : [401, { detail: 'Not authenticated' }],
    )
    renderWithProviders(<LoginPage />, { route: '/login' })
    await userEvent.type(screen.getByLabelText('Usuario'), 'santi')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos')
  })

  it('posts credentials on submit', async () => {
    const fetchMock = mockFetch((url) =>
      url.endsWith('/auth/login') ? [200, { id: 1, username: 'santi' }] : [401, {}],
    )
    renderWithProviders(<LoginPage />, { route: '/login' })
    await userEvent.type(screen.getByLabelText('Usuario'), 'santi')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'supersecret')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/login'))
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        username: 'santi',
        password: 'supersecret',
      })
    })
  })
})
