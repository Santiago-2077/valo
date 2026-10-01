import { X } from '@phosphor-icons/react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  EASE_DRAWER,
  EASE_OUT,
  currentTranslateY,
  prefersReducedMotion,
  projectMomentum,
  releaseVelocity,
  rubberband,
} from '../lib/motion'
import { IconButton } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Skip the entrance (e.g. opened from a keyboard shortcut: never animate those). */
  instant?: boolean
}

const DRAG_THRESHOLD = 8 // px of travel before a press becomes a drag (taps stay taps)
const FLICK_VELOCITY = 0.45 // px/ms: a quick flick dismisses regardless of distance

const isSheet = () => window.matchMedia('(max-width: 767px)').matches

/** Keep receiving moves when the finger leaves the header; harmless if unavailable. */
function capture(e: ReactPointerEvent<HTMLElement>) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    /* pointer already gone (or synthetic) */
  }
}

/**
 * Native <dialog> (focus trap, Escape, top layer) that is a bottom sheet on mobile.
 * The sheet can be dragged down from its header; it follows the finger 1:1, inherits
 * the release velocity, and can be grabbed again mid-animation.
 */
export function Dialog({ open, onClose, title, children, instant = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  // Keep content mounted while the exit animation plays.
  const [rendered, setRendered] = useState(open)
  const closedByDrag = useRef(false)
  const drag = useRef<{
    pointerId: number
    startY: number
    origin: number
    active: boolean
    samples: { y: number; t: number }[]
  } | null>(null)

  if (open && !rendered) setRendered(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = prefersReducedMotion()

    // Includes ::backdrop animations; stale fills would otherwise outlive the dialog.
    const cancelAll = () => el.getAnimations({ subtree: true }).forEach((a) => a.cancel())

    if (open && el.open) {
      // Reopened while the exit was playing: reverse from where it is right now.
      const from = currentTranslateY(el)
      cancelAll()
      el.style.transform = ''
      if (from !== 0) {
        el.animate([{ transform: `translateY(${from}px)` }, { transform: 'translateY(0)' }], {
          duration: 260,
          easing: EASE_DRAWER,
        })
      }
      return
    }

    if (open && !el.open) {
      cancelAll()
      el.showModal()
      // showModal() focuses the first focusable (the close button); prefer the marked field.
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus()
      closedByDrag.current = false
      el.style.transform = ''
      if (instant) return
      const frames = reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : isSheet()
          ? [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }]
          : [
              { opacity: 0, transform: 'scale(0.97)' },
              { opacity: 1, transform: 'scale(1)' },
            ]
      el.animate(frames, {
        duration: reduced ? 150 : isSheet() ? 420 : 200,
        easing: isSheet() ? EASE_DRAWER : EASE_OUT,
      })
      try {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 250,
          easing: 'ease-out',
          pseudoElement: '::backdrop',
        })
      } catch {
        /* ::backdrop animation unsupported: it just appears */
      }
      return
    }

    if (!open && el.open) {
      const finish = () => {
        cancelAll()
        el.close()
        el.style.transform = ''
        setRendered(false)
      }
      // Already off-screen after a drag dismissal, or motion is reduced: close now.
      if (closedByDrag.current || reduced) return finish()
      const from = currentTranslateY(el)
      cancelAll()
      // Exit along the path it entered, faster than the entrance.
      const exit = isSheet()
        ? el.animate([{ transform: `translateY(${from}px)` }, { transform: 'translateY(100%)' }], {
            duration: 240,
            easing: EASE_DRAWER,
            fill: 'forwards',
          })
        : el.animate(
            [
              { opacity: 1, transform: 'scale(1)' },
              { opacity: 0, transform: 'scale(0.97)' },
            ],
            { duration: 150, easing: 'ease-out', fill: 'forwards' },
          )
      try {
        el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 200,
          fill: 'forwards',
          pseudoElement: '::backdrop',
        })
      } catch {
        /* unsupported */
      }
      // A cancelled exit (reopened mid-way) must not close the dialog.
      exit.finished.then(finish, () => {})
    }
  }, [open, instant])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isSheet() || drag.current || (e.target as HTMLElement).closest('button')) return
    const el = ref.current!
    // Grab it mid-flight: freeze any running animation at its on-screen position.
    const origin = currentTranslateY(el)
    el.getAnimations().forEach((a) => a.cancel())
    el.style.transform = `translateY(${origin}px)`
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      origin,
      active: origin !== 0,
      samples: [{ y: e.clientY, t: e.timeStamp }],
    }
    if (drag.current.active) capture(e)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return // ignore extra fingers
    const dy = e.clientY - d.startY
    if (!d.active) {
      if (Math.abs(dy) < DRAG_THRESHOLD) return
      d.active = true
      capture(e)
    }
    const el = ref.current!
    const offset = d.origin + dy
    // Down follows 1:1; up resists progressively instead of hitting a wall.
    const y = offset >= 0 ? offset : rubberband(offset, el.offsetHeight)
    el.style.transform = `translateY(${y}px)`
    d.samples.push({ y: e.clientY, t: e.timeStamp })
    if (d.samples.length > 8) d.samples.shift()
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    drag.current = null
    const el = ref.current!
    if (!d.active) return
    const y = currentTranslateY(el)
    const v = releaseVelocity(d.samples)
    const height = el.offsetHeight
    // Decide from where the gesture is going, not where it stopped.
    const dismiss = v > FLICK_VELOCITY || y + projectMomentum(v) > height * 0.5
    const target = dismiss ? height : 0
    const remaining = Math.abs(target - y)
    // Carry the finger's speed into the settle; slow releases get a calm default.
    const duration = Math.min(320, Math.max(160, remaining / Math.max(Math.abs(v), 0.9)))
    const settle = el.animate(
      [{ transform: `translateY(${y}px)` }, { transform: `translateY(${target}px)` }],
      { duration, easing: EASE_DRAWER, fill: 'forwards' },
    )
    settle.finished.then(
      () => {
        el.style.transform = `translateY(${target}px)`
        settle.cancel()
        if (dismiss) {
          closedByDrag.current = true
          onClose()
        } else {
          el.style.transform = ''
        }
      },
      () => {
        /* interrupted by a new grab: that gesture owns the position now */
      },
    )
  }

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl bg-bg p-0 text-fg shadow-[0_-8px_40px_-12px_var(--shadow)] will-change-transform backdrop:bg-scrim backdrop:backdrop-blur-[2px] md:m-auto md:max-w-lg md:rounded-3xl"
    >
      {rendered ? (
        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-7 md:pt-6 md:pb-7">
          {/* Drag zone: grabber + title. touch-action none so the browser doesn't scroll it. */}
          <div
            className="-mx-5 mb-5 touch-none px-5 pt-3 select-none md:mx-0 md:mb-5 md:touch-auto md:px-0 md:pt-0"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              aria-hidden
              className="mx-auto mb-3 h-1 w-10 cursor-grab rounded-full bg-border-strong active:cursor-grabbing md:hidden"
            />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <IconButton aria-label="Cerrar" onClick={onClose} className="-mr-2">
                <X size={18} />
              </IconButton>
            </div>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
