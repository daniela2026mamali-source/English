/* ==========================================================
   واژه‌یار — sw.js  (Service Worker)
   ========================================================== */
'use strict';

const CACHE_NAME = 'vazheyar-cache-v1';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

/* ---------- نصب: پیش‌ذخیره‌سازی ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(() => {/* بعضی فایل‌ها ممکن است نباشند */}))
      .then(() => self.skipWaiting())
  );
});

/* ---------- فعال‌سازی: پاک‌کردن کش قدیمی ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------- واکشی ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // فقط درخواست‌های هم‌مبدأ
  if (url.origin !== self.location.origin) return;

  // درخواست‌های ناوبری: اول شبکه، بعد کش
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // بقیهٔ فایل‌ها: اول کش، بعد شبکه (stale-while-revalidate)
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

/* ---------- پیام از صفحه ---------- */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});