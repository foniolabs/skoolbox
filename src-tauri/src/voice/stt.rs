//! Offline speech-to-text — microphone capture + whisper.cpp CLI.
//! cpal streams are not Send; all capture runs on one dedicated thread.

use crate::voice::paths::VoicePaths;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{WavSpec, WavWriter};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender, SyncSender};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

const WHISPER_SAMPLE_RATE: u32 = 16_000;
const MAX_RECORD_SECS: u64 = 30;

struct Recorder {
    samples: Arc<Mutex<Vec<f32>>>,
    _stream: cpal::Stream,
    started: Instant,
    sample_rate: u32,
}

enum SttCommand {
    Start(SyncSender<Result<(), String>>),
    Stop {
        paths: VoicePaths,
        reply: SyncSender<Result<String, String>>,
    },
    Cancel,
    IsListening(SyncSender<bool>),
}

struct SttThread {
    tx: Sender<SttCommand>,
    _handle: JoinHandle<()>,
}

impl SttThread {
    fn global() -> &'static SttThread {
        static SLOT: OnceLock<SttThread> = OnceLock::new();
        SLOT.get_or_init(|| {
            let (tx, rx) = mpsc::channel();
            let handle = thread::spawn(move || stt_worker(rx));
            SttThread { tx, _handle: handle }
        })
    }

    fn send(&self, cmd: SttCommand) -> Result<(), String> {
        self.tx
            .send(cmd)
            .map_err(|_| "STT thread stopped.".to_string())
    }
}

fn stt_worker(rx: Receiver<SttCommand>) {
    let mut recorder: Option<Recorder> = None;

    while let Ok(cmd) = rx.recv() {
        match cmd {
            SttCommand::Start(reply) => {
                let result = start_recording(&mut recorder);
                let _ = reply.send(result);
            }
            SttCommand::Stop { paths, reply } => {
                let result = stop_recording(&mut recorder, &paths);
                let _ = reply.send(result);
            }
            SttCommand::Cancel => {
                recorder = None;
            }
            SttCommand::IsListening(reply) => {
                let _ = reply.send(recorder.is_some());
            }
        }
    }
}

fn whisper_bin(dir: &Path) -> Option<PathBuf> {
    let candidates = if cfg!(windows) {
        vec![
            dir.join("whisper-cli.exe"),
            dir.join("main.exe"),
            dir.join("whisper.exe"),
        ]
    } else {
        vec![dir.join("whisper-cli"), dir.join("main")]
    };
    candidates.into_iter().find(|p| p.exists())
}

fn whisper_model(dir: &Path) -> Option<PathBuf> {
    std::fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| {
            p.extension().and_then(|s| s.to_str()) == Some("bin")
                && p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.contains("ggml"))
                    .unwrap_or(false)
        })
}

fn write_wav(path: &Path, samples: &[f32], sample_rate: u32) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let spec = WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = WavWriter::create(path, spec).map_err(|e| e.to_string())?;
    for &s in samples {
        let amp = (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        writer.write_sample(amp).map_err(|e| e.to_string())?;
    }
    writer.finalize().map_err(|e| e.to_string())?;
    Ok(())
}

fn resample_to_16k(samples: &[f32], from_rate: u32) -> Vec<f32> {
    if from_rate == WHISPER_SAMPLE_RATE {
        return samples.to_vec();
    }
    let ratio = from_rate as f64 / WHISPER_SAMPLE_RATE as f64;
    let out_len = (samples.len() as f64 / ratio).floor() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src = i as f64 * ratio;
        let idx = src.floor() as usize;
        let frac = (src - idx as f64) as f32;
        let a = samples.get(idx).copied().unwrap_or(0.0);
        let b = samples.get(idx + 1).copied().unwrap_or(a);
        out.push(a + (b - a) * frac);
    }
    out
}

