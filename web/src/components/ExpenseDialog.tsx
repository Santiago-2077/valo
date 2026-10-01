import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Expense, Income, Plan } from '../lib/types'
import { Dialog } from './Dialog'
import { ExpenseForm } from './ExpenseForm'
import { IncomeForm } from './IncomeForm'
import { Segmented } from './ui'

type Target = Expense | Plan | Income
type Mode = 'expense' | 'income'
type State = {
  open: boolean
  mode: Mode
  expense?: Expense
  plan?: Plan
  income?: Income
  key: number
  instant: boolean
}

/** open() = new expense; open('income') = new income; open(item) = edit it. */
type Open = (target?: Target | Mode, opts?: { instant?: boolean }) => void
const Ctx = createContext<Open>(() => {})

const isPlan = (t: Target): t is Plan => 'n_months' in t
const isIncome = (t: Target): t is Income => 'recurring_income_id' in t

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

const TITLES: Record<string, string> = {
  plan: 'Editar compra a meses',
  expense: 'Editar gasto',
  income: 'Editar ingreso',
  new: 'Nuevo movimiento',
}

export function ExpenseDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    open: false,
    mode: 'expense',
    key: 0,
    instant: false,
  })

  const open = useCallback<Open>(async (target, opts) => {
    const next: Omit<State, 'key' | 'open'> = { mode: 'expense', instant: Boolean(opts?.instant) }
    if (target === 'income' || target === 'expense') next.mode = target
    else if (target && isPlan(target)) next.plan = target
    else if (target && isIncome(target)) Object.assign(next, { mode: 'income', income: target })
    else if (target?.installment) {
      // An installment charge is edited through its plan.
      next.plan = await api.get<Plan>(`/installments/${target.installment.plan_id}`)
    } else if (target) next.expense = target
    setState((s) => ({ ...next, open: true, key: s.key + 1 }))
  }, [])
  const close = () => setState((s) => ({ ...s, open: false }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'n' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTyping(e.target) &&
        !document.querySelector('dialog[open]')
      ) {
        e.preventDefault()
        // Keyboard-initiated: open instantly, never animate a shortcut.
        void open(undefined, { instant: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const editing = state.plan ? 'plan' : state.expense ? 'expense' : state.income ? 'income' : null

  return (
    <Ctx.Provider value={open}>
      {children}
      <Dialog
        open={state.open}
        onClose={close}
        title={TITLES[editing ?? 'new']}
        instant={state.instant}
      >
        {editing === null ? (
          <div className="mb-5">
            <Segmented
              label="Tipo de movimiento"
              value={state.mode}
              onChange={(mode) => setState((s) => ({ ...s, mode, key: s.key + 1 }))}
              options={{ expense: 'Gasto', income: 'Ingreso' }}
            />
          </div>
        ) : null}
        {state.mode === 'income' ? (
          <IncomeForm key={state.key} income={state.income} onDone={close} />
        ) : (
          <ExpenseForm key={state.key} expense={state.expense} plan={state.plan} onDone={close} />
        )}
      </Dialog>
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useExpenseDialog = () => useContext(Ctx)
