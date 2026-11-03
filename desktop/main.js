const { app, BrowserWindow, Tray, Menu, nativeImage, screen, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const URL = 'https://iruroda.github.io/hagisiro/?widget=1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SIZES = { 작게: [420, 560], 보통: [640, 700], 크게: [900, 760] };

let win, tray, st;
const file = () => path.join(app.getPath('userData'), 'widget.json');
const load = () => { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch (e) { return {}; } };
const save = () => { try { fs.writeFileSync(file(), JSON.stringify(st)); } catch (e) { /* noop */ } };

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

function bounds() {
  const wa = screen.getPrimaryDisplay().workArea;
  const b = st.bounds || { width: 640, height: 700, x: wa.x + wa.width - 660, y: wa.y + 20 };
  const vis = screen.getAllDisplays().some((d) => b.x < d.bounds.x + d.bounds.width - 40 && b.x + b.width > d.bounds.x + 40 && b.y >= d.bounds.y - 10 && b.y < d.bounds.y + d.bounds.height - 40);
  return vis ? b : { width: b.width, height: b.height, x: wa.x + wa.width - b.width - 20, y: wa.y + 20 };
}

/* 이동·크기 변경: 화면(작업 영역) 가장자리에 자석처럼 붙임 */
const SNAP = 16, MINH = 320; let MINW = 300;
function snapAxis(v, targets) { let best = null; for (const t of targets) { const d = t - v; if (Math.abs(d) <= SNAP && (best === null || Math.abs(d) < Math.abs(best))) best = d; } return best; }
function snapBounds(b, mode) {
  const was = screen.getAllDisplays().map((d) => d.workArea);
  const xs = was.flatMap((w) => [w.x, w.x + w.width]), ys = was.flatMap((w) => [w.y, w.y + w.height]);
  let { x, y, width, height } = b;
  const e = mode === 'move' ? 'lrtb' : String(mode || '');
  if (mode === 'move') {
    const dl = snapAxis(x, xs), dr = snapAxis(x + width, xs);
    const dx = dl !== null && (dr === null || Math.abs(dl) <= Math.abs(dr)) ? dl : dr; if (dx !== null) x += dx;
    const dt = snapAxis(y, ys), db = snapAxis(y + height, ys);
    const dy = dt !== null && (db === null || Math.abs(dt) <= Math.abs(db)) ? dt : db; if (dy !== null) y += dy;
  } else {
    if (e.includes('l')) { const d = snapAxis(x, xs); if (d !== null) { x += d; width -= d; } }
    if (e.includes('r')) { const d = snapAxis(x + width, xs); if (d !== null) width += d; }
    if (e.includes('t')) { const d = snapAxis(y, ys); if (d !== null) { y += d; height -= d; } }
    if (e.includes('b')) { const d = snapAxis(y + height, ys); if (d !== null) height += d; }
  }
  return { x: Math.round(x), y: Math.round(y), width: Math.max(MINW, Math.round(width)), height: Math.max(MINH, Math.round(height)) };
}
ipcMain.handle('wb-get', () => (win ? win.getBounds() : null));
ipcMain.on('wb-set', (e, b, mode) => { if (win && b) win.setBounds(snapBounds(b, mode)); });
ipcMain.handle('as-get', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('as-set', (e, v) => { app.setLoginItemSettings({ openAtLogin: !!v }); return app.getLoginItemSettings().openAtLogin; });
ipcMain.on('min-w', (e, w) => { MINW = Math.max(240, Math.min(900, Math.round(+w) || 300)); if (win) { win.setMinimumSize(MINW, MINH); const b = win.getBounds(); if (b.width < MINW) win.setBounds({ ...b, width: MINW }); } });
/* 창 순서: top(항상 맨 앞) · normal(일반) · bottom(항상 다른 창 뒤, 바탕화면 위) */
const zmode = () => st.z || (st.top ? 'top' : 'normal');
let zTimer = null;
function sendBottom() {
  if (!win || process.platform !== 'win32' || zmode() !== 'bottom') return;
  clearTimeout(zTimer);
  zTimer = setTimeout(() => {
    try {
      const h = win.getNativeWindowHandle().readBigUInt64LE(0).toString();
      const ps = `Add-Type 'using System;using System.Runtime.InteropServices;public class Z{[DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int w,int c,uint f);}';[Z]::SetWindowPos([IntPtr]::new(${h}),[IntPtr]1,0,0,0,0,0x13)|Out-Null`;
      require('child_process').spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { windowsHide: true });
    } catch (e) { /* noop */ }
  }, 120);
}
function applyZ(z) {
  st.z = z; delete st.top; save();
  if (!win) return;
  win.setAlwaysOnTop(z === 'top');
  if (z === 'bottom') sendBottom();
}
ipcMain.handle('z-get', () => zmode());
ipcMain.handle('z-set', (e, z) => { if (['top', 'normal', 'bottom'].includes(z)) applyZ(z); return zmode(); });
ipcMain.on('quit', () => app.quit());
ipcMain.on('wb-done', () => { if (win) { st.bounds = win.getBounds(); save(); } });

function create() {
  st = load();
  win = new BrowserWindow({
    ...bounds(), frame: false, transparent: true, hasShadow: false, resizable: false, skipTaskbar: true,
    alwaysOnTop: zmode() === 'top', backgroundColor: '#00000000', title: 'HAGISIRO',
    minWidth: 300, minHeight: 320,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') },
  });
  win.webContents.setUserAgent(UA); // 구글 로그인이 내장 브라우저로 오인해 막는 것을 피함
  win.loadURL(URL);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/accounts\.google\.com|firebaseapp\.com|google\.com\/o\/oauth/.test(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 480, height: 640, frame: true, transparent: false, backgroundColor: '#ffffff', hasShadow: true, roundedCorners: true, thickFrame: true, resizable: true, skipTaskbar: false, alwaysOnTop: false, autoHideMenuBar: true, parent: win, modal: false } };
    }
    shell.openExternal(url); return { action: 'deny' };
  });
  // 로그인 팝업에도 같은 UA 적용(안 하면 구글이 다른 화면을 내려줘 깨져 보임)
  win.webContents.on('did-create-window', (child) => { child.webContents.setUserAgent(UA); child.setMenuBarVisibility(false); });
  // 위젯 위에서 오른쪽 버튼 → 트레이와 같은 메뉴 (입력칸에서는 기본 메뉴)
  win.webContents.on('context-menu', (e, params) => { if (!params.isEditable) menu().popup({ window: win }); });
  win.on('moved', () => { st.bounds = win.getBounds(); save(); });
  win.on('blur', sendBottom); win.on('show', sendBottom); win.on('restore', sendBottom);
  win.webContents.on('did-finish-load', sendBottom);
  win.on('closed', () => { win = null; });
}

