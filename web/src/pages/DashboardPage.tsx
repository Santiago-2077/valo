import { PageHeader } from '../components/ui'

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Resumen" description="Lo que llevás gastado este ciclo." />
      <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-16 text-center">
        <p className="font-medium text-stone-700">Todavía no hay datos</p>
        <p className="mx-auto mt-1 max-w-[42ch] text-sm text-stone-500">
          Cuando cargues tarjetas y gastos vas a ver acá cuánto pagar en cada corte.
        </p>
      </div>
    </>
  )
}
