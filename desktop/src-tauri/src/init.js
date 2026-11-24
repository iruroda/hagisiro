// 위젯 창의 모든 페이지가 열릴 때 가장 먼저 실행: 앱(app.js)이 쓰는 window.hagisiroWidget을 만들어 줌
// (Electron 때 preload.js와 같은 이름·같은 함수라서 앱 코드는 그대로)
(() => {
  if (location.hostname !== 'iruroda.github.io' || window.hagisiroWidget) return;
  const I = (cmd, args) => { const t = window.__TAURI_INTERNALS__; if (!t) return Promise.reject(new Error('Tauri IPC 없음')); return t.invoke(cmd, args || {}); };
  const quiet = (p) => { p.catch((e) => console.warn('[hagisiro]', e)); };
  window.hagisiroWidget = {
    getBounds: () => I('wb_get'),
    setBounds: (b, mode) => quiet(I('wb_set', { b: { x: +b.x, y: +b.y, width: +b.width, height: +b.height }, mode: String(mode || '') })),
    done: () => quiet(I('wb_done')),
    getAutoStart: () => I('as_get'),
    setAutoStart: (v) => I('as_set', { v: !!v }),
    setMinWidth: (w) => quiet(I('min_w', { width: +w || 300 })),
    getZ: () => I('z_get'),
    setZ: (z) => I('z_set', { z: String(z) }),
    quit: () => quiet(I('quit')),
    hide: () => quiet(I('hide')),
    loginMode: (v) => quiet(I('login_mode', { v: !!v })),
    installed: () => I('installed'),
  };
  // 웹 알림 대신 윈도우 알림으로 (WebView2는 웹 알림을 제대로 못 띄워요)
  class WidgetNotification {
    constructor(title, opt) { this.onclick = null; quiet(I('notify', { title: String(title || ''), body: String((opt && opt.body) || '') })); }
    close() {}
    static get permission() { return 'granted'; }
    static requestPermission(cb) { if (cb) cb('granted'); return Promise.resolve('granted'); }
  }
  window.Notification = WidgetNotification;
  // 위젯 위에서 오른쪽 버튼 → 트레이와 같은 메뉴 (입력칸에서는 기본 메뉴)
  addEventListener('contextmenu', (e) => {
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')) return;
    e.preventDefault();
    quiet(I('ctx_menu'));
  }, true);
})();
