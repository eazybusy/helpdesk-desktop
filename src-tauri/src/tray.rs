//! The employee app lives in the notification area: closing or minimising the window hides it
//! (no taskbar button, only the tray icon), so ticket notifications keep arriving as Windows
//! notifications. "გასვლა" in the tray menu really quits.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime, Window, WindowEvent};
use tauri_plugin_notification::NotificationExt;

pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "IT Support-ის გახსნა", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "გასვლა", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("IT Support")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

static TOLD: AtomicBool = AtomicBool::new(false);

/// Close or minimise → hide to the tray (once per run, say so).
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    match event {
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            to_tray(window);
        }
        // There is no "minimised" event: a minimise arrives as a resize.
        WindowEvent::Resized(_) if window.is_minimized().unwrap_or(false) => to_tray(window),
        _ => {}
    }
}

fn to_tray<R: Runtime>(window: &Window<R>) {
    let _ = window.hide();
    if !TOLD.swap(true, Ordering::Relaxed) {
        let _ = window
            .app_handle()
            .notification()
            .builder()
            .title("IT Support ფონურ რეჟიმში მუშაობს")
            .body("მოთხოვნის სიახლეები Windows-ის შეტყობინებებში მოვა. გასახსნელად დააჭირეთ ხატულას საათთან (^ ფარული ხატულები).")
            .show();
    }
}
