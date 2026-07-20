pub mod analyzer;
pub mod compressor;

use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn select_directory(app: tauri::AppHandle) -> Option<String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .pick_folder(move |folder_path| {
            let path_str = folder_path.map(|p| p.to_string());
            let _ = tx.send(path_str);
        });
    rx.await.unwrap_or(None)
}

#[tauri::command]
fn analyze_project(path: &str) -> analyzer::ProjectAnalysis {
    analyzer::analyze_directory(path)
}

#[tauri::command]
fn compress_project(path: &str, output: &str, exclusions: Vec<String>) -> Result<(), String> {
    compressor::compress_directory(path, output, exclusions)
}

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select_directory,
            analyze_project,
            compress_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
