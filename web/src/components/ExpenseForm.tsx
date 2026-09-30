import { zodResolver } from '@hookform/resolvers/zod'
import { Trash } from '@phosphor-icons/react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { cn } from '../lib/cn'
import { formatDayMonth, formatMoney, monthlyPreview, todayISO } from '../lib/format'
import {
  useCards,
  useCategories,
  useDeleteExpense,
  useDeletePlan,
  useSaveExpense,
  useSavePlan,
} from '../lib/queries'
import type { Expense, Plan } from '../lib/types'
import { CategoryIcon } from './CategoryIcon'
import { useToast } from './Toast'
import { Button, Field, Toggle } from './ui'

const LAST_CARD_KEY = 'valo:last-card'
const MONTH_OPTIONS = [3, 6, 9, 12, 18, 24]

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
  msi: z.boolean(),
  n_months: z.number().int().min(2, 'Mínimo 2 meses').max(48, 'Máximo 48 meses'),
  interest_free: z.boolean(),
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

function rememberCard(id: number) {
  try {
    localStorage.setItem(LAST_CARD_KEY, String(id))
  } catch {
    /* storage unavailable */
  }
}

type Props = { expense?: Expense; plan?: Plan; onDone: () => void }

export function ExpenseForm({ expense, plan, onDone }: Props) {
  const cards = useCards()
  const categories = useCategories()
  const saveExpense = useSaveExpense()
  const savePlan = useSavePlan()
  const removeExpense = useDeleteExpense()
  const removePlan = useDeletePlan()
  const toast = useToast()

  const currentCardId = plan?.card_id ?? expense?.card_id
  const selectable = (cards.data ?? []).filter(
    (c) => (c.active || c.id === currentCardId) && (!plan || c.kind === 'credit'),
  )
  const lastCard = readLastCard()
  const defaultCard =
    currentCardId ?? selectable.find((c) => c.id === lastCard)?.id ?? selectable[0]?.id

  const { register, handleSubmit, control, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: plan ? String(plan.total) : expense ? String(expense.amount) : '',
      description: plan?.description ?? expense?.description ?? '',
      date: plan?.purchase_date ?? expense?.date ?? todayISO(),
      card_id: defaultCard,
      category_id: plan?.category_id ?? expense?.category_id ?? null,
      is_impulse: plan?.is_impulse ?? expense?.is_impulse ?? false,
      note: plan?.note ?? expense?.note ?? '',
      msi: Boolean(plan),
      n_months: plan?.n_months ?? 12,
      interest_free: plan?.interest_free ?? true,
    },
  })

  const [cardId, msiOn, nMonths, amountRaw] = useWatch({
    control,
    name: ['card_id', 'msi', 'n_months', 'amount'],
  })
  const selectedCard = selectable.find((c) => c.id === cardId)
  const canMsi = !expense && selectedCard?.kind === 'credit'
  const msi = Boolean(plan) || (canMsi && msiOn)
  const amountNum = Number(amountRaw.replace(',', '.'))

  const pending = saveExpense.isPending || savePlan.isPending
  const error = saveExpense.error ?? savePlan.error

  const onSubmit = handleSubmit((v) => {
    const common = {
      description: v.description,
      card_id: v.card_id,
      category_id: v.category_id,
      is_impulse: v.is_impulse,
      note: v.note.trim() || null,
    }
    const amount = v.amount.replace(',', '.')

    if (msi) {
      savePlan.mutate(
        {
          id: plan?.id,
          data: {
            ...common,
            total: amount,
            n_months: v.n_months,
            interest_free: v.interest_free,
            purchase_date: v.date,
          },
        },
        {
          onSuccess: (saved) => {
            rememberCard(saved.card_id)
            const first = saved.charges[0]
            toast({
              title: plan
                ? 'Compra a meses actualizada'
                : `Compra a ${saved.n_months} meses guardada`,
              description: first
                ? `${saved.n_months} × ${formatMoney(saved.monthly_amount)} · primera cuota se paga el ${formatDayMonth(first.due_date)}`
                : undefined,
            })
            onDone()
          },
        },
      )
      return
    }

    saveExpense.mutate(
      { id: expense?.id, data: { ...common, amount, date: v.date } },
      {
        onSuccess: (saved) => {
          rememberCard(saved.card_id)
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
          {msi ? 'Monto total de la compra' : 'Monto'}
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
            data-autofocus={expense || plan ? undefined : true}
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

      {canMsi || plan ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
          {plan ? (
            <p className="text-sm font-medium text-stone-700">Compra a meses</p>
          ) : (
            <Controller
              control={control}
              name="msi"
              render={({ field }) => (
                <Toggle
                  checked={field.value}
                  onChange={field.onChange}
                  label="Compra a meses"
                  description="Se reparte en cuotas, una por corte."
                  tone="neutral"
                />
              )}
            />
          )}
          {msi ? (
            <div className="mt-4 grid gap-4 border-t border-stone-100 pt-4">
              <Controller
                control={control}
                name="n_months"
                render={({ field, fieldState }) => (
                  <fieldset>
                    <legend className="mb-2 text-sm text-stone-600">Meses</legend>
                    <div className="flex flex-wrap gap-2">
                      {MONTH_OPTIONS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={field.value === n}
                          onClick={() => field.onChange(n)}
                          className={cn(
                            'num h-9 min-w-11 rounded-lg border px-2.5 text-sm',
                            field.value === n
                              ? 'border-stone-900 bg-stone-900 text-stone-50'
                              : 'border-stone-200 text-stone-700 hover:border-stone-300',
                          )}
                        >
                          {n}
                        </button>
                      ))}
                      <input
                        aria-label="Otra cantidad de meses"
                        inputMode="numeric"
                        placeholder="Otro"
                        value={MONTH_OPTIONS.includes(field.value) ? '' : field.value || ''}
                        onChange={(e) => field.onChange(Number(e.target.value.replace(/\D/g, '')))}
                        className="num h-9 w-16 rounded-lg border border-stone-200 px-2 text-sm focus:border-stone-400 focus:outline-none"
                      />
                    </div>
                    {fieldState.error ? (
                      <p className="mt-2 text-sm text-red-700">{fieldState.error.message}</p>
                    ) : null}
                  </fieldset>
                )}
              />
              <Controller
                control={control}
                name="interest_free"
                render={({ field }) => (
                  <Toggle
                    checked={field.value}
                    onChange={field.onChange}
                    label="Sin intereses"
                    description={field.value ? undefined : 'Poné arriba el total con intereses.'}
                    tone="neutral"
                  />
                )}
              />
              {amountNum > 0 && nMonths >= 2 ? (
                <p className="text-sm text-stone-600">
                  <span className="num font-medium text-stone-900">
                    {nMonths} × {formatMoney(monthlyPreview(amountNum, nMonths))}
                  </span>{' '}
                  al mes
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

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
        label={msi ? 'Fecha de compra' : 'Fecha'}
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

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {error.message}
        </p>
      ) : null}

      <div className="flex gap-3">
        {expense || plan ? (
          <Button
            type="button"
            variant="secondary"
            aria-label={plan ? 'Borrar compra a meses' : 'Borrar gasto'}
            loading={removeExpense.isPending || removePlan.isPending}
            onClick={() => {
              const done = (title: string) => () => {
                toast({ title })
                onDone()
              }
              if (plan) {
                if (window.confirm(`¿Borrar la compra y sus ${plan.n_months} cuotas?`)) {
                  removePlan.mutate(plan.id, { onSuccess: done('Compra a meses borrada') })
                }
              } else if (expense && window.confirm('¿Borrar este gasto?')) {
                removeExpense.mutate(expense.id, { onSuccess: done('Gasto borrado') })
              }
            }}
          >
            <Trash size={16} />
          </Button>
        ) : null}
        <Button type="submit" loading={pending} className="h-12 flex-1">
          {expense || plan ? 'Guardar cambios' : msi ? 'Guardar compra a meses' : 'Guardar gasto'}
        </Button>
      </div>
    </form>
  )
}
