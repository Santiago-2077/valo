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
  Income,
  IncomeInput,
  IncomePage,
  MonthInsights,
  MonthCommitment,
  Plan,
  PlanInput,
  Recurring,
  RecurringIncome,
  RecurringIncomeInput,
  RecurringInput,
  CardPayment,
  StatementDetail,
} from './types'

export const keys = {
  cards: ['cards'] as const,
  categories: ['categories'] as const,
  expenses: ['expenses'] as const,
  expenseList: (f: ExpenseFilters) => ['expenses', 'list', f] as const,
  statements: ['statements'] as const,
  plans: ['plans'] as const,
  recurring: ['recurring'] as const,
  incomes: ['incomes'] as const,
  recurringIncomes: ['recurring-incomes'] as const,
  insights: ['insights'] as const,
  statement: (cardId: number, cycle?: string) =>
    ['statements', cardId, cycle ?? 'current'] as const,
}

function toQuery(filters: Record<string, string | number | boolean | undefined>): string {
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
      qc.invalidateQueries({ queryKey: keys.plans }),
      qc.invalidateQueries({ queryKey: keys.recurring }),
      qc.invalidateQueries({ queryKey: keys.incomes }),
      qc.invalidateQueries({ queryKey: keys.recurringIncomes }),
      qc.invalidateQueries({ queryKey: keys.insights }),
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

export const usePlans = (includeFinished = false) =>
  useQuery({
    queryKey: [...keys.plans, 'list', includeFinished],
    queryFn: () =>
      api.get<Plan[]>(`/installments${includeFinished ? '?include_finished=true' : ''}`),
  })

export const useCommitments = (months = 6) =>
  useQuery({
    queryKey: [...keys.plans, 'commitments', months],
    queryFn: () => api.get<MonthCommitment[]>(`/installments/commitments?months=${months}`),
  })

export function useSavePlan() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: PlanInput }) =>
      id ? api.put<Plan>(`/installments/${id}`, data) : api.post<Plan>('/installments', data),
    onSuccess: invalidate,
  })
}

export function useDeletePlan() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/installments/${id}`),
    onSuccess: invalidate,
  })
}

export const useRecurring = () =>
  useQuery({ queryKey: keys.recurring, queryFn: () => api.get<Recurring[]>('/recurring') })

export function useSaveRecurring() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: RecurringInput }) =>
      id ? api.put<Recurring>(`/recurring/${id}`, data) : api.post<Recurring>('/recurring', data),
    onSuccess: invalidate,
  })
}

export function useDeleteRecurring() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/recurring/${id}`),
    onSuccess: invalidate,
  })
}

export const useIncomes = (filters: { date_from?: string; date_to?: string }) =>
  useQuery({
    queryKey: [...keys.incomes, filters],
    queryFn: () => api.get<IncomePage>(`/incomes${toQuery({ ...filters, limit: 200 })}`),
    placeholderData: keepPreviousData,
  })

export function useSaveIncome() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: IncomeInput }) =>
      id ? api.put<Income>(`/incomes/${id}`, data) : api.post<Income>('/incomes', data),
    onSuccess: invalidate,
  })
}

export function useDeleteIncome() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/incomes/${id}`),
    onSuccess: invalidate,
  })
}

export const useRecurringIncomes = () =>
  useQuery({
    queryKey: keys.recurringIncomes,
    queryFn: () => api.get<RecurringIncome[]>('/recurring-incomes'),
  })

export function useSaveRecurringIncome() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: RecurringIncomeInput }) =>
      id
        ? api.put<RecurringIncome>(`/recurring-incomes/${id}`, data)
        : api.post<RecurringIncome>('/recurring-incomes', data),
    onSuccess: invalidate,
  })
}

export function useDeleteRecurringIncome() {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/recurring-incomes/${id}`),
    onSuccess: invalidate,
  })
}

export const useMonthInsights = (month?: string) =>
  useQuery({
    queryKey: [...keys.insights, 'month', month ?? 'current'],
    queryFn: () => api.get<MonthInsights>(`/insights/month${month ? `?month=${month}` : ''}`),
    placeholderData: keepPreviousData,
  })

export function useAddPayment(cardId: number) {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (data: { date: string; amount: string; cycle?: string; note?: string | null }) =>
      api.post<CardPayment>(`/cards/${cardId}/payments`, data),
    onSuccess: invalidate,
  })
}

export function useDeletePayment(cardId: number) {
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/cards/${cardId}/payments/${id}`),
    onSuccess: invalidate,
  })
}

export function useStatementCheck(cardId: number, cycle: string) {
  const invalidate = useInvalidateMoney()
  const url = `/cards/${cardId}/statement/${cycle}/check`
  return {
    save: useMutation({
      mutationFn: (bank_total: string) => api.put(url, { bank_total }),
      onSuccess: invalidate,
    }),
    clear: useMutation({ mutationFn: () => api.delete(url), onSuccess: invalidate }),
  }
}
