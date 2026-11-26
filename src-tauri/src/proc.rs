//! Run a helper program without a console window, with a hard timeout.

use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

pub fn run_hidden(program: &str, args: &[&str], timeout: Duration) -> Result<Vec<u8>, String> {
    let mut cmd = Command::new(program);
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::null()).stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = cmd.spawn().map_err(|e| format!("{program}: {e}"))?;

    // Read stdout on another thread so a chatty child can't block on a full pipe.
    let mut stdout = child.stdout.take().ok_or("no stdout")?;
    let reader = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stdout.read_to_end(&mut buf);
        buf
    });

    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if start.elapsed() > timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("{program} timed out"));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(50)),
            Err(e) => {
                let _ = child.kill();
                return Err(e.to_string());
            }
        }
    };
    let out = reader.join().map_err(|_| "reader panicked")?;
    if !status.success() {
        return Err(format!("{program} exited with {status}"));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn captures_output_and_times_out() {
        let out = run_hidden("sh", &["-c", "echo hello"], Duration::from_secs(5)).unwrap();
        assert_eq!(String::from_utf8_lossy(&out).trim(), "hello");
        assert!(run_hidden("sh", &["-c", "sleep 5"], Duration::from_millis(300)).is_err());
        assert!(run_hidden("sh", &["-c", "exit 3"], Duration::from_secs(5)).is_err());
    }
}
