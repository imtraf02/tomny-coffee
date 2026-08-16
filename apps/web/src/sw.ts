/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision?: string }> }
self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(new NavigationRoute(new NetworkFirst({ cacheName: 'tomny-pages', networkTimeoutSeconds: 3 }), { allowlist: [/^\/pos/, /^\/login/] }))
registerRoute(({ request, url }) => request.method === 'GET' && url.pathname.startsWith('/assets/'), new CacheFirst({ cacheName: 'tomny-assets' }))
