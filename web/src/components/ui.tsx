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
        'transition-[scale,background-color,opacity] duration-150 ease-out',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary-hover',
        variant === 'secondary' && 'border border-border bg-surface text-fg hover:bg-surface-2',
        variant === 'ghost' && 'text-fg-2 hover:bg-surface-2 hover:text-fg',
        variant === 'danger' && 'bg-negative text-on-primary hover:bg-negative/90',
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
      <label htmlFor={inputId} className="text-sm font-medium text-fg-2">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'h-11 rounded-xl border bg-surface px-3.5 text-[15px] text-fg shadow-[inset_0_1px_2px_var(--shadow)]',
          'placeholder:text-muted transition-colors',
          'focus:border-primary focus:outline-none',
          error ? 'border-negative' : 'border-border',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-negative">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  )
})

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-track', className)} />
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
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
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
      <label htmlFor={selectId} className="text-sm font-medium text-fg-2">
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-11 w-full appearance-none rounded-xl border bg-surface pr-9 pl-3.5 text-[15px] text-fg',
            'focus:border-primary focus:outline-none',
            error ? 'border-negative' : 'border-border',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <CaretDown
          size={14}
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted"
        />
      </div>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
    </div>
  )
})

export function Toggle({
  checked,
  onChange,
  label,
  description,
  tone = 'warning',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  tone?: 'warning' | 'neutral'
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-fg-2">
          {label}
        </label>
        {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
          checked ? (tone === 'warning' ? 'bg-mark-warning' : 'bg-primary') : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-6 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-out-soft',
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
    <div className="rounded-3xl border border-dashed border-border-strong px-6 py-14 text-center">
      <p className="font-medium text-fg">{title}</p>
      <p className="mx-auto mt-1 max-w-[44ch] text-sm text-muted">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-negative-soft px-4 py-3 text-sm text-negative">
      No se pudo cargar: {error.message}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="ml-2 font-medium underline">
          Reintentar
        </button>
      ) : null}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: Record<T, string>
  label: string
}) {
  const keys = Object.keys(options) as T[]
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-fg-2">{label}</legend>
      <div
        className="grid gap-1 rounded-xl bg-track p-1"
        style={{ gridTemplateColumns: `repeat(${keys.length}, minmax(0, 1fr))` }}
      >
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={cn(
              'h-9 rounded-lg text-sm transition-colors',
              value === k ? 'bg-surface font-medium text-fg shadow-sm' : 'text-fg-2',
            )}
          >
            {options[k]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  'aria-label': string
  tone?: 'default' | 'danger'
}

/** Icon-only button with a 44px touch target; the glyph stays small. */
export function IconButton({ className, tone = 'default', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-xl text-muted transition-[scale,background-color,color] duration-150 ease-out',
        'hover:bg-surface-2 active:scale-95',
        tone === 'danger' ? 'hover:text-negative' : 'hover:text-fg',
        className,
      )}
      {...props}
    />
  )
}

/** Small card-shaped swatch identifying a payment method by its color. */
export function CardSwatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('h-5 w-7 shrink-0 rounded-[5px] ring-1 ring-border', className)}
      style={{ backgroundColor: color }}
    />
  )
}
