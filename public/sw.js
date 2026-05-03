// Service Worker — Centro Gas Paucara
// Archivo: public/sw.js

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

// Recibir notificación push
self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()

  const opciones = {
    body: data.cuerpo || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || 'centrogas',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || '/ventas' },
    actions: [
      { action: 'ver', title: 'Ver' },
      { action: 'cerrar', title: 'Cerrar' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.titulo || 'Centro Gas', opciones)
  )
})

// Al hacer click en la notificación
self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'cerrar') return

  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Si la app ya está abierta, enfocarla
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Si no está abierta, abrirla
      return clients.openWindow(url)
    })
  )
})
