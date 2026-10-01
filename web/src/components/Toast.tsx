import { CheckCircle } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { cn } from '../lib/cn'

type Toast = { id: number; title: string; description?: string; leaving?: boolean }
const ToastContext = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})

const VISIBLE_MS = 4500
const EXIT_MS = 180 // exits faster than it enters

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), EXIT_MS)
  }, [])

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++nextId.current
      setToasts((prev) => [...prev.slice(-2), { ...t, id }])
      window.setTimeout(() => dismiss(id), VISIBLE_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-24 z-50 grid justify-items-center gap-2 md:inset-x-auto md:right-8 md:bottom-8 md:justify-items-end"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label={`${t.title}. Tocar para cerrar`}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-inverse px-4 py-3 text-left text-on-inverse shadow-[0_12px_32px_-12px_var(--shadow)]',
              // Enter from below (where the action happened), leave the same way, quicker.
              'transition-[opacity,translate,scale] duration-300 ease-out-soft starting:translate-y-3 starting:scale-[0.98] starting:opacity-0',
              t.leaving && 'translate-y-2 opacity-0 duration-[180ms] ease-out',
            )}
          >
            <CheckCircle
              size={20}
              weight="fill"
              aria-hidden
              className="mt-px shrink-0 text-mark-positive"
            />
            <span>
              <span className="block text-sm font-medium">{t.title}</span>
              {t.description ? (
                <span className="mt-0.5 block text-[13px] text-on-inverse/75">{t.description}</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
