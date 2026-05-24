const CACHE_NAME = 'gerak-parabola-v1';

// 1. Daftar aset utama yang wajib ada agar aplikasi Simulasi Gerak Parabola bisa jalan offline
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  // JIKA Anda punya file CSS, JS, atau gambar lokal, daftarkan di sini dengan format relatif:
  // './css/style.css',
  // './js/script.js'
];

// 2. Event Install: Menyimpan aset statis ke dalam cache saat PWA pertama kali dibuka
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Mengunduh aset utama untuk mode offline...');
        // Menggunakan BIND agar jika satu file gagal, tidak merusak instalasi file lainnya
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Memaksa SW baru langsung aktif
  );
});

// 3. Event Activate: Membersihkan versi cache lama saat Anda mengupdate CACHE_NAME
self.addEventListener('activate', event => {
  const cacheAllowlist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheAllowlist.includes(cacheName)) {
            console.log('[Service Worker] Menghapus cache usang:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Langsung mengontrol halaman tanpa perlu refresh ulang
  );
});

// 4. Event Fetch: Strategi Cache Utama dengan Pengaman Offline
self.addEventListener('fetch', event => {
  // Hanya proses request dengan metode GET (mengabaikan POST atau extension browser)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // JIKA file ada di cache, langsung gunakan versi cache (Sangat Cepat & Mendukung Offline)
        if (cachedResponse) {
          return cachedResponse;
        }

        // JIKA file tidak ada di cache, ambil dari jaringan internet
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then(response => {
            // Validasi respons: jika error atau request dari luar domain asal (bukan aset Anda), langsung kembalikan
            if (!response || response.status !== 200) {
              return response;
            }

            // [PERBAIKAN KRITIS]: Di GitHub Pages, kita longgarkan response.type agar tidak menolak file dari sub-folder repo
            const responseToCache = response.clone();

            // Hanya simpan otomatis file yang berasal dari domain website Anda sendiri (Mencegah cache bengkak karena CDN luar)
            if (event.request.url.startsWith(self.location.origin)) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }

            return response;
          })
          .catch(error => {
            console.log('[Service Worker] Gagal mengambil data dari internet (Anda sedang offline):', error);
            
            // Pengaman Tambahan: Jika user offline dan membuka halaman utama tetapi gagal
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});
