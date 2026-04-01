const CACHE = "doit-shell-v1"

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((res) => {
        try {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        } catch {
          /* ignore cache write errors */
        }
        return res
      })
      .catch(() =>
        caches.match(request).then((r) => r || caches.match(new Request("/offline")))
      )
  )
})
