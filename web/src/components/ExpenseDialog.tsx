import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Expense } from '../lib/types'
import { Dialog } from './Dialog'
import { ExpenseForm } from './ExpenseForm'

type State = { open: boolean; expense?: Expense; key: number }
const Ctx = createContext<(expense?: Expense) => void>(() => {})

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

export function ExpenseDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ open: false, key: 0 })
  const open = useCallback(
    (expense?: Expense) => setState((s) => ({ open: true, expense, key: s.key + 1 })),
    [],
  )
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
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <Ctx.Provider value={open}>
      {children}
      <Dialog
        open={state.open}
        onClose={close}
        title={state.expense ? 'Editar gasto' : 'Nuevo gasto'}
      >
        <ExpenseForm key={state.key} expense={state.expense} onDone={close} />
      </Dialog>
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useExpenseDialog = () => useContext(Ctx)
