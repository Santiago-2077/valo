import { CheckCircle } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

type Toast = { id: number; title: string; description?: string }
const ToastContext = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++nextId.current
    setToasts((prev) => [...prev.slice(-2), { ...t, id }])
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-24 z-50 grid justify-items-center gap-2 md:inset-x-auto md:right-8 md:bottom-8 md:justify-items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex w-full max-w-sm animate-[toast-in_300ms_var(--ease-out-soft)] items-start gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-stone-50 shadow-[0_12px_32px_-12px_rgb(28_25_23/0.5)]"
          >
            <CheckCircle size={20} weight="fill" className="mt-px shrink-0 text-accent-100" />
            <div>
              <p className="text-sm font-medium">{t.title}</p>
              {t.description ? (
                <p className="mt-0.5 text-[13px] text-stone-400">{t.description}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
