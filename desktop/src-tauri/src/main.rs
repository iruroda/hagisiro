// Hagisiro 바탕화면 위젯 (Tauri): 윈도우에 들어 있는 Edge 엔진(WebView2)으로 웹앱을 띄우는 투명한 창
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}, sync::Mutex, time::Duration};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry};
use tauri_plugin_notification::NotificationExt;

const URL: &str = "https://iruroda.github.io/hagisiro/app/?widget=1";
const INIT: &str = include_str!("init.js");
const SNAP: f64 = 3.0;
const MINH: f64 = 320.0;
static POPUPS: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

#[derive(Clone, Copy, Serialize, Deserialize, Debug)]
struct Rect { x: f64, y: f64, width: f64, height: f64 }

/* widget.json: Electron 때와 같은 모양 { bounds, z } */
#[derive(Default, Serialize, Deserialize)]
struct Saved {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    bounds: Option<Rect>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    z: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    top: Option<bool>,
}

struct St {
    saved: Saved,
    file: PathBuf,
    raised: bool,             // exe를 또 열어 맨 앞으로 꺼낸 상태 (다른 곳을 누르면 원래대로)
    in_login: bool,           // 로그인 화면: 작은 창을 화면 가운데에
    login_saved: Option<Rect>,
    minw: f64,
    z_gen: u64,
}
type Shared = Mutex<St>;

impl St {
    fn z(&self) -> String {
        self.saved.z.clone().unwrap_or_else(|| if self.saved.top == Some(true) { "top".into() } else { "normal".into() })
    }
    fn save(&self) {
        if let Some(d) = self.file.parent() { let _ = fs::create_dir_all(d); }
        if let Ok(s) = serde_json::to_string(&self.saved) { let _ = fs::write(&self.file, s); }
    }
}

/* ---------- 화면(모니터) 정보: 윈도우 API ---------- */
mod w32 {
    use windows_sys::Win32::Foundation::{BOOL, LPARAM, POINT, RECT};
    use windows_sys::Win32::Graphics::Gdi::{EnumDisplayMonitors, GetMonitorInfoW, MonitorFromPoint, HDC, HMONITOR, MONITORINFO, MONITOR_DEFAULTTOPRIMARY};
    use windows_sys::Win32::UI::WindowsAndMessaging::{SetWindowPos, HWND_BOTTOM, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE};

    pub struct Mon { pub full: RECT, pub work: RECT }

    unsafe extern "system" fn each(h: HMONITOR, _: HDC, _: *mut RECT, data: LPARAM) -> BOOL {
        let v = &mut *(data as *mut Vec<Mon>);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(h, &mut mi) != 0 { v.push(Mon { full: mi.rcMonitor, work: mi.rcWork }); }
        1
    }
    pub fn monitors() -> Vec<Mon> {
        let mut v: Vec<Mon> = Vec::new();
        unsafe { EnumDisplayMonitors(std::ptr::null_mut(), std::ptr::null(), Some(each), &mut v as *mut Vec<Mon> as LPARAM); }
        v
    }
    pub fn primary_work() -> RECT {
        unsafe {
            let h = MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY);
            let mut mi: MONITORINFO = std::mem::zeroed();
            mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
            GetMonitorInfoW(h, &mut mi);
            mi.rcWork
        }
    }
    /* 항상 다른 창 뒤(바탕화면 바로 위)로: 예전엔 PowerShell을 새로 띄워서 했는데 이제 바로 처리 */
    pub fn to_bottom(hwnd: isize) {
        unsafe { SetWindowPos(hwnd as _, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE); }
    }
}

fn sf(w: &WebviewWindow) -> f64 { w.scale_factor().unwrap_or(1.0) }
fn lrect(r: &windows_sys::Win32::Foundation::RECT, s: f64) -> Rect {
    Rect { x: r.left as f64 / s, y: r.top as f64 / s, width: (r.right - r.left) as f64 / s, height: (r.bottom - r.top) as f64 / s }
}
fn get_rect(w: &WebviewWindow) -> Rect {
    let s = sf(w);
    let p = w.outer_position().unwrap_or_default().to_logical::<f64>(s);
    let z = w.outer_size().unwrap_or_default().to_logical::<f64>(s);
    Rect { x: p.x, y: p.y, width: z.width, height: z.height }
}
fn set_rect(w: &WebviewWindow, r: Rect) {
    let _ = w.set_position(LogicalPosition::new(r.x, r.y));
    let _ = w.set_size(LogicalSize::new(r.width, r.height));
}

