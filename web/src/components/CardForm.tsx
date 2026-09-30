import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { cn } from '../lib/cn'
import { useSaveCard } from '../lib/queries'
import type { Card, CardKind } from '../lib/types'
import { useToast } from './Toast'
import { Button, Field, Toggle } from './ui'

const CARD_COLORS = [
  '#1c1917',
  '#1e3a8a',
  '#0f766e',
  '#9f1239',
  '#b45309',
  '#6b21a8',
  '#475569',
  '#a8a29e',
]

const day = z
  .string()
  .regex(/^\d{1,2}$/, 'Día 1–31')
  .refine((v) => Number(v) >= 1 && Number(v) <= 31, 'Día 1–31')

const schema = z
  .object({
    name: z.string().trim().min(1, 'Poné un nombre').max(60),
    bank: z.string().trim().max(60),
    last4: z.string().regex(/^(\d{4})?$/, '4 dígitos'),
    kind: z.enum(['credit', 'debit', 'cash']),
    closing_day: z.string(),
    due_day: z.string(),
    credit_limit: z.string().regex(/^(\d+([.,]\d{1,2})?)?$/, 'Monto inválido'),
    color: z.string(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== 'credit') return
    for (const key of ['closing_day', 'due_day'] as const) {
      const r = day.safeParse(v[key])
      if (!r.success) ctx.addIssue({ code: 'custom', path: [key], message: 'Día 1–31' })
    }
  })
type FormValues = z.infer<typeof schema>

const KIND_LABEL: Record<CardKind, string> = {
  credit: 'Crédito',
  debit: 'Débito',
  cash: 'Efectivo',
}

export function CardForm({ card, onDone }: { card?: Card; onDone: () => void }) {
  const save = useSaveCard()
  const toast = useToast()
  const { register, handleSubmit, control, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: card?.name ?? '',
      bank: card?.bank ?? '',
      last4: card?.last4 ?? '',
      kind: card?.kind ?? 'credit',
      closing_day: card?.closing_day?.toString() ?? '',
      due_day: card?.due_day?.toString() ?? '',
      credit_limit: card?.credit_limit?.toString() ?? '',
      color: card?.color ?? CARD_COLORS[0],
      active: card?.active ?? true,
    },
  })
  const kind = useWatch({ control, name: 'kind' })

  const onSubmit = handleSubmit((v) => {
    const credit = v.kind === 'credit'
    save.mutate(
      {
        id: card?.id,
        data: {
          name: v.name,
          bank: v.bank || null,
          last4: v.last4 || null,
          kind: v.kind,
          closing_day: credit ? Number(v.closing_day) : null,
          due_day: credit ? Number(v.due_day) : null,
          credit_limit: credit && v.credit_limit ? Number(v.credit_limit.replace(',', '.')) : null,
          color: v.color,
          active: v.active,
        },
      },
      {
        onSuccess: () => {
          toast({ title: card ? 'Tarjeta actualizada' : 'Tarjeta agregada' })
          onDone()
        },
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-700">Tipo</legend>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200/60 p-1">
              {(Object.keys(KIND_LABEL) as CardKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={field.value === k}
                  onClick={() => field.onChange(k)}
                  className={cn(
                    'h-9 rounded-lg text-sm transition-colors',
                    field.value === k
                      ? 'bg-white font-medium text-stone-900 shadow-sm'
                      : 'text-stone-600',
                  )}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      />

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field
          label="Nombre"
          placeholder={kind === 'cash' ? 'Efectivo' : 'Oro, Nu, Azul…'}
          error={formState.errors.name?.message}
          {...register('name')}
        />
        {kind !== 'cash' ? (
          <Field
            label="Últimos 4"
            inputMode="numeric"
            maxLength={4}
            className="num"
            error={formState.errors.last4?.message}
            {...register('last4')}
          />
        ) : null}
      </div>

      {kind !== 'cash' ? (
        <Field label="Banco" placeholder="BBVA, Nu, Santander…" {...register('bank')} />
      ) : null}

      {kind === 'credit' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Día de corte"
              inputMode="numeric"
              className="num"
              hint="Cierra el resumen"
              error={formState.errors.closing_day?.message}
              {...register('closing_day')}
            />
            <Field
              label="Día límite de pago"
              inputMode="numeric"
              className="num"
              hint="Pagar antes de"
              error={formState.errors.due_day?.message}
              {...register('due_day')}
            />
          </div>
          <Field
            label="Límite de crédito (opcional)"
            inputMode="decimal"
            className="num"
            error={formState.errors.credit_limit?.message}
            {...register('credit_limit')}
          />
        </>
      ) : null}

      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-700">Color</legend>
            <div className="flex flex-wrap gap-2">
              {CARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={field.value === c}
                  onClick={() => field.onChange(c)}
                  className={cn(
                    'size-8 rounded-full ring-offset-2 ring-offset-stone-50 transition-shadow',
                    field.value === c && 'ring-2 ring-stone-900',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </fieldset>
        )}
      />

      {card ? (
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Toggle
              checked={field.value}
              onChange={field.onChange}
              label="Activa"
              description="Las inactivas no aparecen al cargar gastos."
            />
          )}
        />
      ) : null}

      {save.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {save.error.message}
        </p>
      ) : null}
      <Button type="submit" loading={save.isPending} className="h-12">
        {card ? 'Guardar cambios' : 'Agregar'}
      </Button>
    </form>
  )
}
