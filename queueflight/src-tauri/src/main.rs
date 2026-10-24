// Copyright (c) 2026 OKAN TIKTAS. MIT License.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs::{File, OpenOptions}, io::{Read, Write}};
const MAX_BYTES: u64 = 5 * 1024 * 1024;

/// The frontend cannot name arbitrary files: a native picker grants each import.
#[tauri::command]
fn import_capture() -> Result<Option<String>, String> {
    let Some(path) = rfd::FileDialog::new().add_filter("JSON capture", &["json"]).pick_file() else {
        return Ok(None);
    };
    let file = File::open(path).map_err(|_| "Unable to open the selected file.")?;
    let mut bytes = Vec::new();
    file.take(MAX_BYTES + 1).read_to_end(&mut bytes).map_err(|_| "Unable to read the capture.")?;
    if bytes.len() as u64 > MAX_BYTES { return Err("Capture exceeds 5 MiB.".into()); }
    let text = String::from_utf8(bytes).map_err(|_| "Capture must be UTF-8 JSON.")?;
    Ok(Some(text))
}
/// File output is granted by a native save picker, never a frontend file path.
#[tauri::command]
fn export_json(json: String, filename: String) -> Result<bool, String> {
    if json.len() > 10 * 1024 * 1024 { return Err("Export exceeds 10 MiB.".into()); }
    if !["queueflight-lambda-fixture.json", "queueflight-message-fixture.json"].contains(&filename.as_str()) {
        return Err("Unsupported export name.".into());
    }
    let Some(path) = rfd::FileDialog::new().add_filter("JSON fixture", &["json"]).set_file_name(&filename).save_file() else {
        return Ok(false);
    };
    let mut file = OpenOptions::new().write(true).create_new(true).open(&path)
        .map_err(|_| "Choose a new file name. Existing files are not overwritten.")?;
    if file.write_all(json.as_bytes()).is_err() {
        drop(file);
        let _ = std::fs::remove_file(path);
        return Err("Unable to write the fixture.".into());
    }
    Ok(true)
}
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![import_capture, export_json])
        .run(tauri::generate_context!())
        .expect("Unable to start QueueFlight");
}
