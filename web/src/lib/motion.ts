/** Motion primitives shared by sheets, toasts and navigation. */

/** Strong ease-out for entrances and feedback. */
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
/** iOS-like sheet curve: fast start, long gentle settle. */
export const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)'

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Where a flick would come to rest, like scroll deceleration
 * (Apple, "Designing Fluid Interfaces"). Velocity in px/ms.
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return (velocity * decelerationRate) / (1 - decelerationRate)
}

/** Progressive resistance past a boundary: the further you pull, the less it follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/** The element's live on-screen translateY, so interrupted motion starts where it is. */
export function currentTranslateY(el: HTMLElement): number {
  const transform = getComputedStyle(el).transform
  if (!transform || transform === 'none') return 0
  return new DOMMatrixReadOnly(transform).m42
}

/** Velocity (px/ms) from the last ~80ms of pointer samples. */
export function releaseVelocity(samples: { y: number; t: number }[]): number {
  const last = samples[samples.length - 1]
  if (!last) return 0
  const first = samples.find((s) => last.t - s.t <= 80) ?? last
  const dt = last.t - first.t
  return dt > 0 ? (last.y - first.y) / dt : 0
}

/**
 * CSS animation for content that just stepped forward/back through an ordered value
 * (YYYY-MM months or cycles). Arrives from the side you moved toward; none on first render.
 */
export function stepAnimation(previous: string | undefined, current: string): string | undefined {
  if (!previous || previous === current) return undefined
  const name = current > previous ? 'nudge-from-right' : 'nudge-from-left'
  return `${name} 180ms ${EASE_OUT}`
}
