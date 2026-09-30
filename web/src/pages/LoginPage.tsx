import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router'
import { z } from 'zod'
import { Button, Field } from '../components/ui'
import { useLogin, useMe } from '../lib/auth'

const schema = z.object({
  username: z.string().min(1, 'Ingresá tu usuario'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { data: user } = useMe()
  const login = useLogin()
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  if (user) return <Navigate to="/" replace />

  return (
    <div className="grid min-h-[100dvh] md:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-stone-900 p-12 text-stone-100 md:flex">
        <span className="text-[17px] font-semibold tracking-tight">valo</span>
        <div className="max-w-md">
          <p className="text-3xl leading-tight font-medium tracking-tight text-balance">
            Sabé qué cae en cada resumen antes de que llegue el corte.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-stone-400">
            Tarjetas, meses sin intereses, suscripciones y servicios en un solo lugar, corriendo en
            tu propio servidor.
          </p>
        </div>
        <span className="num text-xs text-stone-500">self-hosted</span>
      </section>

      <section className="flex items-center px-6 py-12 md:px-16">
        <form
          onSubmit={handleSubmit((v) => login.mutate(v))}
          className="grid w-full max-w-sm gap-5"
          noValidate
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-stone-500">Entrá con el usuario de tu instancia.</p>
          </div>
          <Field
            label="Usuario"
            autoComplete="username"
            autoCapitalize="none"
            error={formState.errors.username?.message}
            {...register('username')}
          />
          <Field
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            error={formState.errors.password?.message}
            {...register('password')}
          />
          {login.error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {login.error.message}
            </p>
          ) : null}
          <Button type="submit" loading={login.isPending} className="h-11">
            Entrar
          </Button>
        </form>
      </section>
    </div>
  )
}
