# Valo — Design System (MASTER)

Fuente de verdad visual. Las páginas pueden sobreescribir reglas en `pages/<página>.md`; si no existe, rige este archivo.

**Producto:** app de finanzas personales self-hosted, uso diario en desktop y móvil, español (MX), un usuario joven aprendiendo a manejar su dinero.
**Stack:** React 19 + Vite + Tailwind v4 (tokens en `@theme`, `web/src/index.css`).

## Dirección

| Decisión | Elección | Origen |
|---|---|---|
| Estilo | **Fintech celeste** (familia del azul de Twitter `#1DA1F2`), plano y sobrio: datos primero, sin glassmorphism ni gradientes de relleno | Elegido por el usuario; `ui-ux-pro-max` → producto "Banking/Traditional Finance" y estilo "financial-dashboard" |
| Modo | **Claro + oscuro automático** (`prefers-color-scheme`), con override manual en Ajustes | Elegido por el usuario; la base recomienda dark para finance trackers |
| Tipografía | **Geist** (UI) + **Geist Mono** con `tabular-nums` (todo monto) | Equivalente a la pareja "Dashboard Data" (sans + mono) de la base; se descartó Caveat/Quicksand (manuscrita) |
| Grises | **Slate** (fríos) en toda la app; nunca mezclar con stone/zinc | Coherencia de temperatura con el azul |
| Densidad | Estándar (6/10): espaciado 16–48px, listas con separadores en vez de tarjetas | Dials `--density 6 --variance 4 --motion 3` |

## Tokens de color

Los componentes **solo** usan tokens semánticos (`bg-surface`, `text-muted`…), nunca hex ni escalas crudas. Contraste verificado con WCAG (texto ≥ 4.5:1 sobre `bg` y `surface`) y marcas de dato con el validador de `dataviz`.

Implementación: `web/src/index.css` define los valores en **OKLCH** (`:root` y `:root.dark`) y los expone a Tailwind con `@theme inline`. Los hex de abajo son la referencia de verificación; los neutros se tiñen hacia el azul (hue ≈ 250) y `surface` es casi blanco, nunca `#fff`. El tema lo aplica un script en `index.html` antes del primer paint (`localStorage['valo:theme']`: `system` | `light` | `dark`).

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `bg` | `#f8fafc` | `#0b1120` | Fondo de página (nunca blanco puro ni negro puro) |
| `surface` | `#ffffff` | `#111a2e` | Diálogos, paneles, inputs |
| `surface-2` | `#f1f5f9` | `#172036` | Hover de filas, segmented controls, tracks de barras |
| `border` | `#e2e8f0` | `#24304a` | Separadores y bordes |
| `text` | `#0f172a` (17.1:1) | `#e2e8f0` (15.3:1) | Texto principal y montos |
| `text-2` | `#475569` (7.2:1) | `#a3b0c2` (8.6:1) | Texto secundario |
| `muted` | `#64748b` (4.6:1) | `#8a97ab` (6.4:1) | Hints, metadatos. **Mínimo permitido para texto** |
| `primary` | `#0978BD` | `#1DA1F2` | Botón principal, links, foco, selección. En claro no se usa `#1DA1F2` porque el blanco encima da 2.8:1 |
| `on-primary` | casi blanco (4.65:1) | `#0b1120` (6.7:1) | Texto sobre `primary` |
| `positive` | `#15803d` | `#4ade80` | Texto: te sobra, pagado, cuadra, ingresos |
| `negative` | `#b91c1c` | `#f87171` | Texto: te falta, te pasaste, error |
| `warning` | `#b45309` | `#fbbf24` | Texto: por pagar, cerca del tope, impulsivo |
| `*-soft` | tintes claros | tintes oscuros | Fondo de badges y avisos (`positive-soft`, `warning-soft`, `negative-soft`, `primary-soft`) |
| `track` | `#e2e8f0` | `#24304a` | Fondo de barras de progreso y segmented controls |
| `inverse` / `on-inverse` | slate-900 / slate-100 | slate-200 / bg | Toasts y tooltips |
| `brand-panel` | `#1DA1F2` con texto `#0f1419` (6.6:1) | `#0c3550` con texto claro | Panel de marca del login: el único lugar con el celeste de Twitter puro en modo claro |

**Marcas de dato** (barras, progreso, gráficos; contraste ≥ 3:1 sobre `surface`, banda de luminosidad y croma OK por modo):

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `chart-1` | `#1A8FD9` | `#1a96e3` | Serie única, **progreso normal** (presupuesto con margen, pagado parcial) |
| `mark-positive` | `#16a34a` | `#16a34a` | Reservado para confirmaciones puntuales; no pinta progreso normal |
| `mark-warning` | `#d97706` | `#d97706` | Cerca del tope (≥ 80%) |
| `mark-negative` | `#dc2626` | `#ef4444` | Pasado del tope |

