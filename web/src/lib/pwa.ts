import { registerSW } from 'virtual:pwa-register'

/** Service worker: installs the app shell. Browsers only allow it on HTTPS or localhost. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  registerSW({ immediate: true })
}
