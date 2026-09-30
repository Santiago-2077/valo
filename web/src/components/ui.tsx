import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import { forwardRef, useId } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { cn } from '../lib/cn'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium',
        'transition-[transform,background-color,opacity] duration-200 ease-out-soft',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-stone-900 text-stone-50 hover:bg-stone-800',
        variant === 'secondary' &&
          'border border-stone-200 bg-white text-stone-800 hover:bg-stone-100',
        variant === 'ghost' && 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
        variant === 'danger' && 'bg-red-700 text-white hover:bg-red-800',
        className,
      )}
      {...props}
    >
      {loading ? <span className="size-3.5 animate-pulse rounded-full bg-current/60" /> : null}
      {children}
    </button>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: ReactNode
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="grid gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'h-11 rounded-xl border bg-white px-3.5 text-[15px] text-stone-900 shadow-[inset_0_1px_2px_rgb(28_25_23/0.04)]',
          'placeholder:text-stone-400 transition-colors',
          'focus:border-stone-400 focus:outline-none',
          error ? 'border-red-300' : 'border-stone-200',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-stone-500">{hint}</p>
      ) : null}
    </div>
  )
})

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-stone-200/70', className)} />
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-stone-500">{description}</p> : null}
      </div>
      {actions}
    </header>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, id, children, ...props },
  ref,
) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="grid gap-2">
      <label htmlFor={selectId} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-11 w-full appearance-none rounded-xl border bg-white pr-9 pl-3.5 text-[15px] text-stone-900',
            'focus:border-stone-400 focus:outline-none',
            error ? 'border-red-300' : 'border-stone-200',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <CaretDown
          size={14}
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-stone-400"
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  )
})

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-stone-700">
          {label}
        </label>
        {description ? <p className="text-[13px] text-stone-500">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-amber-600' : 'bg-stone-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out-soft',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 px-6 py-14 text-center">
      <p className="font-medium text-stone-800">{title}</p>
      <p className="mx-auto mt-1 max-w-[44ch] text-sm text-stone-500">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
      No se pudo cargar: {error.message}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="ml-2 font-medium underline">
          Reintentar
        </button>
      ) : null}
    </div>
  )
}
