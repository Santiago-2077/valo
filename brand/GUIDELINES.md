# Valo · Guía de marca

## Idea

**Renglones.** Una V cortada en tres renglones: las líneas de un estado de cuenta que cierran en un solo punto. Muchos movimientos, un total que cuadra. El wordmark lleva la **o cuadrada**: *que te cuadren las cuentas*.

## Piezas

| Pieza | Archivo | Uso |
|---|---|---|
| Logo horizontal (color) | `masters/valo-horizontal-color.svg` | Uso principal sobre fondos claros |
| Logo horizontal (oscuro) | `masters/valo-horizontal-dark.svg` | Sobre fondos oscuros |
| Logo apilado | `masters/valo-stacked.svg` | Espacios cuadrados o verticales |
| Símbolo | `masters/valo-symbol.svg` | Ícono de app, avatar, ≥ 48 px |
| Símbolo, corte chico | `masters/valo-symbol-small.svg` | 16–32 px (favicon). Un solo renglón para que no se empaste |
| Wordmark | `masters/valo-wordmark.svg` | Cuando el símbolo ya está presente cerca |
| Un color / invertido | `variants/` | Grabados, sellos, fondos de foto |
| Web / PWA | `web/` | favicon.ico/svg, apple-touch-icon, icon-192/512, maskable-512, manifest |

En la app, el logo es el componente `web/src/components/Logo.tsx` (generado desde los masters; el símbolo usa el token `--logo` y el wordmark el color de texto, así sigue el tema).

## Color

| Nombre | HEX | RGB | Uso |
|---|---|---|---|
| Azul Valo | `#1896E2` | 24 150 226 | Símbolo sobre claro; fondo del ícono de app (blanco encima 3.2:1) |
| Celeste puro | `#1DA1F2` | 29 161 242 | Símbolo sobre oscuro (6.7:1) |
| Tinta | `#0F172A` | 15 23 42 | Wordmark sobre claro |
| Niebla | `#E2E8F0` | 226 232 240 | Wordmark sobre oscuro |

El texto de interfaz no usa estos azules: usa `#0978BD` (claro) para cumplir 4.5:1. Ver `design-system/valo/MASTER.md`.

## Construcción

- Lienzo del símbolo 256×256; V de trazo constante, base plana de 56, **todas las diagonales a 70°**.
- Tres bandas con cortes de 20; el corte chico usa dos bandas con un corte de 28.
- Wordmark geométrico: altura x 100, trazo 28–30, `a` de un solo piso redonda frente a la `o` cuadrada (radio 30, contraforma radio 6). Espaciado óptico: v→a 4, a→l 14, l→o 20.
- Logo horizontal: el símbolo mide de la ascendente de la `l` a la línea base; separación = media altura x.

## Área de respeto y tamaños mínimos

- Área libre alrededor del logo: **la altura de un renglón del símbolo** (≈ 1/4 de su alto) en todos los lados.
- Logo horizontal: mínimo **96 px** de ancho en pantalla, 25 mm impreso.
- Símbolo: mínimo **16 px** (usar el corte chico hasta 32 px).

## Fondos permitidos

- Claro: símbolo `#1896E2` + wordmark `#0F172A`.
- Oscuro: símbolo `#1DA1F2` + wordmark `#E2E8F0`.
- Sobre azul Valo o fotos: versión blanca completa (`variants/valo-white.svg`).

## No hacer

- No rotar, inclinar, deformar ni cambiar el ángulo de las diagonales.
- No cambiar la cantidad o el ancho de los renglones (salvo el corte chico ya definido).
- No usar degradados, sombras, contornos ni efectos de vidrio.
- No poner el símbolo azul sobre fondo azul ni sobre fotos con poco contraste.
- No redondear la `o` del wordmark ni reemplazar el wordmark por una tipografía.
- No combinar el logo con otros símbolos dentro de su área de respeto.

## Notas

- Las formas están construidas como trazados propios (sin fuentes con licencia).
- No se hizo búsqueda de marca registrada; si Valo se publica como producto, conviene una búsqueda profesional antes.
