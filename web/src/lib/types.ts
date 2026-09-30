export type CardKind = 'credit' | 'debit' | 'cash'

export type StatementRef = {
  cycle: string
  period_start: string
  closing_date: string
  due_date: string
}

export type Card = {
  id: number
  name: string
  bank: string | null
  last4: string | null
  kind: CardKind
  closing_day: number | null
  due_day: number | null
  credit_limit: number | null
  color: string
  active: boolean
  current_statement: (StatementRef & { total: number }) | null
  pending_statement: (StatementRef & { total: number }) | null
}

export type CardInput = Omit<Card, 'id' | 'current_statement' | 'pending_statement'>

export type Category = {
  id: number
  name: string
  icon: string
  color: string
  monthly_budget: number | null
}

export type CategoryInput = Omit<Category, 'id'>

export type Expense = {
  id: number
  date: string
  description: string
  amount: number
  currency: string
  fx_rate: number
  amount_mxn: number
  card_id: number
  category_id: number | null
  is_impulse: boolean
  note: string | null
  statement: StatementRef | null
}

export type ExpenseInput = {
  date: string
  description: string
  amount: string
  card_id: number
  category_id: number | null
  is_impulse: boolean
  note: string | null
}

export type ExpensePage = { items: Expense[]; total: number; sum_mxn: number }

export type ExpenseFilters = {
  date_from?: string
  date_to?: string
  card_id?: number
  category_id?: number
  uncategorized?: boolean
  is_impulse?: boolean
  q?: string
  limit?: number
  offset?: number
}

export type StatementDetail = StatementRef & {
  card_id: number
  status: 'open' | 'closed' | 'past_due_date'
  total: number
  impulse_total: number
  previous_cycle: string
  next_cycle: string
  expenses: Pick<
    Expense,
    | 'id'
    | 'date'
    | 'description'
    | 'amount'
    | 'currency'
    | 'amount_mxn'
    | 'category_id'
    | 'is_impulse'
  >[]
}
