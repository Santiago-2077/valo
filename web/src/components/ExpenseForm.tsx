import { zodResolver } from '@hookform/resolvers/zod'
import { Trash } from '@phosphor-icons/react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { cn } from '../lib/cn'
import { formatDayMonth, todayISO } from '../lib/format'
import { useCards, useCategories, useDeleteExpense, useSaveExpense } from '../lib/queries'
import type { Expense } from '../lib/types'
import { CategoryIcon } from './CategoryIcon'
import { useToast } from './Toast'
import { Button, Field, Toggle } from './ui'

const LAST_CARD_KEY = 'valo:last-card'

const schema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, 'Monto inválido (máx. 2 decimales)')
    .refine((v) => Number(v.replace(',', '.')) > 0, 'Debe ser mayor a 0'),
  description: z.string().trim().min(1, 'Contá en qué fue').max(120),
  date: z.string().min(1, 'Elegí la fecha'),
  card_id: z.number({ error: 'Elegí con qué pagaste' }),
  category_id: z.number().nullable(),
  is_impulse: z.boolean(),
  note: z.string().max(2000),
})
type FormValues = z.infer<typeof schema>

function readLastCard(): number | undefined {
  try {
    const v = Number(localStorage.getItem(LAST_CARD_KEY))
    return Number.isFinite(v) && v > 0 ? v : undefined
  } catch {
    return undefined
  }
}

export function ExpenseForm({ expense, onDone }: { expense?: Expense; onDone: () => void }) {
  const cards = useCards()
  const categories = useCategories()
  const save = useSaveExpense()
  const remove = useDeleteExpense()
  const toast = useToast()

  const selectable = (cards.data ?? []).filter((c) => c.active || c.id === expense?.card_id)
  const lastCard = readLastCard()
  const defaultCard =
    expense?.card_id ?? selectable.find((c) => c.id === lastCard)?.id ?? selectable[0]?.id

  const { register, handleSubmit, control, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: expense ? String(expense.amount) : '',
      description: expense?.description ?? '',
      date: expense?.date ?? todayISO(),
      card_id: defaultCard,
      category_id: expense?.category_id ?? null,
      is_impulse: expense?.is_impulse ?? false,
      note: expense?.note ?? '',
    },
  })

  const onSubmit = handleSubmit((v) => {
    save.mutate(
      {
        id: expense?.id,
        data: {
          ...v,
          amount: v.amount.replace(',', '.'),
          note: v.note.trim() || null,
        },
      },
      {
        onSuccess: (saved) => {
          try {
            localStorage.setItem(LAST_CARD_KEY, String(saved.card_id))
          } catch {
            /* storage unavailable */
          }
          toast({
            title: expense ? 'Gasto actualizado' : 'Gasto guardado',
            description: saved.statement
              ? `Cae en el corte del ${formatDayMonth(saved.statement.closing_date)} · pagás antes del ${formatDayMonth(saved.statement.due_date)}`
              : undefined,
          })
          onDone()
        },
      },
    )
  })

  if (cards.isPending) return <p className="py-8 text-center text-sm text-stone-500">Cargando…</p>
  if (selectable.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-stone-600">
        Primero agregá una tarjeta o efectivo en <strong>Tarjetas</strong>.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="amount" className="text-sm font-medium text-stone-700">
          Monto
        </label>
        <div className="relative">
          <span className="num pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl text-stone-400">
            $
          </span>
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            data-autofocus={expense ? undefined : true}
            aria-invalid={formState.errors.amount ? true : undefined}
            className={cn(
              'num h-16 w-full rounded-2xl border bg-white pr-16 pl-9 text-3xl font-medium tracking-tight focus:border-stone-400 focus:outline-none',
              formState.errors.amount ? 'border-red-300' : 'border-stone-200',
            )}
            {...register('amount')}
          />
          <span className="num absolute top-1/2 right-4 -translate-y-1/2 text-sm text-stone-400">
            MXN
          </span>
        </div>
        {formState.errors.amount ? (
          <p className="text-sm text-red-700">{formState.errors.amount.message}</p>
        ) : null}
      </div>

      <Field
        label="Descripción"
        placeholder="Tacos, Uber, Amazon…"
        autoComplete="off"
        error={formState.errors.description?.message}
        {...register('description')}
      />

      <Controller
        control={control}
        name="card_id"
        render={({ field, fieldState }) => (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium text-stone-700">Pagaste con</legend>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {selectable.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={field.value === c.id}
                  onClick={() => field.onChange(c.id)}
                  className={cn(
                    'flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm transition-colors',
                    field.value === c.id
                      ? 'border-stone-900 bg-stone-900 text-stone-50'
                      : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300',
                  )}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                  {c.last4 ? <span className="num text-xs opacity-60">{c.last4}</span> : null}
                </button>
              ))}
            </div>
            {fieldState.error ? (
              <p className="text-sm text-red-700">{fieldState.error.message}</p>
            ) : null}
          </fieldset>
        )}
      />

      <Controller
        control={control}
        name="category_id"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-700">Categoría</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(categories.data ?? []).map((c) => {
                const active = field.value === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => field.onChange(active ? null : c.id)}
                    className={cn(
                      'flex h-11 items-center gap-2 rounded-xl border px-2 text-left text-sm transition-colors',
                      active
                        ? 'border-stone-900 bg-white ring-1 ring-stone-900'
                        : 'border-stone-200 bg-white hover:border-stone-300',
                    )}
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <span className="truncate">{c.name}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}
      />

      <Field
        label="Fecha"
        type="date"
        max="2100-12-31"
        error={formState.errors.date?.message}
        {...register('date')}
      />

      <Controller
        control={control}
        name="is_impulse"
        render={({ field }) => (
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
            <Toggle
              checked={field.value}
              onChange={field.onChange}
              label="Fue impulsivo"
              description="Algo que no tenías planeado comprar."
            />
          </div>
        )}
      />

      <Field label="Nota (opcional)" autoComplete="off" {...register('note')} />

      {save.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {save.error.message}
        </p>
      ) : null}

      <div className="flex gap-3">
        {expense ? (
          <Button
            type="button"
            variant="secondary"
            aria-label="Borrar gasto"
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm('¿Borrar este gasto?')) {
                remove.mutate(expense.id, {
                  onSuccess: () => {
                    toast({ title: 'Gasto borrado' })
                    onDone()
                  },
                })
              }
            }}
          >
            <Trash size={16} />
          </Button>
        ) : null}
        <Button type="submit" loading={save.isPending} className="h-12 flex-1">
          {expense ? 'Guardar cambios' : 'Guardar gasto'}
        </Button>
      </div>
    </form>
  )
}
