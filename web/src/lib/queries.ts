import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type {
  Card,
  CardInput,
  Category,
  CategoryInput,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  ExpensePage,
  StatementDetail,
} from './types'

export const keys = {
  cards: ['cards'] as const,
  categories: ['categories'] as const,
  expenses: ['expenses'] as const,
  expenseList: (f: ExpenseFilters) => ['expenses', 'list', f] as const,
  statements: ['statements'] as const,
  statement: (cardId: number, cycle?: string) =>
    ['statements', cardId, cycle ?? 'current'] as const,
}

function toQuery(filters: ExpenseFilters): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '' && v !== false) params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const useCards = () =>
  useQuery({ queryKey: keys.cards, queryFn: () => api.get<Card[]>('/cards') })

export const useCategories = () =>
  useQuery({
    queryKey: keys.categories,
    queryFn: () => api.get<Category[]>('/categories'),
    staleTime: 5 * 60_000,
  })

export const useExpenses = (filters: ExpenseFilters) =>
  useQuery({
    queryKey: keys.expenseList(filters),
    queryFn: () => api.get<ExpensePage>(`/expenses${toQuery(filters)}`),
    placeholderData: keepPreviousData,
  })

export const useStatement = (cardId: number, cycle?: string) =>
  useQuery({
    queryKey: keys.statement(cardId, cycle),
    queryFn: () =>
      api.get<StatementDetail>(`/cards/${cardId}/statement${cycle ? `?cycle=${cycle}` : ''}`),
    placeholderData: keepPreviousData,
  })

/** Anything that changes money totals invalidates every view that shows totals. */
function useInvalidateMoney() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.expenses }),
      qc.invalidateQueries({ queryKey: keys.cards }),
      qc.invalidateQueries({ queryKey: keys.statements }),
    ])
}

export function useSaveExpense() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: ExpenseInput }) =>
      id ? api.put<Expense>(`/expenses/${id}`, data) : api.post<Expense>('/expenses', data),
    onSuccess: invalidate,
  })
}

export function useDeleteExpense() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/expenses/${id}`),
    onSuccess: invalidate,
  })
}

export function useSaveCard() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: CardInput }) =>
      id ? api.put<Card>(`/cards/${id}`, data) : api.post<Card>('/cards', data),
    onSuccess: invalidate,
  })
}

export function useDeleteCard() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/cards/${id}`),
    onSuccess: invalidate,
  })
}

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: CategoryInput }) =>
      id ? api.put<Category>(`/categories/${id}`, data) : api.post<Category>('/categories', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.categories }),
        qc.invalidateQueries({ queryKey: keys.expenses }),
      ]),
  })
}
