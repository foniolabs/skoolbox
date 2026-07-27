//! Offline model-runtime manager — makes the app self-contained (no manual
//! Ollama install, no `ollama pull`, no internet).
//!
//! On launch the app calls [`ensure_ollama`], which:
//!   1. Finds an `ollama` binary — the one **bundled in the installer**
//!      (`resources/runtime/ollama[.exe]`) first, else a system install on PATH
//!      (so developer machines keep working unchanged).
//!   2. Points Ollama's model store at a writable app-data dir (`OLLAMA_MODELS`)
//!      so the seeded model persists per install.
//!   3. Starts `ollama serve` if nothing is already listening on 11434.
//!   4. In the background, **seeds the bundled Qwen model on first run** by
//!      importing a bundled GGUF via a Modelfile — entirely from local disk,
//!      the step that makes install work with zero internet.
//!
//! The seeded model is named [`BUNDLED_MODEL`]; `ollama::best_installed_model`
//! prefers it, so no DB setting is needed. Everything here is best-effort: if no
//! binary/model is bundled (e.g. a dev checkout), it degrades to today's
//! behaviour (talk to whatever Ollama is already running) and never blocks the UI.

use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::Child;
use std::time::Duration;

use tauri::{AppHandle, Manager};

/// Name of the model seeded from the bundled GGUF (see `best_installed_model`).
pub const BUNDLED_MODEL: &str = "martha";

/// Handle to the Ollama process we started, so it can be stopped on app exit.
/// If Ollama was already running (dev machine), this holds `None` and we leave
/// that server alone.
pub struct OllamaProcess(pub std::sync::Mutex<Option<Child>>);

/// Is something already listening on the Ollama port?
fn ollama_reachable() -> bool {
    let Ok(mut addrs) = "127.0.0.1:11434".to_socket_addrs() else {
        return false;
    };
    addrs.any(|addr| TcpStream::connect_timeout(&addr, Duration::from_millis(400)).is_ok())
}

/// Locate the Ollama binary: bundled resource first, then system PATH.
fn find_ollama(app: &AppHandle) -> Option<PathBuf> {
    let exe = if cfg!(windows) { "ollama.exe" } else { "ollama" };

    // 1. Bundled with the installer (the offline path).
    if let Ok(res) = app
        .path()
        .resolve(format!("runtime/{exe}"), tauri::path::BaseDirectory::Resource)
    {
        if res.exists() {
            return Some(res);
        }
    }

    // 2. System install on PATH (developer machines).
    if which_ok(exe) {
        return Some(PathBuf::from(exe));
    }
    None
}

/// Cheap PATH check via the platform "which"/"where" tool.
fn which_ok(exe: &str) -> bool {
    let finder = if cfg!(windows) { "where" } else { "which" };
    std::process::Command::new(finder)
        .arg(exe)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Writable per-install model store.
fn models_dir(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?.join("ollama-models");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

/// Start the model runtime and kick off first-run seeding. Best-effort; returns
/// the spawned child (if we started one) to be tracked for shutdown.
pub fn ensure_ollama(app: &AppHandle) -> Option<Child> {
    let bin = match find_ollama(app) {
        Some(b) => b,
        None => {
            log::warn!(
                "No bundled or system Ollama found — the AI will be unavailable until \
                 one is installed. (Release installers bundle it under resources/runtime/.)"
            );
            return None;
        }
    };
    let store = models_dir(app);

    // If a server is already up (dev machine), don't start a second one — just
    // make sure the model is seeded against it.
    let child = if ollama_reachable() {
        log::info!("Ollama already running; using it.");
        None
    } else {
        log::info!("Starting bundled Ollama ({})", bin.display());
        let mut cmd = std::process::Command::new(&bin);
        cmd.arg("serve");
        if let Some(dir) = &store {
            cmd.env("OLLAMA_MODELS", dir);
        }
        cmd.stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        // Don't flash a console window on Windows.
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        match cmd.spawn() {
            Ok(c) => Some(c),
            Err(e) => {
                log::error!("Could not start Ollama: {e}");
                return None;
            }
        }
    };

    // First-run model import happens off the main thread so the window opens
    // promptly; importing a ~2 GB GGUF takes a little while.
    let modelfile = app
        .path()
        .resolve("runtime/Martha.offline.Modelfile", tauri::path::BaseDirectory::Resource)
        .ok();
    std::thread::spawn(move || seed_model(bin, store, modelfile));

    child
}

/// Wait for the server, then import the bundled model if it isn't present yet.
fn seed_model(bin: PathBuf, store: Option<PathBuf>, modelfile: Option<PathBuf>) {
    // Wait up to ~20 s for `ollama serve` to accept connections.
    let mut ready = false;
    for _ in 0..40 {
        if ollama_reachable() {
            ready = true;
            break;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    if !ready {
        log::warn!("Ollama did not become reachable; skipping model seed.");
        return;
    }

    if model_present(&bin, store.as_deref(), BUNDLED_MODEL) {
        log::info!("Model '{BUNDLED_MODEL}' already present; no seed needed.");
        return;
    }

    let Some(modelfile) = modelfile.filter(|p| p.exists()) else {
        log::warn!(
            "No bundled Modelfile — cannot seed '{BUNDLED_MODEL}' offline. \
             (A dev machine can `ollama pull` instead.)"
        );
        return;
    };

    log::info!("Seeding '{BUNDLED_MODEL}' from bundled GGUF (first run, offline)…");
    let mut cmd = std::process::Command::new(&bin);
    cmd.args(["create", BUNDLED_MODEL, "-f"]).arg(&modelfile);
    if let Some(dir) = &store {
        cmd.env("OLLAMA_MODELS", dir);
    }
    match cmd.status() {
        Ok(s) if s.success() => log::info!("Model '{BUNDLED_MODEL}' seeded successfully."),
        Ok(s) => log::error!("Seeding '{BUNDLED_MODEL}' failed (exit {s})."),
        Err(e) => log::error!("Could not run `ollama create`: {e}"),
    }
}

/// Is `name` already in the local model store? (`ollama list` output scan.)
fn model_present(bin: &Path, store: Option<&Path>, name: &str) -> bool {
    let mut cmd = std::process::Command::new(bin);
    cmd.arg("list");
    if let Some(dir) = store {
        cmd.env("OLLAMA_MODELS", dir);
    }
    match cmd.output() {
        Ok(out) => String::from_utf8_lossy(&out.stdout).contains(name),
        Err(_) => false,
    }
}
