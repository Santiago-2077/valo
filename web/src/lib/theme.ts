import { useCallback, useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'valo:theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
}

/** Theme preference persisted per browser; "system" follows the OS live. */
export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(readPref)

  useEffect(() => {
    apply(pref)
    if (pref !== 'system') return
    const mq = media()
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  const setPref = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* storage unavailable: still apply for this session */
    }
    setPrefState(next)
  }, [])

  return { pref, setPref }
}
