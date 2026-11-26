use serde::Serialize;
use serde_json::{json, Value};

mod proc;
mod remote;
mod snapshot;
#[cfg(desktop)]
mod tray;

/// Identity of this computer, attached to every new ticket.
#[derive(Serialize)]
pub struct SystemInfo {
    /// DNS host name (can be longer than 15 chars, e.g. reg-mtskheta-lashaberadze).
    hostname: String,
    /// NetBIOS name, max 15 chars. The Event Log agent reports under this one.
    netbios: Option<String>,
    username: String,
    domain: Option<String>,
    ip: Option<String>,
    os: String,
}

#[tauri::command]
fn system_info() -> SystemInfo {
    // gethostname returns the DNS host name on Windows (GetComputerNameExW, PhysicalDnsHostname);
    // %COMPUTERNAME% is the truncated NetBIOS name and would cut the region/user apart.
    let hostname = gethostname::gethostname().to_string_lossy().into_owned();
    let netbios = std::env::var("COMPUTERNAME").ok();

    let username = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_default();

    let domain = std::env::var("USERDNSDOMAIN")
        .or_else(|_| std::env::var("USERDOMAIN"))
        .ok()
        .filter(|d| !d.eq_ignore_ascii_case(&hostname) && Some(d) != netbios.as_ref());

    let ip = local_ip_address::local_ip().ok().map(|ip| ip.to_string());

    let info = os_info::get();
    let os = format!("{} {}", info.os_type(), info.version());

    SystemInfo { hostname, netbios, username, domain, ip, os }
}

/// CPU / RAM / uptime via sysinfo, disks / volumes / printers via PowerShell (Windows).
/// Takes 1–3 seconds, so it runs off the main thread.
#[tauri::command]
async fn device_snapshot() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut base = snapshot::cpu_memory();
        let extra = snapshot::windows_details().unwrap_or_else(|e| {
            eprintln!("snapshot: {e}");
            json!({ "disks": [], "volumes": [], "printers": [] })
        });
        if let (Some(b), Some(e)) = (base.as_object_mut(), extra.as_object()) {
            for (k, v) in e {
                b.insert(k.clone(), v.clone());
            }
        }
        base
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn device_config() -> remote::DeviceConfig {
    remote::device_config()
}

#[tauri::command]
async fn rustdesk_id() -> Option<String> {
    tauri::async_runtime::spawn_blocking(remote::rustdesk_id).await.ok().flatten()
}

#[tauri::command]
async fn request_remote_access(ticket_id: u64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || remote::request_remote_access(ticket_id))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // A second launch focuses the already running window instead of opening another one.
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| tray::show_main(app)))
            .on_window_event(tray::on_window_event)
            .setup(|app| {
                tray::create(app.handle())?;
                // Started at sign-in by the Run key with --hidden: stay in the tray until clicked.
                if !std::env::args().any(|a| a == "--hidden") {
                    tray::show_main(app.handle());
                }
                Ok(())
            });
    }

    builder
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            system_info,
            device_snapshot,
            device_config,
            rustdesk_id,
            request_remote_access
        ])
        .run(tauri::generate_context!())
        .expect("error while running HelpDesk");
}
