// 앱 명령마다 권한을 만들어서(allow-…), 원격 주소(github.io)에서 열린 위젯 화면이 부를 수 있게 capabilities/main.json에 넣어요
const COMMANDS: &[&str] = &["wb_get", "wb_set", "wb_done", "installed", "as_get", "as_set", "min_w", "z_get", "z_set", "quit", "hide", "login_mode", "notify", "ctx_menu"];

fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)))
        .expect("tauri build 설정 실패");
}
