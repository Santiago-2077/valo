import { useState } from 'react'
import { formatMoney, formatMoneyShort, parseISODate } from '../lib/format'
import type { MonthCommitment } from '../lib/types'

const monthShort = new Intl.DateTimeFormat('es-MX', { month: 'short' })
const monthLong = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })

const PLOT_HEIGHT = 150
const LABEL_SPACE = 22
const AXIS_SPACE = 28

/** Monthly installment commitment: one series, columns from a shared baseline. */
export function CommitmentChart({ data }: { data: MonthCommitment[] }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.total), 0)
  const maxIndex = data.findIndex((d) => d.total === max && max > 0)

  if (max === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        Sin cuotas pendientes en los próximos meses.
      </p>
    )
  }

  return (
    <figure>
      <div
        className="relative grid items-end gap-0"
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
        onMouseLeave={() => setActive(null)}
      >
        {data.map((d, i) => {
          const height = d.total > 0 ? Math.max((d.total / max) * PLOT_HEIGHT, 4) : 0
          const labeled = i === 0 || i === maxIndex
          const date = parseISODate(`${d.month}-01`)
          return (
            <button
              key={d.month}
              type="button"
              className="group relative flex flex-col items-center outline-none"
              style={{ height: LABEL_SPACE + PLOT_HEIGHT + AXIS_SPACE }}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${monthLong.format(date)}: ${formatMoney(d.total)}`}
            >
              <div
                className="relative flex w-full flex-col items-center justify-end"
                style={{ height: LABEL_SPACE + PLOT_HEIGHT }}
              >
                {labeled && active === null ? (
                  <span
                    className="num absolute text-[12px] text-fg-2"
                    style={{ bottom: height + 6 }}
                  >
                    {formatMoneyShort(d.total)}
                  </span>
                ) : null}
                <div
                  className="w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity duration-150"
                  style={{
                    height,
                    opacity: active === null || active === i ? 1 : 0.35,
                  }}
                />
              </div>
              <span
                className={`flex h-7 items-end text-[12px] ${i === 0 ? 'font-medium text-fg' : 'text-muted'}`}
              >
                {monthShort.format(date).replace('.', '')}
              </span>
              {active === i ? (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg bg-inverse px-2.5 py-1.5 text-left whitespace-nowrap text-on-inverse shadow-lg"
                >
                  <span className="block text-xs text-on-inverse/75 first-letter:uppercase">
                    {monthLong.format(date)}
                  </span>
                  <span className="num block text-sm">{formatMoney(d.total)}</span>
                  <span className="block text-xs text-on-inverse/75">
                    {d.plans} {d.plans === 1 ? 'compra' : 'compras'}
                  </span>
                </span>
              ) : null}
            </button>
          )
        })}
        <div className="pointer-events-none absolute inset-x-0 bottom-7 h-px bg-border-strong" />
      </div>
      <table className="sr-only">
        <caption>Cuotas a meses por mes de pago</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Monto</th>
            <th>Compras</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <td>{monthLong.format(parseISODate(`${d.month}-01`))}</td>
              <td>{formatMoney(d.total)}</td>
              <td>{d.plans}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
