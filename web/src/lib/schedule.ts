import { z } from 'zod'
import type { Frequency } from './types'

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  monthly: 'Mensual',
  semimonthly: 'Quincenal',
  yearly: 'Anual',
}

/** Form fields for a repeating schedule; inputs are strings, converted on submit. */
export const scheduleShape = {
  frequency: z.enum(['monthly', 'semimonthly', 'yearly']),
  day_of_month: z.string(),
  second_day: z.string(),
  month_of_year: z.string(),
}

export type ScheduleValues = {
  frequency: Frequency
  day_of_month: string
  second_day: string
  month_of_year: string
}

const validDay = (v: string) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 31

export function refineSchedule(v: ScheduleValues, ctx: z.RefinementCtx) {
  if (!validDay(v.day_of_month)) {
    ctx.addIssue({ code: 'custom', path: ['day_of_month'], message: 'Día 1–31' })
  }
  if (v.frequency === 'semimonthly') {
    if (!validDay(v.second_day)) {
      ctx.addIssue({ code: 'custom', path: ['second_day'], message: 'Día 1–31' })
    } else if (v.second_day === v.day_of_month) {
      ctx.addIssue({ code: 'custom', path: ['second_day'], message: 'Tiene que ser otro día' })
    }
  }
  if (v.frequency === 'yearly' && !v.month_of_year) {
    ctx.addIssue({ code: 'custom', path: ['month_of_year'], message: 'Elegí el mes' })
  }
}

export function schedulePayload(v: ScheduleValues) {
  return {
    frequency: v.frequency,
    day_of_month: Number(v.day_of_month),
    second_day: v.frequency === 'semimonthly' ? Number(v.second_day) : null,
    month_of_year: v.frequency === 'yearly' ? Number(v.month_of_year) : null,
  }
}

export function scheduleDefaults(item?: {
  frequency: Frequency
  day_of_month: number
  second_day: number | null
  month_of_year: number | null
}): ScheduleValues {
  return {
    frequency: item?.frequency ?? 'monthly',
    day_of_month: item ? String(item.day_of_month) : '',
    second_day: item?.second_day ? String(item.second_day) : '',
    month_of_year: item?.month_of_year ? String(item.month_of_year) : '',
  }
}

const monthShort = new Intl.DateTimeFormat('es-MX', { month: 'short' })

export function scheduleLabel(item: {
  frequency: Frequency
  day_of_month: number
  second_day: number | null
  month_of_year: number | null
}): string {
  if (item.frequency === 'yearly' && item.month_of_year) {
    const month = monthShort.format(new Date(2026, item.month_of_year - 1, 1)).replace('.', '')
    return `cada año, ${item.day_of_month} ${month}`
  }
  if (item.frequency === 'semimonthly' && item.second_day) {
    const [a, b] = [item.day_of_month, item.second_day].sort((x, y) => x - y)
    return `quincenal, días ${a} y ${b >= 28 ? 'último' : b}`
  }
  return `cada mes, día ${item.day_of_month}`
}
