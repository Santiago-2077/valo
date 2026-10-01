import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button, Field, PageHeader, Segmented } from '../components/ui'
import { useChangePassword } from '../lib/auth'
import { type ThemePref, useTheme } from '../lib/theme'

const THEME_LABEL: Record<ThemePref, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
}

const schema = z
  .object({
    current_password: z.string().min(1, 'Requerido'),
    new_password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, {
    path: ['confirm'],
    message: 'No coincide con la nueva contraseña',
  })
type FormValues = z.infer<typeof schema>

export function SettingsPage() {
  const change = useChangePassword()
  const theme = useTheme()
  const { register, handleSubmit, formState, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  return (
    <>
      <PageHeader title="Ajustes" />
      <section className="mb-10 grid gap-8 border-t border-border pt-8 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="font-medium">Apariencia</h2>
          <p className="mt-1 text-sm text-muted">
            “Sistema” sigue el modo claro u oscuro de tu dispositivo.
          </p>
        </div>
        <div className="max-w-md">
          <Segmented
            label="Tema"
            value={theme.pref}
            onChange={theme.setPref}
            options={THEME_LABEL}
          />
        </div>
      </section>
      <section className="grid gap-8 border-t border-border pt-8 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="font-medium">Contraseña</h2>
          <p className="mt-1 text-sm text-muted">Usá una que no uses en otro lado.</p>
        </div>
        <form
          noValidate
          className="grid max-w-md gap-5"
          onSubmit={handleSubmit(({ current_password, new_password }) =>
            change.mutate({ current_password, new_password }, { onSuccess: () => reset() }),
          )}
        >
          <Field
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            error={formState.errors.current_password?.message}
            {...register('current_password')}
          />
          <Field
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            error={formState.errors.new_password?.message}
            {...register('new_password')}
          />
          <Field
            label="Repetir nueva contraseña"
            type="password"
            autoComplete="new-password"
            error={formState.errors.confirm?.message}
            {...register('confirm')}
          />
          {change.error ? (
            <p role="alert" className="text-sm text-negative">
              {change.error.message}
            </p>
          ) : null}
          {change.isSuccess ? (
            <p role="status" className="text-sm text-positive">
              Contraseña actualizada.
            </p>
          ) : null}
          <Button type="submit" loading={change.isPending} className="justify-self-start">
            Guardar
          </Button>
        </form>
      </section>
    </>
  )
}