fn start_recording(recorder: &mut Option<Recorder>) -> Result<(), String> {
    if recorder.is_some() {
        return Err("Already listening.".to_string());
    }

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "No microphone found.".to_string())?;
    let config = device
        .default_input_config()
        .map_err(|e| format!("Microphone config error: {e}"))?;
    let sample_rate = config.sample_rate().0;
    let channels = config.channels() as usize;

    let samples = Arc::new(Mutex::new(Vec::<f32>::new()));
    let writer = samples.clone();
    let err_fn = |err| log::warn!("microphone stream error: {err}");

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => device
            .build_input_stream(
                &config.into(),
                move |data: &[f32], _| {
                    let mut buf = writer.lock().unwrap();
                    if channels == 1 {
                        buf.extend_from_slice(data);
                    } else {
                        for chunk in data.chunks(channels) {
                            let avg = chunk.iter().sum::<f32>() / channels as f32;
                            buf.push(avg);
                        }
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| e.to_string())?,
        cpal::SampleFormat::I16 => {
            let writer = samples.clone();
            device
                .build_input_stream(
                    &config.into(),
                    move |data: &[i16], _| {
                        let mut buf = writer.lock().unwrap();
                        for chunk in data.chunks(channels) {
                            let avg = chunk.iter().map(|&s| s as f32 / i16::MAX as f32).sum::<f32>()
                                / channels as f32;
                            buf.push(avg);
                        }
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| e.to_string())?
        }
        other => return Err(format!("Unsupported microphone sample format: {other:?}")),
    };

    stream.play().map_err(|e| e.to_string())?;
    *recorder = Some(Recorder {
        samples,
        _stream: stream,
        started: Instant::now(),
        sample_rate,
    });
    Ok(())
}

fn stop_recording(recorder: &mut Option<Recorder>, paths: &VoicePaths) -> Result<String, String> {
    let rec = recorder
        .take()
        .ok_or_else(|| "Not listening — hold spacebar to start.".to_string())?;

    let raw = rec.samples.lock().unwrap().clone();
    if raw.is_empty() {
        return Err("No audio captured. Check your microphone.".to_string());
    }

    if rec.started.elapsed() > Duration::from_secs(MAX_RECORD_SECS) {
        log::warn!("recording exceeded {MAX_RECORD_SECS}s cap");
    }

    let wav_path = std::env::temp_dir().join(format!("skoolbox_stt_{}.wav", std::process::id()));
    let mono = resample_to_16k(&raw, rec.sample_rate);
    write_wav(&wav_path, &mono, WHISPER_SAMPLE_RATE)?;

    let result = transcribe_wav(paths, &wav_path);
    let _ = std::fs::remove_file(&wav_path);

    if let Err(ref e) = result {
        log_stt_failure(paths, e);
    }
    result
}

fn sync_reply<T>() -> (SyncSender<T>, Receiver<T>) {
    mpsc::sync_channel(1)
}

/// Begin capturing from the default microphone (push-to-talk start).
pub fn start_listening() -> Result<(), String> {
    let (tx, rx) = sync_reply();
    SttThread::global().send(SttCommand::Start(tx))?;
    rx.recv().map_err(|_| "STT thread stopped.".to_string())?
}

/// Stop capture, run whisper.cpp if installed, return transcript text.
pub fn stop_and_transcribe(paths: &VoicePaths) -> Result<String, String> {
    let (tx, rx) = sync_reply();
    SttThread::global().send(SttCommand::Stop {
        paths: paths.clone(),
        reply: tx,
    })?;
    rx.recv().map_err(|_| "STT thread stopped.".to_string())?
}

pub fn cancel_listening() {
    let _ = SttThread::global().send(SttCommand::Cancel);
}

pub fn is_listening() -> bool {
    let (tx, rx) = sync_reply();
    if SttThread::global().send(SttCommand::IsListening(tx)).is_err() {
        return false;
    }
    rx.recv().unwrap_or(false)
}

fn transcribe_wav(paths: &VoicePaths, wav: &Path) -> Result<String, String> {
    let bin = whisper_bin(&paths.whisper_dir).ok_or_else(|| {
        "Speech recognition is not available. Reinstall SkoolBox or contact support.".to_string()
    })?;
    let model = whisper_model(&paths.whisper_dir).ok_or_else(|| {
        "Speech recognition model not found. Reinstall SkoolBox or contact support.".to_string()
    })?;

    let output = std::process::Command::new(&bin)
        .args([
            "-m",
            model.to_str().unwrap(),
            "-f",
            wav.to_str().unwrap(),
            "-l",
            "en",
            "-nt",
        ])
        .output()
        .map_err(|e| format!("Whisper failed to run: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Whisper error: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let text = stdout
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    if text.is_empty() {
        return Err("Could not understand the audio. Try speaking closer to the mic.".to_string());
    }
    Ok(text)
}

fn log_stt_failure(paths: &VoicePaths, err: &str) {
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&paths.stt_failures_log)
    {
        let _ = writeln!(f, "{}", err);
    }
}

#[derive(serde::Serialize)]
pub struct SttStatus {
    pub available: bool,
    pub listening: bool,
    pub engine: String,
}

pub fn status(paths: &VoicePaths) -> SttStatus {
    let has_whisper =
        whisper_bin(&paths.whisper_dir).is_some() && whisper_model(&paths.whisper_dir).is_some();
    SttStatus {
        available: has_whisper,
        listening: is_listening(),
        engine: if has_whisper {
            "whisper-small".to_string()
        } else {
            "none".to_string()
        },
    }
}
