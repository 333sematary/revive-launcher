#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::env;
use std::fs::create_dir_all;
use sysinfo::System;
use tauri::{AppHandle, Manager, Window};
mod carter;
use dotenvy::dotenv;

static LAUNCH_PENDING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
struct LaunchGuard;
impl Drop for LaunchGuard {
    fn drop(&mut self) {
        LAUNCH_PENDING.store(false, std::sync::atomic::Ordering::SeqCst);
    }
}

#[tauri::command]
fn close_launcher(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn window_minimize(window: Window) {
    window.minimize().unwrap();
}

#[tauri::command]
async fn firstlaunch(
    path: String,
    app: AppHandle,
    email: String,
    password: String,
    eor: bool,
    ror: bool,
    mobile_builds: bool,
) -> Result<bool, String> {
    if LAUNCH_PENDING.compare_exchange(false, true, std::sync::atomic::Ordering::SeqCst, std::sync::atomic::Ordering::SeqCst).is_err() {
        return Err("Fortnite is already being launched. Please wait.".into());
    }
    let _launch_guard = LaunchGuard;
    if !carter::security_check() {
        return Err("Security violation: Debugger detected. Please close UUU or x64dbg.".to_string());
    }

    carter::kill_epic();

    let dll_url = env::var("VITE_REDIRECT_LINK").unwrap_or_default();
    let inject_dlls = env::var("VITE_INJECT_DLLS_LINKS").unwrap_or_default();
    let paks = env::var("VITE_PAKS_AND_SIGS_LINKS").unwrap_or_default();

    carter::launch_fn(&path, dll_url, inject_dlls, paks, app, email, password, eor, ror, mobile_builds).await
}

#[tauri::command]
fn is_fortnite_client_running() -> bool {
    let mut system = System::new_all();
    system.refresh_all();
    for (_, process) in system.processes() {
        if process.name().to_string_lossy().contains("FortniteClient-Win64-Shipping.exe") {
            return true;
        }
    }
    false
}

#[tauri::command]
fn window_close(window: Window) {
    window.close().unwrap();
}

#[tokio::main]
async fn main() {
    let env_content = include_str!("../../.env");
    for line in env_content.lines() {
        if line.starts_with('#') || line.trim().is_empty() { continue; }
        if let Some((key, value)) = line.split_once('=') {
            let clean_value = value.trim().trim_matches('"');
            std::env::set_var(key.trim(), clean_value);
        }
    }
    dotenv().ok();

    carter::start_discord_rpc();
    
    let app_name = env::var("VITE_LAUNCHER_NAME").unwrap_or_else(|_| "Project".to_string());
    let path = format!("C:\\Program Files\\{}", app_name);

    if let Err(e) = create_dir_all(&path) {
        eprintln!("Error creating directory: {}", e);
    }

    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            // Force exact window size regardless of cached values
            window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 480, height: 650 })).unwrap();
            window.set_min_size(Some(tauri::Size::Physical(tauri::PhysicalSize { width: 480, height: 650 }))).unwrap();
            window.set_max_size(Some(tauri::Size::Physical(tauri::PhysicalSize { width: 480, height: 650 }))).unwrap();
            window.center().unwrap();
            window.show().unwrap();
            window.on_window_event(|event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    carter::kill(); 
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_close,
            firstlaunch,
            is_fortnite_client_running,
            close_launcher,
            carter::download_paks_cmd
        ])
        .run(tauri::generate_context!())
        .expect("Error starting the app");
}