function menu() {
  const resize = (k) => { const [w, h] = SIZES[k]; const b = win.getBounds(); win.setBounds({ x: b.x, y: b.y, width: w, height: h }); st.bounds = win.getBounds(); save(); };
  return Menu.buildFromTemplate([
    { label: '보이기 / 숨기기', click: () => (win.isVisible() ? win.hide() : (win.show(), win.focus())) },
    { label: '크기', submenu: Object.keys(SIZES).map((k) => ({ label: k, click: () => resize(k) })) },
    { label: '창 순서', submenu: [['top', '맨 앞 (항상 위)'], ['normal', '일반'], ['bottom', '맨 뒤 (바탕화면)']].map(([k, l]) => ({ label: l, type: 'radio', checked: zmode() === k, click: () => applyZ(k) })) },
    { label: '윈도우 시작 시 자동 실행', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { label: '새로고침', click: () => win.webContents.reload() },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]);
}

app.whenReady().then(() => {
  create();
  if (!app.getLoginItemSettings().openAtLogin && st.firstRun !== false) { app.setLoginItemSettings({ openAtLogin: true }); st.firstRun = false; save(); }
  const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('HAGISIRO');
  tray.setContextMenu(menu());
  tray.on('click', () => (win.isVisible() ? win.hide() : (win.show(), win.focus())));
});
app.on('window-all-closed', () => app.quit());
