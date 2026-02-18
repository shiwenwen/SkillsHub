//! Cloud sync commands

use std::path::PathBuf;

use skillshub_core::cloud_sync::{
    CloudSyncEngine, CloudSyncResult as CoreCloudSyncResult, DetectedCloudDrive,
};
use skillshub_core::config::AppConfig;

use super::types::CloudSyncResponse;

impl From<CoreCloudSyncResult> for CloudSyncResponse {
    fn from(r: CoreCloudSyncResult) -> Self {
        Self {
            pushed: r.pushed,
            pulled: r.pulled,
        }
    }
}

fn create_cloud_engine() -> Result<CloudSyncEngine, String> {
    let config = AppConfig::load_or_default();
    let store_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("skillshub")
        .join("store");
    Ok(CloudSyncEngine::new(config.cloud_sync, store_dir))
}

#[tauri::command]
pub async fn detect_cloud_drives() -> Result<Vec<DetectedCloudDrive>, String> {
    Ok(skillshub_core::cloud_sync::detect_cloud_drives())
}

#[tauri::command]
pub async fn cloud_sync_push() -> Result<CloudSyncResponse, String> {
    let engine = create_cloud_engine()?;
    let pushed = engine.push_to_cloud().map_err(|e| e.to_string())?;
    Ok(CloudSyncResponse {
        pushed,
        pulled: vec![],
    })
}

#[tauri::command]
pub async fn cloud_sync_pull() -> Result<CloudSyncResponse, String> {
    let engine = create_cloud_engine()?;
    let pulled = engine.pull_from_cloud().map_err(|e| e.to_string())?;
    Ok(CloudSyncResponse {
        pushed: vec![],
        pulled,
    })
}

#[tauri::command]
pub async fn cloud_sync_full() -> Result<CloudSyncResponse, String> {
    let engine = create_cloud_engine()?;
    let result = engine.sync().map_err(|e| e.to_string())?;

    let mut config = AppConfig::load_or_default();
    config.cloud_sync.last_sync = Some(CloudSyncEngine::now_timestamp());
    config.save().map_err(|e| e.to_string())?;

    Ok(result.into())
}
