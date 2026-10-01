import { zodResolver } from '@hookform/resolvers/zod'
import { Trash } from '@phosphor-icons/react'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { z } from 'zod'
import { cn } from '../lib/cn'
import { formatDayMonth, todayISO } from '../lib/format'
import { INCOME_KIND_LABEL } from '../lib/incomeKinds'
import { useDeleteRecurringIncome, useSaveRecurringIncome } from '../lib/queries'
import { refineSchedule, scheduleDefaults, schedulePayload, scheduleShape } from '../lib/schedule'
import type { IncomeKind, RecurringIncome } from '../lib/types'
import { AccountPicker } from './AccountPicker'
import { ScheduleFields } from './ScheduleFields'
import { useToast } from './Toast'
import { Button, Field, Toggle } from './ui'

const schema = z
  .object({
    name: z.string().trim().min(1, 'Poné un nombre').max(80),
    kind: z.enum(['salary', 'freelance', 'bonus', 'other']),
    amount: z
      .string()
      .trim()
      .regex(/^\d+([.,]\d{1,2})?$/, 'Monto inválido')
      .refine((v) => Number(v.replace(',', '.')) > 0, 'Debe ser mayor a 0'),
    amount_is_estimate: z.boolean(),
    account_id: z.number().nullable(),
    active: z.boolean(),
    received_this_period: z.boolean(),
    ...scheduleShape,
  })
  .superRefine(refineSchedule)
type FormValues = z.infer<typeof schema>

export function RecurringIncomeForm({
  item,
  onDone,
}: {
  item?: RecurringIncome
  onDone: () => void
}) {
  const save = useSaveRecurringIncome()
  const remove = useDeleteRecurringIncome()
  const toast = useToast()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? 'Sueldo',
      kind: item?.kind ?? 'salary',
      amount: item ? String(item.amount) : '',
      amount_is_estimate: item?.amount_is_estimate ?? false,
      account_id: item?.account_id ?? null,
      active: item?.active ?? true,
      received_this_period: false,
      // Most Mexican salaries are paid on the 15th and the last day of the month.
      ...(item
        ? scheduleDefaults(item)
        : { frequency: 'semimonthly', day_of_month: '15', second_day: '31', month_of_year: '' }),
    },
  })
  const { register, handleSubmit, control, formState } = form

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      {
        id: item?.id,
        data: {
          name: v.name,
          kind: v.kind,
          amount: v.amount.replace(',', '.'),
          amount_is_estimate: v.amount_is_estimate,
          account_id: v.account_id,
          active: v.active,
          ...schedulePayload(v),
          starts_on: !item && v.received_this_period ? `${todayISO().slice(0, 7)}-01` : undefined,
        },
      },
      {
        onSuccess: (saved) => {
          toast({
            title: item ? 'Cambios guardados' : `${saved.name} agregado`,
            description: saved.active
              ? `Próximo depósito: ${formatDayMonth(saved.next_run)}`
              : 'Pausado',
          })
          onDone()
        },
      },
    ),
  )

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <Field
          label="Nombre"
          autoComplete="off"
          error={formState.errors.name?.message}
          {...register('name')}
        />
        <Field
          label="Monto por depósito"
          inputMode="decimal"
          className="num"
          data-autofocus={item ? undefined : true}
          hint="Lo que te llega cada vez, ya con descuentos."
          error={formState.errors.amount?.message}
          {...register('amount')}
        />
        <Controller
          control={control}
          name="amount_is_estimate"
          render={({ field }) => (
            <Toggle
              checked={field.value}
              onChange={field.onChange}
              label="El monto varía"
              description="Se registra como estimado y lo ajustás con lo que te depositaron."
              tone="neutral"
            />
          )}
        />
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-fg-2">Tipo</legend>
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
                        ? 'border-primary bg-primary-soft text-fg ring-1 ring-primary'
                        : 'border-border bg-surface text-fg-2',
                    )}
                  >
                    {INCOME_KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        />
        <ScheduleFields dayLabel="Día de depósito" />
        <Controller
          control={control}
          name="account_id"
          render={({ field }) => (
            <AccountPicker
              value={field.value}
              onChange={field.onChange}
              current={item?.account_id}
            />
          )}
        />
        {item ? (
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label="Activo"
                description="Pausalo si dejaste de recibirlo."
                tone="neutral"
              />
            )}
          />
        ) : (
          <Controller
            control={control}
            name="received_this_period"
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label="Ya lo recibí este mes"
                description="Registra los depósitos de este mes cuya fecha ya pasó."
                tone="neutral"
              />
            )}
          />
        )}
        {save.error ? (
          <p
            role="alert"
            className="rounded-xl bg-negative-soft px-3.5 py-2.5 text-sm text-negative"
          >
            {save.error.message}
          </p>
        ) : null}
        <div className="flex gap-3">
          {item ? (
            <Button
              type="button"
              variant="secondary"
              aria-label="Eliminar"
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm(`¿Eliminar ${item.name}? Lo ya recibido se conserva.`)) {
                  remove.mutate(item.id, { onSuccess: onDone })
                }
              }}
            >
              <Trash size={16} />
            </Button>
          ) : null}
          <Button type="submit" loading={save.isPending} className="h-12 flex-1">
            {item ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
