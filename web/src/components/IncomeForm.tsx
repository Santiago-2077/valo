import { zodResolver } from '@hookform/resolvers/zod'
import { Trash } from '@phosphor-icons/react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { cn } from '../lib/cn'
import { formatMoney, todayISO } from '../lib/format'
import { INCOME_KIND_LABEL } from '../lib/incomeKinds'
import { useDeleteIncome, useSaveIncome } from '../lib/queries'
import type { Income, IncomeKind } from '../lib/types'
import { AccountPicker } from './AccountPicker'
import { useToast } from './Toast'
import { Button, Field } from './ui'

const schema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, 'Monto inválido (máx. 2 decimales)')
    .refine((v) => Number(v.replace(',', '.')) > 0, 'Debe ser mayor a 0'),
  description: z.string().trim().min(1, 'Contá de dónde vino').max(120),
  kind: z.enum(['salary', 'freelance', 'bonus', 'other']),
  date: z.string().min(1, 'Elegí la fecha'),
  account_id: z.number().nullable(),
  note: z.string().max(2000),
})
type FormValues = z.infer<typeof schema>

export function IncomeForm({ income, onDone }: { income?: Income; onDone: () => void }) {
  const save = useSaveIncome()
  const remove = useDeleteIncome()
  const toast = useToast()
  const { register, handleSubmit, control, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: income ? String(income.amount) : '',
      description: income?.description ?? '',
      kind: income?.kind ?? 'freelance',
      date: income?.date ?? todayISO(),
      account_id: income?.account_id ?? null,
      note: income?.note ?? '',
    },
  })

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      {
        id: income?.id,
        data: { ...v, amount: v.amount.replace(',', '.'), note: v.note.trim() || null },
      },
      {
        onSuccess: (saved) => {
          toast({
            title: income ? 'Ingreso actualizado' : 'Ingreso guardado',
            description: `+${formatMoney(saved.amount)}`,
          })
          onDone()
        },
      },
    ),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="income-amount" className="text-sm font-medium text-stone-700">
          Monto recibido
        </label>
        <div className="relative">
          <span className="num pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl text-stone-400">
            +$
          </span>
          <input
            id="income-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            data-autofocus={income ? undefined : true}
            aria-invalid={formState.errors.amount ? true : undefined}
            className={cn(
              'num h-16 w-full rounded-2xl border bg-white pr-16 pl-12 text-3xl font-medium tracking-tight focus:border-stone-400 focus:outline-none',
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
        placeholder="Proyecto, venta, reembolso…"
        autoComplete="off"
        error={formState.errors.description?.message}
        {...register('description')}
      />
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-700">Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(INCOME_KIND_LABEL) as IncomeKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={field.value === k}
                  onClick={() => field.onChange(k)}
                  className={cn(
                    'h-9 rounded-lg border px-3 text-sm',
                    field.value === k
                      ? 'border-stone-900 bg-stone-900 text-stone-50'
                      : 'border-stone-200 bg-white text-stone-700',
                  )}
                >
                  {INCOME_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      />
      <Controller
        control={control}
        name="account_id"
        render={({ field }) => (
          <AccountPicker
            value={field.value}
            onChange={field.onChange}
            current={income?.account_id}
          />
        )}
      />
      <Field
        label="Fecha"
        type="date"
        max="2100-12-31"
        error={formState.errors.date?.message}
        {...register('date')}
      />
      <Field label="Nota (opcional)" autoComplete="off" {...register('note')} />
      {save.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {save.error.message}
        </p>
      ) : null}
      <div className="flex gap-3">
        {income ? (
          <Button
            type="button"
            variant="secondary"
            aria-label="Borrar ingreso"
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm('¿Borrar este ingreso?')) {
                remove.mutate(income.id, {
                  onSuccess: () => {
                    toast({ title: 'Ingreso borrado' })
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
          {income ? 'Guardar cambios' : 'Guardar ingreso'}
        </Button>
      </div>
    </form>
  )
}