/* 처음엔 화면 정가운데, 저장된 자리가 지금 모니터들 밖이면 다시 가운데 */
fn initial_bounds(saved: &Saved, s: f64) -> Rect {
    let wa = lrect(&w32::primary_work(), s);
    let mid = |w: f64, h: f64| Rect { width: w, height: h, x: (wa.x + (wa.width - w) / 2.0).round(), y: (wa.y + (wa.height - h) / 2.0).round() };
    let b = saved.bounds.unwrap_or_else(|| mid(800.0, 620.0));
    let vis = w32::monitors().iter().any(|m| {
        let d = lrect(&m.full, s);
        b.x < d.x + d.width - 40.0 && b.x + b.width > d.x + 40.0 && b.y >= d.y - 10.0 && b.y < d.y + d.height - 40.0
    });
    if vis { b } else { mid(b.width, b.height) }
}

/* 이동·크기 변경: 화면(작업 영역) 가장자리에 자석처럼 붙임 */
fn snap_axis(v: f64, targets: &[f64]) -> Option<f64> {
    let mut best: Option<f64> = None;
    for t in targets {
        let d = t - v;
        if d.abs() <= SNAP && best.map_or(true, |b| d.abs() < b.abs()) { best = Some(d); }
    }
    best
}
fn snap_bounds(b: Rect, mode: &str, s: f64, minw: f64) -> Rect {
    let was: Vec<Rect> = w32::monitors().iter().map(|m| lrect(&m.work, s)).collect();
    let xs: Vec<f64> = was.iter().flat_map(|w| [w.x, w.x + w.width]).collect();
    let ys: Vec<f64> = was.iter().flat_map(|w| [w.y, w.y + w.height]).collect();
    let Rect { mut x, mut y, mut width, mut height } = b;
    if mode == "move" {
        let pick = |a: Option<f64>, b: Option<f64>| match (a, b) { (Some(a), Some(b)) => Some(if a.abs() <= b.abs() { a } else { b }), (a, None) => a, (None, b) => b };
        if let Some(d) = pick(snap_axis(x, &xs), snap_axis(x + width, &xs)) { x += d; }
        if let Some(d) = pick(snap_axis(y, &ys), snap_axis(y + height, &ys)) { y += d; }
    } else {
        if mode.contains('l') { if let Some(d) = snap_axis(x, &xs) { x += d; width -= d; } }
        if mode.contains('r') { if let Some(d) = snap_axis(x + width, &xs) { width += d; } }
        if mode.contains('t') { if let Some(d) = snap_axis(y, &ys) { y += d; height -= d; } }
        if mode.contains('b') { if let Some(d) = snap_axis(y + height, &ys) { height += d; } }
    }
    Rect { x: x.round(), y: y.round(), width: width.round().max(minw), height: height.round().max(MINH) }
}

/* ---------- 창 순서: top(항상 맨 앞) · normal(일반) · bottom(항상 다른 창 뒤) ---------- */
fn send_bottom(app: &AppHandle) {
    let Some(w) = app.get_webview_window("main") else { return };
    let gen = {
        let st = app.state::<Shared>();
        let mut s = st.lock().unwrap();
        if s.raised || s.z() != "bottom" { return; }
        s.z_gen += 1;
        s.z_gen
    };
    let Ok(h) = w.hwnd() else { return };
    let hwnd = h.0 as isize;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(120));
        let st = app.state::<Shared>();
        let s = st.lock().unwrap();
        if s.z_gen != gen || s.raised || s.z() != "bottom" { return; } // 그 사이에 꺼내졌거나 바뀌었다면 보내지 않음
        drop(s);
        w32::to_bottom(hwnd);
    });
}

