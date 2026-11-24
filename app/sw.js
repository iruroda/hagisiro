// Hagisiro 서비스워커 — 앱 껍데기를 캐시해서 오프라인에서도 열리게 함
// (데이터 자체는 Firestore가 기기에 따로 캐시해요)
const CACHE = 'hagisiro-app-v549';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'parser.js', 'lunar.js', 'cloud.js', 'qr.js', 'config.js', 'manifest.json', 'book.html', 'book.js', 'book.css', 'icons/icon.svg', 'icons/icon-192.png', 'icons/notif-192.png', 'fonts/SUITE-Variable.woff2'];

self.addEventListener('install', (e) => {
  // 새 버전 파일을 브라우저 HTTP 캐시가 아닌 서버에서 새로 받아 둠
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
  if (sameOrigin && url.pathname.endsWith('/sw.js')) return;

  /* 캐시 우선: 파일은 버전(CACHE)마다 통째로 새로 받아 두므로, 켤 때 네트워크를 기다리지 않고 바로 열려요.
     새 버전이 올라오면 sw.js가 바뀌어 새 캐시를 받고, 페이지는 한가할 때 새로고침돼요(index.html). */
  const nav = req.mode === 'navigate';
  e.respondWith(caches.match(req, { ignoreSearch: nav }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => (nav ? caches.match('index.html') : Response.error()))));
});
