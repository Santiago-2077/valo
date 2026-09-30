import { X } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Native <dialog>: focus trap, Escape and top-layer for free. Bottom sheet on mobile. */
export function Dialog({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      // showModal() focuses the first focusable (the close button); prefer the marked field.
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-stone-50 p-0 text-stone-900 shadow-[0_-8px_40px_-12px_rgb(28_25_23/0.25)] backdrop:bg-stone-950/30 backdrop:backdrop-blur-[2px] md:m-auto md:max-w-lg md:rounded-3xl open:animate-[sheet-in_320ms_var(--ease-out-soft)]"
    >
      {open ? (
        <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-7 md:pt-6 md:pb-7">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300 md:hidden" />
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-200/60 hover:text-stone-900"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