/* 이미 떠 있는 위젯이 있을 때 exe를 또 열면: 숨겨져 있든 가려져 있든 맨 앞으로 꺼냄. 다른 곳을 누르면 원래대로 */
fn reveal(app: &AppHandle) {
    let Some(w) = app.get_webview_window("main") else { return };
    app.state::<Shared>().lock().unwrap().raised = true;
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_always_on_top(true);
    let _ = w.set_focus();
}
/* 보이는 것만으로는 앞에 있다고 할 수 없음(맨 뒤 모드에선 다른 창에 가려짐): 포커스가 있을 때만 '앞'으로 봄 */
fn front(app: &AppHandle) -> bool {
    app.get_webview_window("main").map_or(false, |w| w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false))
}
fn toggle(app: &AppHandle) {
    if front(app) { if let Some(w) = app.get_webview_window("main") { let _ = w.hide(); } } else { reveal(app); }
}
fn menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let t = MenuItem::with_id(app, "toggle", if front(app) { "숨기기" } else { "열기" }, true, None::<&str>)?;
    let q = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
    Menu::with_items(app, &[&t, &q])
}

/* ---------- 시작 프로그램 (Windows 시작 시 실행) ---------- */
fn run_key() -> std::io::Result<winreg::RegKey> {
    use winreg::enums::*;
    winreg::RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", KEY_READ | KEY_WRITE)
}
fn exe_cmd() -> String { std::env::current_exe().map(|p| format!("\"{}\"", p.display())).unwrap_or_default() }
fn autostart_on() -> bool { run_key().and_then(|k| k.get_value::<String, _>("Hagisiro")).is_ok() }
/* 예전(Electron) 위젯이 켜 둔 시작 프로그램 항목은 지우고, 켜져 있었다면 새 위젯으로 이어서 켬 */
fn migrate_autostart() {
    let Ok(k) = run_key() else { return };
    let olds: Vec<String> = k.enum_values().filter_map(|r| r.ok())
        .filter(|(name, v)| name != "Hagisiro" && v.to_string().to_lowercase().contains("hagisiro.exe"))
        .map(|(name, _)| name).collect();
    if olds.is_empty() { return; }
    for n in &olds { let _ = k.delete_value(n); }
    let _ = k.set_value("Hagisiro", &exe_cmd());
}

/* ---------- 예전(Electron) 위젯의 데이터 옮기기: 로그인 상태·설정·위치 ---------- */
fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    for e in fs::read_dir(from)? {
        let e = e?;
        let p = e.path();
        let q = to.join(e.file_name());
        if e.file_type()?.is_dir() { copy_dir(&p, &q)?; } else { let _ = fs::copy(&p, &q); }
    }
    Ok(())
}
fn migrate_data(web_dir: &Path, state_file: &Path) {
    let Some(appdata) = std::env::var_os("APPDATA") else { return };
    let old = PathBuf::from(appdata).join("Hagisiro");
    if !old.exists() { return; }
    let prof = web_dir.join("EBWebView").join("Default");
    if !prof.join("Local Storage").exists() {
        for d in ["Local Storage", "IndexedDB"] {
            let from = old.join(d);
            if from.exists() { let _ = copy_dir(&from, &prof.join(d)); }
        }
    }
    let ow = old.join("widget.json");
    if !state_file.exists() && ow.exists() {
        if let Some(d) = state_file.parent() { let _ = fs::create_dir_all(d); }
        let _ = fs::copy(ow, state_file);
    }
}