> Los colores de estado son **reservados**: no se reutilizan como "serie 2" ni como color de categoría. Verde y ámbar quedan cerca para protanopia (ΔE ≈ 6), así que **todo estado lleva ícono y texto** ("Te pasaste $150 (130%)"), nunca solo color.

Los colores de **categoría** (elegidos por el usuario) se usan solo en el ícono de la categoría, a 10% de opacidad de fondo, nunca para texto.

## Tipografía

| Rol | Estilo |
|---|---|
| Hero (un número por vista) | Geist Mono 48px, `tracking-tight`, peso 500 |
| H1 de página | Geist 24px / 600 / `tracking-tight` |
| H2 de sección | Geist 16px / 500 |
| Body | Geist 15–16px / 400 / line-height 1.5 |
| Meta / hints | Geist 13px, color `muted` |
| Mínimo absoluto | **12px** (nada de 11px) |
| Montos | Siempre `.num` (Geist Mono + `tabular-nums`) y `Intl.NumberFormat('es-MX', MXN)` |

## Componentes base

- **Botón primario** (`Button`): `bg-primary`. Es lo único con azul relleno, una acción principal por vista.
- **Seleccionado** (chips, tiles, opciones): `border-primary bg-primary-soft text-fg ring-1 ring-primary`. Mismo lenguaje en todos los controles.
- **Segmented**: track `bg-track`, opción activa `bg-surface` con sombra suave.
- **IconButton**: 44×44 (`size-11`), glyph 15–20px, `aria-label` obligatorio; usar margen negativo para alinear ópticamente.
- **CardSwatch**: rectángulo 28×20 con el color de la tarjeta para identificarla. Reemplaza las barritas laterales de color (prohibidas).
- **Puntos de color del usuario**: `ring-1 ring-fg/15` para que colores oscuros no desaparezcan en modo oscuro.

## Interacción y accesibilidad (obligatorio)

- **Objetivos táctiles ≥ 44×44px** (botones de ícono: `size-11` en móvil; el ícono puede ser de 18–20px).
- **`cursor: pointer`** en todo lo clickeable (Tailwind v4 lo quitó de `button` por defecto).
- Foco visible: `outline-2 outline-offset-2` con `primary`; nunca `outline-none` sin reemplazo.
- Botones solo-ícono con `aria-label`; íconos decorativos con `aria-hidden`.
- Inputs de dinero: `inputMode="decimal"`; días: `inputMode="numeric"`; label siempre visible arriba, error debajo.
- Estados completos en cada vista: skeleton del tamaño del contenido, empty state con acción, error inline con reintentar.
- Feedback táctil: `active:scale-[0.98]` en botones; transiciones 150–300ms, `ease-out-soft`; salida más rápida que entrada.
- `prefers-reduced-motion`: animaciones a 1ms (ya implementado).
- Navegación inferior móvil: **máximo 5 ítems** (4 + botón central). El resto en el header.

## Gráficos

- Una serie → barras/columnas de un solo color (`chart-1`), máx. 24px de ancho, tope redondeado 4px, sin leyenda; etiqueta directa solo en el valor actual y en el máximo; tooltip al hover/foco; tabla `sr-only`.
- Gasto por categoría → **barras horizontales ordenadas descendente** con etiqueta directa. Dona solo con ≤ 5 categorías y siempre con %.
- Presupuesto vs real → barra de progreso: `chart-1` con margen, `mark-warning` desde 80%, `mark-negative` al pasarse; track `track`; siempre con texto de estado.
- Nunca: ejes dobles, arcoíris, información solo por color, número en cada punto.

## Anti-patrones

- Glassmorphism, gradientes de relleno en texto o tarjetas, glows.
- Texto gris claro bajo 4.5:1 (el viejo `stone-400`).
- Tarjetas dentro de tarjetas; tarjetas donde alcanza un separador.
- Emojis como íconos (se usan Phosphor, trazo regular).
- Mezclar grises cálidos y fríos.
- Hex sueltos en componentes (excepto las paletas que el usuario elige para tarjetas y categorías).
- Barritas laterales de color (`w-1.5` o `border-left` grueso) como acento.
- Rayas largas (—) en textos de la interfaz.

## Checklist antes de entregar una pantalla

- [ ] Solo tokens semánticos; se ve bien en claro **y** oscuro
- [ ] Texto ≥ 12px y ≥ 4.5:1; montos en `.num`
- [ ] Objetivos táctiles ≥ 44px, `cursor-pointer`, foco visible
- [ ] Estados loading / empty / error
- [ ] Estados de dinero con ícono + texto, no solo color
- [ ] Responsive 375 / 768 / 1024 / 1440 sin scroll horizontal
