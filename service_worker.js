const CACHE_NAME = 'gerak-parabola-v1';

// Daftar file lokal yang wajib di-cache untuk keperluan offline
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Event Install: Menyimpan file-file penting ke dalam cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Membuka cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Event Fetch: Mengambil data dari cache jika ada, jika tidak ambil dari jaringan
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - kembalikan respons dari cache
        if (response) {
          return response;
        }
        
        // Clone request karena request adalah stream dan hanya bisa dipakai sekali
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Cek apakah respons valid
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone response karena response adalah stream dan hanya bisa dipakai sekali
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Jangan simpan resource dari pihak ketiga (CDN) secara otomatis 
                // kecuali Anda yakin, di sini kita hanya cache permintaan lokal
                if (event.request.url.startsWith(self.location.origin)) {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        );
      })
  );
});

// Event Activate: Membersihkan cache lama jika versi diperbarui
self.addEventListener('activate', event => {
  const cacheAllowlist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheAllowlist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});