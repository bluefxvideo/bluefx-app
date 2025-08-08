const CACHE_NAME = 'bluefx-ai-v1'
const urlsToCache = [
  '/',
  '/dashboard',
  '/login',
  '/admin',
  '/manifest.json'
]

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker installing...')
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache')
        return cache.addAll(urlsToCache)
      })
      .catch(error => {
        console.error('Failed to cache resources:', error)
      })
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests and external URLs
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return
  }

  // Skip Supabase API calls and auth requests
  if (event.request.url.includes('/') || 
      event.request.url.includes('supabase.co') ||
      event.request.url.includes('/api/')) {
    return
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          return response
        }

        // Clone the request because it's a stream
        const fetchRequest = event.request.clone()

        return fetch(fetchRequest).then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          // Clone the response because it's a stream
          const responseToCache = response.clone()

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache)
            })

          return response
        })
      })
      .catch(() => {
        // Fallback for offline pages
        if (event.request.destination === 'document') {
          return caches.match('/')
        }
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...')
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered')
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  // Handle any queued offline actions
  try {
    // This could sync user data, credits, or other critical info
    console.log('Performing background sync...')
  } catch (error) {
    console.error('Background sync failed:', error)
  }
}

// Push notification handling
self.addEventListener('push', event => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: data.data,
    actions: [
      {
        action: 'open-app',
        title: 'Open BlueFX AI'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'BlueFX AI', options)
  )
})

// Notification click handling
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'open-app') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})