//! Device configuration (from the registry, deployed by GPO) and RustDesk remote access.

use serde::Serialize;
#[cfg(windows)]
use std::time::Duration;

use crate::proc::run_hidden;

#[derive(Serialize, Default)]
pub struct DeviceConfig {
    /// HelpDesk API base URL. None → the release app can't connect (dev builds use demo data).
    api_url: Option<String>,
    /// Sent as X-Device-Key when the app opens an employee session.
    device_key: Option<String>,
}

/// Policy key first (GPO "Registry" preference or ADMX), then the plain key. Debug builds only:
/// ITSUPPORT_API_URL / ITSUPPORT_DEVICE_KEY override them (a user can't redirect a release build).
pub fn device_config() -> DeviceConfig {
    let mut cfg = DeviceConfig::default();
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        for path in ["SOFTWARE\\Policies\\ITSupport", "SOFTWARE\\ITSupport"] {
            if let Ok(key) = hklm.open_subkey(path) {
                if cfg.api_url.is_none() {
                    cfg.api_url = key.get_value::<String, _>("ApiUrl").ok().filter(|s| !s.trim().is_empty());
                }
                if cfg.device_key.is_none() {
                    cfg.device_key = key.get_value::<String, _>("DeviceKey").ok().filter(|s| !s.trim().is_empty());
                }
            }
        }
    }
    if cfg!(debug_assertions) {
        if let Ok(v) = std::env::var("ITSUPPORT_API_URL") {
            cfg.api_url = Some(v);
        }
        if let Ok(v) = std::env::var("ITSUPPORT_DEVICE_KEY") {
            cfg.device_key = Some(v);
        }
    }
    cfg
}

/// RustDesk shows IDs as digits (sometimes with a custom alphanumeric ID set by --set-id).
fn clean_id(raw: &str) -> Option<String> {
    let id: String = raw.chars().filter(|c| !c.is_whitespace()).collect();
    (id.len() >= 6 && id.len() <= 32 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')).then_some(id)
}

/// `id = '123456789'` from a RustDesk.toml (older clients store it in plain text).
fn id_from_toml(text: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let (k, v) = line.split_once('=')?;
        (k.trim() == "id").then(|| clean_id(v.trim().trim_matches(|c| c == '\'' || c == '"'))).flatten()
    })
}

pub fn rustdesk_id() -> Option<String> {
    #[cfg(windows)]
    {
        let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into());
        let exe = format!("{pf}\\RustDesk\\rustdesk.exe");
        if std::path::Path::new(&exe).exists() {
            if let Ok(out) = run_hidden(&exe, &["--get-id"], Duration::from_secs(8)) {
                if let Some(id) = clean_id(String::from_utf8_lossy(&out).lines().last().unwrap_or("")) {
                    return Some(id);
                }
            }
        }
        let mut tomls = vec!["C:\\Windows\\ServiceProfiles\\LocalService\\AppData\\Roaming\\RustDesk\\config\\RustDesk.toml".to_string()];
        if let Ok(appdata) = std::env::var("APPDATA") {
            tomls.push(format!("{appdata}\\RustDesk\\config\\RustDesk.toml"));
        }
        for p in tomls {
            if let Some(id) = std::fs::read_to_string(&p).ok().as_deref().and_then(id_from_toml) {
                return Some(id);
            }
        }
        None
    }
    #[cfg(not(windows))]
    {
        let _ = (run_hidden, id_from_toml);
        None
    }
}

/// Ask the SYSTEM task (deploy/RemoteAccess.ps1) to set a fresh RustDesk password for this ticket.
/// The app never sees the password: the task sends it to the server itself.
pub fn request_remote_access(ticket_id: u64) -> Result<(), String> {
    #[cfg(windows)]
    {
        let data = std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".into());
        let dir = format!("{data}\\ITSupport\\requests");
        std::fs::create_dir_all(&dir).map_err(|e| format!("{dir}: {e}"))?;
        std::fs::write(format!("{dir}\\{ticket_id}.req"), ticket_id.to_string()).map_err(|e| e.to_string())?;
        run_hidden("schtasks.exe", &["/Run", "/TN", "\\ITSupport\\RemoteAccess"], Duration::from_secs(10)).map(|_| ())
    }
    #[cfg(not(windows))]
    {
        let _ = ticket_id;
        Err("not windows".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ids() {
        assert_eq!(clean_id("123 456 789\r\n").as_deref(), Some("123456789"));
        assert_eq!(clean_id("abc").as_deref(), None);
        assert_eq!(clean_id("12345; rm").as_deref(), None);
        assert_eq!(id_from_toml("enc_id = ''\nid = '987654321'\npassword = 'x'").as_deref(), Some("987654321"));
        assert_eq!(id_from_toml("enc_id = '00abc'").as_deref(), None);
    }
}
