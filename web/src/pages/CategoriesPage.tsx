import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { BudgetList } from '../components/BudgetList'
import { CategoryIcon } from '../components/CategoryIcon'
import { CATEGORY_ICONS } from '../lib/categoryIcons'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'
import { Button, EmptyState, ErrorState, Field, PageHeader, Skeleton } from '../components/ui'
import { cn } from '../lib/cn'
import { formatMoney } from '../lib/format'
import { useCategories, useDeleteCategory, useMonthInsights, useSaveCategory } from '../lib/queries'
import type { Category } from '../lib/types'

const COLORS = [
  '#c2410c',
  '#4d7c0f',
  '#0369a1',
  '#a21caf',
  '#6d28d9',
  '#b45309',
  '#be123c',
  '#0f766e',
  '#57534e',
  '#78716c',
]

const schema = z.object({
  name: z.string().trim().min(1, 'Poné un nombre').max(40),
  icon: z.string(),
  color: z.string(),
  monthly_budget: z.string().regex(/^(\d+([.,]\d{1,2})?)?$/, 'Monto inválido'),
})
type FormValues = z.infer<typeof schema>

function CategoryForm({ category, onDone }: { category?: Category; onDone: () => void }) {
  const save = useSaveCategory()
  const remove = useDeleteCategory()
  const toast = useToast()
  const { register, handleSubmit, control, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      icon: category?.icon ?? 'tag',
      color: category?.color ?? COLORS[0],
      monthly_budget: category?.monthly_budget?.toString() ?? '',
    },
  })

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      {
        id: category?.id,
        data: {
          ...v,
          monthly_budget: v.monthly_budget ? Number(v.monthly_budget.replace(',', '.')) : null,
        },
      },
      { onSuccess: onDone },
    ),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <Field label="Nombre" error={formState.errors.name?.message} {...register('name')} />
      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-700">Ícono</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={field.value === key}
                  onClick={() => field.onChange(key)}
                  className={cn(
                    'grid size-10 place-items-center rounded-xl border bg-white',
                    field.value === key
                      ? 'border-stone-900 ring-1 ring-stone-900'
                      : 'border-stone-200',
                  )}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </fieldset>
        )}
      />
      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-700">Color</legend>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={field.value === c}
                  onClick={() => field.onChange(c)}
                  className={cn(
                    'size-8 rounded-full ring-offset-2 ring-offset-stone-50',
                    field.value === c && 'ring-2 ring-stone-900',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </fieldset>
        )}
      />
      <Field
        label="Presupuesto mensual (opcional)"
        inputMode="decimal"
        className="num"
        hint="Tope que te ponés para esta categoría."
        error={formState.errors.monthly_budget?.message}
        {...register('monthly_budget')}
      />
      {save.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {save.error.message}
        </p>
      ) : null}
      <div className="flex gap-3">
        {category ? (
          <Button
            type="button"
            variant="secondary"
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm(`¿Eliminar ${category.name}? Sus gastos quedan sin categoría.`)) {
                remove.mutate(category.id, {
                  onSuccess: () => {
                    toast({ title: 'Categoría eliminada' })
                    onDone()
                  },
                })
              }
            }}
          >
            Eliminar
          </Button>
        ) : null}
        <Button type="submit" loading={save.isPending} className="h-12 flex-1">
          {category ? 'Guardar cambios' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}

export function CategoriesPage() {
  const categories = useCategories()
  const insights = useMonthInsights()
  const [editing, setEditing] = useState<{ category?: Category } | null>(null)
  const categoryById = useMemo(
    () => new Map(categories.data?.map((c) => [c.id, c])),
    [categories.data],
  )
  const hasBudgets = Boolean(insights.data?.categories.some((c) => c.budget))

  return (
    <>
      <PageHeader
        title="Categorías"
        description="Agrupá tus gastos y ponele tope a cada una."
        actions={
          <Button variant="secondary" onClick={() => setEditing({})}>
            <Plus size={16} weight="bold" /> Nueva
          </Button>
        }
      />
      {categories.error ? (
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      ) : categories.isPending ? (
        <Skeleton className="h-64" />
      ) : categories.data.length === 0 ? (
        <EmptyState title="Sin categorías" description="Creá la primera para ordenar tus gastos." />
      ) : (
        <>
          {hasBudgets && insights.data ? (
            <section className="mb-10">
              <h2 className="mb-4 font-medium">
                Este mes{' '}
                <span className="num text-sm font-normal text-stone-500">
                  · {formatMoney(insights.data.budget_spent)} de{' '}
                  {formatMoney(insights.data.budget_total)} presupuestados
                </span>
              </h2>
              <BudgetList rows={insights.data.categories} categories={categoryById} />
            </section>
          ) : null}
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {categories.data.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ category: c })}
                  className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-stone-100"
                >
                  <CategoryIcon icon={c.icon} color={c.color} />
                  <span className="flex-1 text-[15px]">{c.name}</span>
                  <span className="num text-sm text-stone-500">
                    {c.monthly_budget ? `${formatMoney(c.monthly_budget)} / mes` : 'Sin tope'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.category ? 'Editar categoría' : 'Nueva categoría'}
      >
        {editing ? (
          <CategoryForm
            key={editing.category?.id ?? 'new'}
            category={editing.category}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
    </>
  )
}
