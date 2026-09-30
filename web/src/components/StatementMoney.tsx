import { CheckCircle, Trash, WarningCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { cn } from '../lib/cn'
import { formatDayMonth, formatMoney, todayISO } from '../lib/format'
import { useAddPayment, useDeletePayment, useStatementCheck } from '../lib/queries'
import type { StatementDetail } from '../lib/types'
import { useToast } from './Toast'
import { Button } from './ui'

const moneyInput =
  'num h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-[15px] focus:border-stone-400 focus:outline-none'
const MONEY_RE = /^\d+([.,]\d{1,2})?$/

function Payments({ st }: { st: StatementDetail }) {
  const add = useAddPayment(st.card_id)
  const remove = useDeletePayment(st.card_id)
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const valid = MONEY_RE.test(amount.trim()) && Number(amount.replace(',', '.')) > 0
  // Once reconciled, the bank's figure is what you actually owe.
  const owed = st.bank_total ?? st.total
  const progress = owed > 0 ? Math.min(st.paid / owed, 1) : 0

  const submit = (value: string) =>
    add.mutate(
      { amount: value.replace(',', '.'), date, cycle: st.cycle },
      {
        onSuccess: (p) => {
          setAmount('')
          toast({ title: 'Pago registrado', description: `${formatMoney(p.amount)} al corte` })
        },
      },
    )

  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="font-medium">Pagos</h3>
        {st.settled ? (
          <span className="flex items-center gap-1 text-sm text-accent-700">
            <CheckCircle size={16} weight="fill" /> Pagado completo
          </span>
        ) : (
          <span className="text-sm text-stone-500">
            Falta <span className="num text-stone-900">{formatMoney(st.remaining)}</span>
          </span>
        )}
      </header>
      <div
        className="mb-4 h-1.5 overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-label="Pagado del corte"
        aria-valuemin={0}
        aria-valuemax={st.total}
        aria-valuenow={st.paid}
      >
        <div className="h-full rounded-full bg-chart-1" style={{ width: `${progress * 100}%` }} />
      </div>

      {st.payments.length ? (
        <ul className="mb-4 divide-y divide-stone-100 text-sm">
          {st.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span className="text-stone-600">{formatDayMonth(p.date)}</span>
              <span className="flex items-center gap-2">
                <span className="num">{formatMoney(p.amount)}</span>
                <button
                  type="button"
                  aria-label="Borrar pago"
                  onClick={() => {
                    if (window.confirm('¿Borrar este pago?')) remove.mutate(p.id)
                  }}
                  className="rounded p-1 text-stone-400 hover:text-red-700"
                >
                  <Trash size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!st.settled && owed > 0 ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) submit(amount)
          }}
        >
          <input
            aria-label="Monto del pago"
            inputMode="decimal"
            placeholder={`Monto (falta ${formatMoney(st.remaining)})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={moneyInput}
          />
          <input
            aria-label="Fecha del pago"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={moneyInput}
          />
          <Button type="submit" disabled={!valid} loading={add.isPending} className="h-10">
            Registrar
          </Button>
          <button
            type="button"
            onClick={() => submit(st.remaining.toFixed(2))}
            className="justify-self-start text-sm text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline sm:col-span-3"
          >
            {st.bank_total !== null ? 'Pagué el total del estado de cuenta' : 'Pagué el total'} (
            {formatMoney(st.remaining)})
          </button>
        </form>
      ) : null}
      {add.error ? <p className="mt-2 text-sm text-red-700">{add.error.message}</p> : null}
    </section>
  )
}

function Reconcile({ st }: { st: StatementDetail }) {
  const { save, clear } = useStatementCheck(st.card_id, st.cycle)
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(st.bank_total === null)
  const valid = MONEY_RE.test(value.trim())
  const diff = st.difference

  return (
    <section>
      <header className="mb-1">
        <h3 className="font-medium">Conciliar con el banco</h3>
        <p className="text-sm text-stone-500">
          Copiá el total del estado de cuenta y fijate si coincide con lo que anotaste.
        </p>
      </header>

      {diff !== null && !editing ? (
        <div
          className={cn(
            'mt-3 flex gap-3 rounded-2xl px-4 py-3',
            diff === 0 ? 'bg-accent-50' : 'bg-amber-50',
          )}
        >
          {diff === 0 ? (
            <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-accent-600" />
          ) : (
            <WarningCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-amber-600" />
          )}
          <div className="text-sm">
            {diff === 0 ? (
              <p className="font-medium text-stone-900">Cuadra al centavo.</p>
            ) : diff > 0 ? (
              <>
                <p className="font-medium text-stone-900">
                  El banco tiene <span className="num">{formatMoney(diff)}</span> más de lo que
                  anotaste.
                </p>
                <p className="mt-0.5 text-stone-600">
                  Te falta cargar algún gasto: buscá cargos del estado de cuenta que no estén en la
                  lista de abajo (intereses y comisiones también cuentan).
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-stone-900">
                  Anotaste <span className="num">{formatMoney(-diff)}</span> más que el banco.
                </p>
                <p className="mt-0.5 text-stone-600">
                  Revisá si hay un gasto duplicado, uno cargado con otra tarjeta o con fecha de otro
                  corte.
                </p>
              </>
            )}
            <p className="mt-2 text-[13px] text-stone-500">
              Banco <span className="num">{formatMoney(st.bank_total ?? 0)}</span> · Valo{' '}
              <span className="num">{formatMoney(st.total)}</span> ·{' '}
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => {
                  setValue(String(st.bank_total ?? ''))
                  setEditing(true)
                }}
              >
                corregir
              </button>{' '}
              ·{' '}
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => clear.mutate(undefined, { onSuccess: () => setEditing(true) })}
              >
                quitar
              </button>
            </p>
          </div>
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) {
              save.mutate(value.trim().replace(',', '.'), { onSuccess: () => setEditing(false) })
            }
          }}
        >
          <input
            aria-label="Total del estado de cuenta"
            inputMode="decimal"
            placeholder="Total del estado de cuenta"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={moneyInput}
          />
          <Button type="submit" variant="secondary" disabled={!valid} loading={save.isPending}>
            Comparar
          </Button>
        </form>
      )}
    </section>
  )
}

export function StatementMoney({ st }: { st: StatementDetail }) {
  return (
    <div className="mb-10 grid gap-8 rounded-3xl border border-stone-200 bg-white p-5 md:grid-cols-2 md:p-6">
      <Payments st={st} />
      <Reconcile key={`${st.cycle}-${st.bank_total}`} st={st} />
    </div>
  )
}
