import { useFormContext, useWatch } from 'react-hook-form'
import { cn } from '../lib/cn'
import { FREQUENCY_LABEL, type ScheduleValues } from '../lib/schedule'
import type { Frequency } from '../lib/types'
import { Field, Segmented, Select } from './ui'

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(2026, i, 1)),
)

/** Frequency + day(s) + month, bound to the surrounding FormProvider. */
export function ScheduleFields({
  dayLabel = 'Día de cobro',
  frequencies = ['monthly', 'semimonthly', 'yearly'],
}: {
  dayLabel?: string
  frequencies?: Frequency[]
}) {
  const { register, control, setValue, formState } = useFormContext<ScheduleValues>()
  const frequency = useWatch({ control, name: 'frequency' })
  const errors = formState.errors

  return (
    <>
      <Segmented
        label="Frecuencia"
        value={frequency}
        onChange={(f) => {
          setValue('frequency', f, { shouldDirty: true })
          // Sensible default for a Mexican "quincena": 15th and month end.
          if (f === 'semimonthly') setValue('second_day', '31')
        }}
        options={
          Object.fromEntries(frequencies.map((f) => [f, FREQUENCY_LABEL[f]])) as Record<
            Frequency,
            string
          >
        }
      />
      <div
        className={cn(
          'grid gap-3',
          frequency === 'yearly' && 'grid-cols-[7rem_1fr]',
          frequency === 'semimonthly' && 'grid-cols-2',
        )}
      >
        <Field
          label={frequency === 'semimonthly' ? 'Primer día' : dayLabel}
          inputMode="numeric"
          className="num"
          hint={frequency === 'monthly' ? 'Si el mes es más corto, cae el último día.' : undefined}
          error={errors.day_of_month?.message}
          {...register('day_of_month')}
        />
        {frequency === 'semimonthly' ? (
          <Field
            label="Segundo día"
            inputMode="numeric"
            className="num"
            hint="31 = último día del mes"
            error={errors.second_day?.message}
            {...register('second_day')}
          />
        ) : null}
        {frequency === 'yearly' ? (
          <Select label="Mes" error={errors.month_of_year?.message} {...register('month_of_year')}>
            <option value="">Elegí…</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
    </>
  )
}
