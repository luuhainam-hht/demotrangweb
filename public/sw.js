// =====================================================================================
// Service Worker - che do mat mang tam thoi cho Kiosk (han che "Chua xu ly tinh huong mat ket
// noi mang tai Kiosk" trong bao cao).
//
// Chien luoc "mang truoc, bo nho dem sau" (network-first): khi CO mang luon lay ban moi nhat tu
// may chu (khong bao gio ket ban cu sau moi lan deploy); khi MAT mang van mo duoc Trang chu,
// danh muc thu tuc, giay to can chuan bi, Hoi dap, Huong dan dien to khai tu lan tai gan nhat.
// Lay so (POST) KHONG bao gio duoc gia lap khi mat mang - STT phai do may chu cap de khong trung.
// Khu vuc noi bo (Quay/Admin) va moi API ghi khong di qua bo nho dem.
// =====================================================================================
const CACHE = 'hcc-offline-v7';
const PRECACHE = [
  '/', '/index.html', '/kiosk-checklist.html', '/hoi-dap.html', '/huong-dan.html',
  '/huong-dan-dien-mau.html', '/nop-ho-so-truc-tuyen.html', '/ket-noi-wifi.html', '/theo-doi.html', '/offline.html',
  '/css/common.css', '/css/kiosk.css', '/css/guide-pages.css', '/css/form-guide.css',
  '/js/apiClient.js', '/js/header.js', '/js/toast.js', '/js/actionDelegate.js',
  '/vendor/qrcode.min.js', '/js/qrLoader.js', '/js/chatbot.js', '/js/mindtek-chat.js', '/js/index.js', '/js/kiosk-checklist.js', '/js/hoi-dap.js',
  '/vendor/fonts/be-vietnam-pro-vietnamese-400-normal.woff2', '/vendor/fonts/be-vietnam-pro-vietnamese-500-normal.woff2', '/vendor/fonts/be-vietnam-pro-vietnamese-600-normal.woff2', '/vendor/fonts/be-vietnam-pro-vietnamese-700-normal.woff2',
  '/vendor/fonts/be-vietnam-pro-latin-400-normal.woff2', '/vendor/fonts/be-vietnam-pro-latin-500-normal.woff2', '/vendor/fonts/be-vietnam-pro-latin-600-normal.woff2', '/vendor/fonts/be-vietnam-pro-latin-700-normal.woff2',
  '/assets/logoKiosk-trimmed-transparent.png', '/assets/logoKiosk-icon-transparent.png'
];
// API chi doc, cong khai, an toan de hien ban cu khi mat mang.
const CACHEABLE_API = [
  /^\/api\/kiosk\/services(\/\d+\/(checklist|form-guide))?$/,
  /^\/api\/kiosk\/faq$/, /^\/api\/kiosk\/form-guides$/, /^\/api\/kiosk\/dvc-guide$/,
  /^\/api\/kiosk\/wifi-guide$/, /^\/api\/kiosk\/hours$/
];
const PRIVATE_PAGES = /\/(admin|counter|login)\.html$|\/js\/(admin|counter|login)/;

self.addEventListener('install', (event) => {
  // addAll that bai 1 file la hong ca buoc cai -> nap tung file, bo qua file loi.
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (PRIVATE_PAGES.test(url.pathname)) return;
  const isApi = url.pathname.startsWith('/api/');
  if (isApi && !CACHEABLE_API.some((re) => re.test(url.pathname))) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const copy = fresh.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req, { ignoreSearch: !isApi });
      if (cached) return cached;
      if (req.mode === 'navigate') return (await caches.match('/offline.html')) || Response.error();
      if (isApi) {
        return new Response(JSON.stringify({ error: 'Mất kết nối mạng. Vui lòng thử lại sau ít phút hoặc nhờ cán bộ hỗ trợ.', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      }
      return Response.error();
    }
  })());
});
