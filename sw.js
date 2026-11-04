// HAGISIRO 서비스워커 — 앱 껍데기를 캐시해서 오프라인에서도 열리게 함
// (데이터 자체는 Firestore가 기기에 따로 캐시해요)
const CACHE = 'hagisiro-v75';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'parser.js', 'lunar.js', 'cloud.js', 'config.js', 'manifest.json', 'book.html', 'book.js', 'book.css', 'icons/icon.svg', 'icons/icon-192.png', 'fonts/SUITE-Variable.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isSdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!sameOrigin && !isSdk) return; // Firestore/Auth/Calendar 통신은 건드리지 않음

  if (isSdk) {
    // 버전이 고정된 SDK는 캐시 우선
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    })));
    return;
  }
  // 내 파일은 네트워크 우선(업데이트가 바로 반영), 실패하면 캐시
  e.respondWith(fetch(req).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))));
});
