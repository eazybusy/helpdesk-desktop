use serde_json::{json, Value};
use std::time::Duration;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

const GB: f64 = 1024.0 * 1024.0 * 1024.0;

fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

/// CPU load is sampled over ~1s before PowerShell starts, so the collector itself doesn't skew it.
pub fn cpu_memory() -> Value {
    let Ok(mut sys) = System::new_with_specifics(
        RefreshKind::nothing()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    ) else {
        return json!({
            "cpu": { "name": "", "cores": 0, "threads": 0, "load_percent": 0 },
            "memory": { "total_gb": 0, "used_gb": 0 },
            "uptime_hours": 0,
        });
    };
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL.max(Duration::from_millis(800)));
    sys.refresh_cpu_usage();

    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .unwrap_or_default();

    json!({
        "cpu": {
            "name": cpu_name,
            "cores": System::physical_core_count().unwrap_or(0),
            "threads": sys.cpus().len(),
            "load_percent": sys.global_cpu_usage().round() as u32,
        },
        "memory": {
            "total_gb": round1(sys.total_memory() as f64 / GB),
            "used_gb": round1(sys.used_memory() as f64 / GB),
        },
        "uptime_hours": round1(System::uptime().unwrap_or(0) as f64 / 3600.0),
    })
}

#[cfg(windows)]
pub fn windows_details() -> Result<Value, String> {
    // -EncodedCommand is not subject to execution policy (unlike -File), so it works under AllSigned GPOs.
    let script = include_str!("snapshot.ps1");
    let utf16: Vec<u8> = script.encode_utf16().flat_map(|u| u.to_le_bytes()).collect();
    let encoded = base64(&utf16);

    let out = crate::proc::run_hidden(
        "powershell.exe",
        &["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded],
        Duration::from_secs(15),
    )?;
    let text = String::from_utf8_lossy(&out);
    let text = text.trim_start_matches('\u{feff}').trim();
    serde_json::from_str(text).map_err(|e| format!("bad json: {e}"))
}

#[cfg(not(windows))]
pub fn windows_details() -> Result<Value, String> {
    Err("not windows".into())
}

#[cfg_attr(not(windows), allow(dead_code))]
fn base64(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::with_capacity(data.len().div_ceil(3) * 4);
    for c in data.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        s.push(T[(n >> 18) as usize & 63] as char);
        s.push(T[(n >> 12) as usize & 63] as char);
        s.push(if c.len() > 1 { T[(n >> 6) as usize & 63] as char } else { '=' });
        s.push(if c.len() > 2 { T[n as usize & 63] as char } else { '=' });
    }
    s
}

#[cfg(test)]
mod tests {
    #[test]
    fn cpu_memory_has_fields() {
        let v = super::cpu_memory();
        assert!(v["memory"]["total_gb"].as_f64().unwrap() > 0.0);
        assert!(v["cpu"]["threads"].as_u64().unwrap() > 0);
    }

    #[test]
    fn base64_matches_reference() {
        assert_eq!(super::base64(b"Man"), "TWFu");
        assert_eq!(super::base64(b"Ma"), "TWE=");
        assert_eq!(super::base64(b"M"), "TQ==");
        assert_eq!(super::base64(b""), "");
    }
}
