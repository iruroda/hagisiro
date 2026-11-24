// 예전 주소(/hagisiro/)에 깔려 있던 서비스워커를 정리하는 용도예요.
// 앱은 /hagisiro/app/ 으로 옮겼고, 여기 서비스워커는 옛 캐시를 지운 뒤 스스로 해제돼요.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => !k.startsWith('hagisiro-app-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});
