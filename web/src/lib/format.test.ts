import { describe, expect, it } from 'vitest'
import {
  daysUntil,
  formatCycle,
  monthlyPreview,
  monthRange,
  parseISODate,
  shiftMonth,
} from './format'

describe('format', () => {
  it('parses ISO dates as local dates', () => {
    const d = parseISODate('2026-10-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 1])
  })

  it('computes month ranges including leap February', () => {
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })

  it('shifts months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('counts days until a date', () => {
    expect(daysUntil('2026-10-10', new Date(2026, 9, 1, 23, 30))).toBe(9)
  })

  it('formats cycles in Spanish', () => {
    expect(formatCycle('2026-10')).toBe('octubre de 2026')
  })

  it('previews installments like the API splits them', () => {
    expect(monthlyPreview(1000, 3)).toBe(333.33)
    expect(monthlyPreview(18000, 12)).toBe(1500)
    // 0.29 * 100 = 28.999999999999996 in floats; integer cents avoid the off-by-one
    expect(monthlyPreview(0.29, 1)).toBe(0.29)
  })
})
