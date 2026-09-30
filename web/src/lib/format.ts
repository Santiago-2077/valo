const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const moneyShortFmt = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

export const formatMoney = (n: number) => moneyFmt.format(n)
export const formatMoneyShort = (n: number) => moneyShortFmt.format(n)

/** Parse an ISO yyyy-mm-dd as a local date (not UTC midnight, which shifts a day in MX). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const todayISO = () => toISODate(new Date())

const dayMonthFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
const longDayFmt = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const monthYearFmt = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })

export const formatDayMonth = (iso: string) => dayMonthFmt.format(parseISODate(iso))
export const formatLongDay = (iso: string) => longDayFmt.format(parseISODate(iso))

/** 'YYYY-MM' → 'octubre 2026' */
export const formatCycle = (cycle: string) => monthYearFmt.format(parseISODate(`${cycle}-01`))

export function daysUntil(iso: string, from = new Date()): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((parseISODate(iso).getTime() - start.getTime()) / 86_400_000)
}

export function monthRange(month: string): { from: string; to: string } {
  const start = parseISODate(`${month}-01`)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
  return { from: toISODate(start), to: toISODate(end) }
}

export function shiftMonth(month: string, delta: number): string {
  const d = parseISODate(`${month}-01`)
  return toISODate(new Date(d.getFullYear(), d.getMonth() + delta, 1)).slice(0, 7)
}

export function dueLabel(dueISO: string, from = new Date()): string {
  const days = daysUntil(dueISO, from)
  if (days < 0) return 'vencido'
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  return `en ${days} días`
}
