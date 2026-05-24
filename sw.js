// =============================================
//  Service Worker - LKPD Gerak Parabola
//  MAN 2 Indramayu
// =============================================

const CACHE_NAME = 'lkpd-gerak-parabola-v1';
const STATIC_CACHE = 'lkpd-static-v1';
const DYNAMIC_CACHE = 'lkpd-dynamic-v1';

// Aset lokal yang wajib di-cache saat install
const STATIC_ASSETS = [
  './index.html',
  './manifest.json'
];

// CDN external yang di-cache (diambil saat pertama kali diakses)
const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap'
];

// ─────────────────────────────────────────────
//  INSTALL — cache semua aset statis lokal
// ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully.');
        return self.skipWaiting(); // Aktifkan SW baru langsung tanpa menunggu tab ditutup
      })
      .catch((err) => {
        console.error('[SW] Failed to cache static assets:', err);
      })
  );
});

// ─────────────────────────────────────────────
//  ACTIVATE — hapus cache lama yang tidak terpakai
// ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  const allowedCaches = [STATIC_CACHE, DYNAMIC_CACHE];

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !allowedCaches.includes(name))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated.');
        return self.clients.claim(); // Ambil kontrol semua tab yang terbuka
      })
  );
});

// ─────────────────────────────────────────────
//  FETCH — strategi cache berdasarkan tipe request
// ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Abaikan request non-GET dan chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // ── 1. Aset lokal (file HTML, manifest, dll) → Cache First ──
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── 2. CDN (Tailwind, MathJax, html2canvas, Fonts) → Stale While Revalidate ──
  const isCDN = CDN_URLS.some((cdn) => request.url.startsWith(cdn)) ||
                url.hostname.includes('fonts.googleapis.com') ||
                url.hostname.includes('fonts.gstatic.com') ||
                url.hostname.includes('cdn.jsdelivr.net') ||
                url.hostname.includes('cdn.tailwindcss.com') ||
                url.hostname.includes('cdnjs.cloudflare.com');

  if (isCDN) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    return;
  }

  // ── 3. Request lain → Network First dengan fallback cache ──
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ─────────────────────────────────────────────
//  STRATEGI CACHING
// ─────────────────────────────────────────────

/**
 * Cache First: ambil dari cache, jika tidak ada baru ke network.
 * Cocok untuk aset statis lokal yang jarang berubah.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.warn('[SW] Cache first - network failed:', request.url);
    return offlineFallback();
  }
}

/**
 * Stale While Revalidate: kembalikan cache langsung (jika ada),
 * lalu perbarui cache di background dari network.
 * Cocok untuk CDN / aset yang boleh sedikit basi tapi tetap cepat.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  return cached || fetchPromise;
}

/**
 * Network First: utamakan network, gunakan cache sebagai fallback.
 * Cocok untuk konten dinamis yang butuh data terbaru.
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineFallback();
  }
}

/**
 * Fallback saat offline dan tidak ada cache tersedia.
 */
function offlineFallback() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - LKPD Gerak Parabola</title>
      <style>
        body {
          font-family: 'Inter', sans-serif;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          min-height: 100vh; margin: 0;
          background: #eff6ff; color: #1e40af; text-align: center; padding: 2rem;
        }
        .icon { font-size: 5rem; margin-bottom: 1rem; }
        h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; }
        p  { color: #3b82f6; max-width: 360px; line-height: 1.6; }
        button {
          margin-top: 1.5rem; padding: 0.75rem 2rem;
          background: #2563eb; color: white;
          border: none; border-radius: 0.75rem;
          font-size: 1rem; font-weight: 600; cursor: pointer;
        }
        button:hover { background: #1d4ed8; }
      </style>
    </head>
    <body>
      <div class="icon">📡</div>
      <h1>Tidak Ada Koneksi</h1>
      <p>Kamu sedang offline. Periksa koneksi internet dan coba lagi.</p>
      <button onclick="window.location.reload()">🔄 Coba Lagi</button>
    </body>
    </html>`,
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

// ─────────────────────────────────────────────
//  BACKGROUND SYNC (opsional — untuk form evaluasi)
// ─────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-evaluasi') {
    console.log('[SW] Background sync: evaluasi');
    // Tambahkan logika sync jawaban evaluasi di sini jika dibutuhkan
  }
});
