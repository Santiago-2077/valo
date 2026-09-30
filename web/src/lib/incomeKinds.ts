import type { IncomeKind } from './types'

export const INCOME_KIND_LABEL: Record<IncomeKind, string> = {
  salary: 'Sueldo',
  freelance: 'Freelance',
  bonus: 'Bono',
  other: 'Otro',
}
