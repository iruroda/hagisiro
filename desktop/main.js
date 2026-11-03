const { app, BrowserWindow, Tray, Menu, nativeImage, screen, shell } = require('electron');
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

function create() {
  st = load();
  win = new BrowserWindow({
    ...bounds(), frame: false, transparent: true, hasShadow: false, resizable: false, skipTaskbar: true,
    alwaysOnTop: !!st.top, backgroundColor: '#00000000', title: 'HAGISIRO',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setUserAgent(UA); // 구글 로그인이 내장 브라우저로 오인해 막는 것을 피함
  win.loadURL(URL);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/accounts\.google\.com|firebaseapp\.com|google\.com\/o\/oauth/.test(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 480, height: 640, frame: true, transparent: false, autoHideMenuBar: true, parent: win, modal: false } };
    }
    shell.openExternal(url); return { action: 'deny' };
  });
  win.on('moved', () => { st.bounds = win.getBounds(); save(); });
  win.on('closed', () => { win = null; });
}

function menu() {
  const resize = (k) => { const [w, h] = SIZES[k]; const b = win.getBounds(); win.setBounds({ x: b.x, y: b.y, width: w, height: h }); st.bounds = win.getBounds(); save(); };
  return Menu.buildFromTemplate([
    { label: '보이기 / 숨기기', click: () => (win.isVisible() ? win.hide() : (win.show(), win.focus())) },
    { label: '크기', submenu: Object.keys(SIZES).map((k) => ({ label: k, click: () => resize(k) })) },
    { label: '항상 맨 위', type: 'checkbox', checked: !!st.top, click: (i) => { st.top = i.checked; win.setAlwaysOnTop(i.checked); save(); } },
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
