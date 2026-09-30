import { zodResolver } from '@hookform/resolvers/zod'
import { Trash } from '@phosphor-icons/react'
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { cn } from '../lib/cn'
import { formatDayMonth, todayISO } from '../lib/format'
import { useCards, useCategories, useDeleteRecurring, useSaveRecurring } from '../lib/queries'
import { refineSchedule, scheduleDefaults, schedulePayload, scheduleShape } from '../lib/schedule'
import type { Recurring, RecurringKind } from '../lib/types'
import { CategoryIcon } from './CategoryIcon'
import { ScheduleFields } from './ScheduleFields'
import { useToast } from './Toast'
import { Button, Field, Segmented, Toggle } from './ui'

const schema = z
  .object({
    name: z.string().trim().min(1, 'Poné un nombre').max(80),
    kind: z.enum(['subscription', 'service']),
    amount: z
      .string()
      .trim()
      .regex(/^\d+([.,]\d{1,2})?$/, 'Monto inválido')
      .refine((v) => Number(v.replace(',', '.')) > 0, 'Debe ser mayor a 0'),
    amount_is_estimate: z.boolean(),
    card_id: z.number({ error: 'Elegí con qué se paga' }),
    category_id: z.number().nullable(),
    active: z.boolean(),
    charged_this_period: z.boolean(),
    ...scheduleShape,
  })
  .superRefine(refineSchedule)
type FormValues = z.infer<typeof schema>

const KIND: Record<RecurringKind, string> = { subscription: 'Suscripción', service: 'Servicio' }

type Props = { item?: Recurring; onDone: () => void }

/** Defaults depend on cards and categories, so the form mounts only once they're loaded. */
export function RecurringForm(props: Props) {
  const cards = useCards()
  const categories = useCategories()
  if (cards.isPending || categories.isPending) {
    return <p className="py-8 text-center text-sm text-stone-500">Cargando…</p>
  }
  if (!cards.data?.some((c) => c.active)) {
    return (
      <p className="py-8 text-center text-sm text-stone-600">
        Primero agregá una tarjeta o efectivo en <strong>Tarjetas</strong>.
      </p>
    )
  }
  return <LoadedRecurringForm {...props} />
}

function LoadedRecurringForm({ item, onDone }: Props) {
  const cards = useCards()
  const categories = useCategories()
  const save = useSaveRecurring()
  const remove = useDeleteRecurring()
  const toast = useToast()

  const selectable = (cards.data ?? []).filter((c) => c.active || c.id === item?.card_id)
  const categoryFor = (kind: RecurringKind) =>
    categories.data?.find((c) => c.name === (kind === 'service' ? 'Servicios' : 'Suscripciones'))
      ?.id ?? null
  const defaultCard = selectable.find((c) => c.kind === 'credit') ?? selectable[0]

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? '',
      kind: item?.kind ?? 'subscription',
      amount: item ? String(item.amount) : '',
      amount_is_estimate: item?.amount_is_estimate ?? false,
      card_id: item?.card_id ?? defaultCard?.id,
      category_id: item ? item.category_id : categoryFor('subscription'),
      active: item?.active ?? true,
      charged_this_period: false,
      ...scheduleDefaults(item),
    },
  })
  const { register, handleSubmit, control, formState, getValues, setValue } = form
  const kind = useWatch({ control, name: 'kind' })

  const onSubmit = handleSubmit((v) => {
    save.mutate(
      {
        id: item?.id,
        data: {
          name: v.name,
          kind: v.kind,
          amount: v.amount.replace(',', '.'),
          amount_is_estimate: v.kind === 'service' && v.amount_is_estimate,
          card_id: v.card_id,
          category_id: v.category_id,
          active: v.active,
          ...schedulePayload(v),
          starts_on: !item && v.charged_this_period ? `${todayISO().slice(0, 7)}-01` : undefined,
        },
      },
      {
        onSuccess: (saved) => {
          toast({
            title: item ? 'Cambios guardados' : `${saved.name} agregado`,
            description: saved.active
              ? `Próximo cobro: ${formatDayMonth(saved.next_run)}`
              : 'Pausado: no se va a cobrar',
          })
          onDone()
        },
      },
    )
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Segmented
              label="Tipo"
              value={field.value}
              options={KIND}
              onChange={(next) => {
                // Follow the kind with its default category unless the user picked another one.
                if (getValues('category_id') === categoryFor(field.value)) {
                  setValue('category_id', categoryFor(next))
                }
                field.onChange(next)
              }}
            />
          )}
        />
        <Field
          label="Nombre"
          placeholder={kind === 'service' ? 'CFE, Izzi, agua, gas…' : 'Netflix, Spotify, gimnasio…'}
          autoComplete="off"
          data-autofocus={item ? undefined : true}
          error={formState.errors.name?.message}
          {...register('name')}
        />
        <Field
          label={kind === 'service' ? 'Monto (aproximado si varía)' : 'Monto'}
          inputMode="decimal"
          className="num"
          error={formState.errors.amount?.message}
          {...register('amount')}
        />
        {kind === 'service' ? (
          <Controller
            control={control}
            name="amount_is_estimate"
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label="El monto cambia cada mes"
                description="Se carga como estimado y después lo ajustás con el recibo."
                tone="neutral"
              />
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="card_id"
          render={({ field, fieldState }) => (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-stone-700">Se cobra en</legend>
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
                  </button>
                ))}
              </div>
              {fieldState.error ? (
                <p className="text-sm text-red-700">{fieldState.error.message}</p>
              ) : null}
            </fieldset>
          )}
        />

        <ScheduleFields />

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
                        'flex h-11 items-center gap-2 rounded-xl border bg-white px-2 text-left text-sm',
                        active ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200',
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

        {item ? (
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label="Activo"
                description="Pausalo si lo cancelaste por un tiempo."
                tone="neutral"
              />
            )}
          />
        ) : (
          <Controller
            control={control}
            name="charged_this_period"
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={field.onChange}
                label="Ya me lo cobraron este mes"
                description="Registra los cobros de este mes cuya fecha ya pasó."
                tone="neutral"
              />
            )}
          />
        )}

        {save.error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
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
                if (
                  window.confirm(`¿Eliminar ${item.name}? Los cobros ya registrados se conservan.`)
                ) {
                  remove.mutate(item.id, {
                    onSuccess: () => {
                      toast({ title: `${item.name} eliminado` })
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
            {item ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