/* ---------- 앱(웹)에서 부르는 기능 ---------- */
#[tauri::command]
fn wb_get(window: WebviewWindow) -> Rect { get_rect(&window) }
#[tauri::command]
fn wb_set(window: WebviewWindow, st: State<Shared>, b: Rect, mode: String) {
    let minw = st.lock().unwrap().minw;
    set_rect(&window, snap_bounds(b, &mode, sf(&window), minw));
}
#[tauri::command]
fn wb_done(window: WebviewWindow, st: State<Shared>) {
    let mut s = st.lock().unwrap();
    if !s.in_login { s.saved.bounds = Some(get_rect(&window)); s.save(); }
}
#[tauri::command]
fn installed() -> bool { // 설치한 위젯이면 true (설치 폴더에 제거 프로그램이 있음), 포터블은 false
    std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("uninstall.exe").exists())).unwrap_or(false)
}
#[tauri::command]
fn as_get() -> bool { autostart_on() }
#[tauri::command]
fn as_set(v: bool) -> bool {
    if let Ok(k) = run_key() { if v { let _ = k.set_value("Hagisiro", &exe_cmd()); } else { let _ = k.delete_value("Hagisiro"); } }
    autostart_on()
}
#[tauri::command]
fn min_w(window: WebviewWindow, st: State<Shared>, width: f64) {
    let (minw, in_login) = { let mut s = st.lock().unwrap(); s.minw = width.round().clamp(240.0, 900.0); (s.minw, s.in_login) };
    if in_login { return; }
    let _ = window.set_min_size(Some(LogicalSize::new(minw, MINH)));
    let r = get_rect(&window);
    if r.width < minw { set_rect(&window, Rect { width: minw, ..r }); }
}
#[tauri::command]
fn z_get(st: State<Shared>) -> String { st.lock().unwrap().z() }
#[tauri::command]
fn z_set(app: AppHandle, window: WebviewWindow, st: State<Shared>, z: String) -> String {
    if ["top", "normal", "bottom"].contains(&z.as_str()) {
        let mut s = st.lock().unwrap();
        s.saved.z = Some(z.clone()); s.saved.top = None; s.save();
        drop(s);
        let _ = window.set_always_on_top(z == "top");
        if z == "bottom" { send_bottom(&app); }
    }
    st.lock().unwrap().z()
}
#[tauri::command]
fn quit(app: AppHandle) { app.exit(0); }
#[tauri::command]
fn hide(window: WebviewWindow) { let _ = window.hide(); }
/* 로그인 화면: 저장된 위치와 상관없이 작은 창을 화면 가운데에 띄우고, 끝나면 원래 자리로 */
#[tauri::command]
fn login_mode(window: WebviewWindow, st: State<Shared>, v: bool) {
    // 상태는 잠깐만 잠그고, 창 크기·위치는 잠금을 푼 뒤에 바꿔요 (창을 옮기면 Moved 이벤트가 같은 상태를 잠그려 해서 멈춰요)
    let k = sf(&window);
    let plan = {
        let mut s = st.lock().unwrap();
        if v && !s.in_login {
            s.in_login = true;
            s.login_saved = Some(get_rect(&window));
            Some((None, {
                let wa = lrect(&w32::primary_work(), k);
                let (w, h) = (300.0, 310.0);
                Rect { x: (wa.x + (wa.width - w) / 2.0).round(), y: (wa.y + (wa.height - h) / 2.0).round(), width: w, height: h }
            }))
        } else if !v && s.in_login {
            s.in_login = false;
            let r = s.login_saved.take().unwrap_or_else(|| initial_bounds(&s.saved, k));
            Some((Some(s.minw), r))
        } else { None }
    };
    if let Some((minw, r)) = plan {
        match minw {
            None => { let _ = window.set_min_size(None::<LogicalSize<f64>>); }
            Some(m) => { let _ = window.set_min_size(Some(LogicalSize::new(m, MINH))); }
        }
        set_rect(&window, r);
    }
    // 로그인이 끝나면(로그인 화면을 벗어나면) 남아 있는 구글 로그인 창을 닫아요 (팝업이 스스로 닫히지 않을 때가 있어서)
    if !v {
        for (label, w) in window.app_handle().webview_windows() { if label.starts_with("login") { let _ = w.close(); } }
    }
}
#[tauri::command]
fn notify(app: AppHandle, title: String, body: String) {
    let _ = app.notification().builder().title(title).body(body).show();
}
#[tauri::command]
fn ctx_menu(app: AppHandle, window: WebviewWindow) {
    if let Ok(m) = menu(&app) { let _ = window.popup_menu(&m); }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| reveal(app)))
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![wb_get, wb_set, wb_done, installed, as_get, as_set, min_w, z_get, z_set, quit, hide, login_mode, notify, ctx_menu])
        .on_menu_event(|app, e| match e.id().as_ref() {
            "toggle" => toggle(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .setup(|app| {
            let h = app.handle().clone();
            let state_file = app.path().app_data_dir()?.join("widget.json");
            let web_dir = app.path().app_local_data_dir()?;
            migrate_data(&web_dir, &state_file);
            migrate_autostart();
            let saved: Saved = fs::read_to_string(&state_file).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
            let st = St { saved, file: state_file, raised: false, in_login: false, login_saved: None, minw: 300.0, z_gen: 0 };
            let top = st.z() == "top";
            let k = app.primary_monitor().ok().flatten().map(|m| m.scale_factor()).unwrap_or(1.0);
            let b = initial_bounds(&st.saved, k);
            app.manage(Mutex::new(st));

            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(URL.parse().unwrap()))
                .title("Hagisiro")
                .decorations(false)
                .transparent(true)
                .shadow(false)
                .resizable(false)
                .skip_taskbar(true)
                .always_on_top(top)
                .inner_size(b.width, b.height)
                .position(b.x, b.y)
                .min_inner_size(300.0, MINH)
                .data_directory(web_dir)
                .initialization_script(INIT)
                .on_page_load(|w, p| { if matches!(p.event(), PageLoadEvent::Finished) { send_bottom(w.app_handle()); } })
                .on_new_window({
                    // 구글 로그인 팝업은 앱 안의 작은 창으로 (위젯 창이 로그인 페이지로 넘어가지 않게), 다른 링크는 기본 브라우저로
                    let app2 = h.clone();
                    move |url, features| {
                        let u = url.as_str();
                        if u.contains("accounts.google.com") || u.contains("firebaseapp.com") || u == "about:blank" {
                            let n = POPUPS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                            match WebviewWindowBuilder::new(&app2, format!("login{n}"), WebviewUrl::External(url.clone()))
                                .window_features(features)
                                .title("Hagisiro")
                                .inner_size(480.0, 640.0)
                                .center()
                                .build()
                            {
                                Ok(window) => tauri::webview::NewWindowResponse::Create { window },
                                Err(_) => tauri::webview::NewWindowResponse::Allow,
                            }
                        } else {
                            let _ = std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", u]).spawn();
                            tauri::webview::NewWindowResponse::Deny
                        }
                    }
                })
                .build()?;

            // 문제 확인용: 파일 이름에 debug가 들어간 exe로 실행하면 개발자 도구를 열어요
            if std::env::current_exe().ok().and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_lowercase().contains("debug"))).unwrap_or(false) { win.open_devtools(); }
            let _ = win.show();
            let _ = win.set_focus(); // 처음 켰을 때 투명 창이 그려지지 않고 안 보이던 것 방지
            let h2 = h.clone();
            let w2 = win.clone();
            win.on_window_event(move |e| match e {
                WindowEvent::Focused(false) => {
                    let st = h2.state::<Shared>();
                    let mut s = st.lock().unwrap();
                    if s.raised { s.raised = false; let top = s.z() == "top"; drop(s); let _ = w2.set_always_on_top(top); } else { drop(s); }
                    send_bottom(&h2);
                }
                WindowEvent::Moved(_) => {
                    let st = h2.state::<Shared>();
                    if let Ok(mut s) = st.try_lock() { if !s.in_login { s.saved.bounds = Some(get_rect(&w2)); s.save(); } };
                }
                _ => {}
            });

            let tray_menu = menu(&h)?;
            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Hagisiro")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, e| {
                    let app = tray.app_handle();
                    match e {
                        TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => toggle(app),
                        TrayIconEvent::Click { button: MouseButton::Right, button_state: MouseButtonState::Down, .. } => {
                            if let Ok(m) = menu(app) { let _ = tray.set_menu(Some(m)); } // 열기·숨기기 글자를 지금 상태에 맞게
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Hagisiro 실행 실패");
}
