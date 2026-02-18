//! Configuration, store info, and utility commands

use std::path::PathBuf;

use skillshub_core::config::AppConfig;

use super::types::StoreInfo;

#[tauri::command]
pub async fn get_app_config() -> Result<AppConfig, String> {
    AppConfig::load().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_app_config(config: AppConfig) -> Result<(), String> {
    config.save().map_err(|e| e.to_string())
}

fn calc_dir_size(path: &std::path::Path) -> u64 {
    let mut size = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            if entry_path.is_file() {
                size += entry.metadata().map(|m| m.len()).unwrap_or(0);
            } else if entry_path.is_dir() {
                size += calc_dir_size(&entry_path);
            }
        }
    }
    size
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

#[tauri::command]
pub async fn get_store_info() -> Result<StoreInfo, String> {
    let store_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("skillshub")
        .join("store");

    let path = store_dir.display().to_string();

    let size_bytes = if store_dir.exists() {
        calc_dir_size(&store_dir)
    } else {
        0
    };
    let size_display = format_size(size_bytes);

    let skill_count = if store_dir.join("skills").exists() {
        std::fs::read_dir(store_dir.join("skills"))
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_dir())
                    .count()
            })
            .unwrap_or(0)
    } else {
        0
    };

    Ok(StoreInfo {
        path,
        size_bytes,
        size_display,
        skill_count,
    })
}

#[tauri::command]
pub async fn open_directory(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    Ok(())
}
