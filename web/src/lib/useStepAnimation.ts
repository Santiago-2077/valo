import { useEffect, useMemo, useRef } from 'react'
import { stepAnimation } from './motion'

/**
 * Directional nudge for content keyed by an ordered value (YYYY-MM). Computed once per
 * change, so unrelated re-renders (data arriving) don't cut the animation short.
 */
export function useStepAnimation(value: string): string | undefined {
  const previous = useRef<string | undefined>(undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const animation = useMemo(() => stepAnimation(previous.current, value), [value])
  useEffect(() => {
    previous.current = value
  }, [value])
  return animation
}
