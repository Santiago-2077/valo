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
  current_statement: StatementTotals | null
  pending_statement: StatementTotals | null
}

export type StatementTotals = StatementRef & { total: number; paid: number; remaining: number }

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
  installment: InstallmentRef | null
  recurring_id: number | null
}

export type InstallmentRef = { plan_id: number; number: number; of: number }

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

export type CardPayment = {
  id: number
  card_id: number
  cycle: string
  date: string
  amount: number
  note: string | null
}

export type StatementDetail = StatementRef & {
  card_id: number
  status: 'open' | 'closed' | 'past_due_date'
  total: number
  paid: number
  remaining: number
  settled: boolean
  bank_total: number | null
  difference: number | null
  payments: CardPayment[]
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
    | 'installment'
    | 'recurring_id'
  >[]
}

export type PlanCharge = {
  number: number
  expense_id: number
  date: string
  amount: number
  cycle: string
  due_date: string
  paid: boolean
}

export type Plan = {
  id: number
  description: string
  total: number
  n_months: number
  interest_free: boolean
  purchase_date: string
  card_id: number
  category_id: number | null
  is_impulse: boolean
  note: string | null
  monthly_amount: number
  paid_count: number
  remaining_amount: number
  next_charge: PlanCharge | null
  charges: PlanCharge[]
}

export type PlanInput = {
  description: string
  total: string
  n_months: number
  interest_free: boolean
  purchase_date: string
  card_id: number
  category_id: number | null
  is_impulse: boolean
  note: string | null
}

export type MonthCommitment = { month: string; total: number; plans: number }

export type Frequency = 'monthly' | 'semimonthly' | 'yearly'
export type RecurringKind = 'subscription' | 'service'

export type Recurring = {
  id: number
  name: string
  kind: RecurringKind
  amount: number
  currency: string
  amount_is_estimate: boolean
  card_id: number
  category_id: number | null
  frequency: Frequency
  day_of_month: number
  second_day: number | null
  month_of_year: number | null
  active: boolean
  next_run: string
  monthly_cost: number
  yearly_cost: number
  last_charged: string | null
}

export type RecurringInput = {
  name: string
  kind: RecurringKind
  amount: string
  amount_is_estimate: boolean
  card_id: number
  category_id: number | null
  frequency: Frequency
  day_of_month: number
  second_day: number | null
  month_of_year: number | null
  active: boolean
  starts_on?: string
}

export type IncomeKind = 'salary' | 'freelance' | 'bonus' | 'other'

export type Income = {
  id: number
  date: string
  description: string
  amount: number
  kind: IncomeKind
  account_id: number | null
  note: string | null
  recurring_income_id: number | null
}

export type IncomeInput = Omit<Income, 'id' | 'recurring_income_id' | 'amount'> & {
  amount: string
}

export type IncomePage = { items: Income[]; total: number; sum: number }

export type RecurringIncome = {
  id: number
  name: string
  kind: IncomeKind
  amount: number
  amount_is_estimate: boolean
  account_id: number | null
  frequency: Frequency
  day_of_month: number
  second_day: number | null
  month_of_year: number | null
  active: boolean
  next_run: string
  monthly_amount: number
  yearly_amount: number
  last_received: string | null
}

export type RecurringIncomeInput = {
  name: string
  kind: IncomeKind
  amount: string
  amount_is_estimate: boolean
  account_id: number | null
  frequency: Frequency
  day_of_month: number
  second_day: number | null
  month_of_year: number | null
  active: boolean
  starts_on?: string
}

export type CategorySpend = {
  category_id: number | null
  spent: number
  budget: number | null
  ratio: number | null
}

export type MonthInsights = {
  month: string
  income: number
  expenses: number
  balance: number
  impulse: number
  installments: number
  recurring: number
  card_payments: number
  previous_expenses: number
  fixed_monthly_cost: number
  budget_total: number
  budget_spent: number
  categories: CategorySpend[]
}
