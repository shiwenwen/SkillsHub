//! Configuration management for SkillsHub

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::models::SyncStrategy;

/// Cloud storage provider
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CloudSyncProvider {
    ICloud,
    GoogleDrive,
    OneDrive,
    Custom,
}

/// Cloud sync configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CloudSyncConfig {
    /// Whether cloud sync is enabled
    #[serde(default)]
    pub enabled: bool,

    /// Cloud storage provider
    #[serde(default)]
    pub provider: Option<CloudSyncProvider>,

    /// Resolved absolute path to the cloud sync folder
    #[serde(default)]
    pub sync_folder: Option<String>,

    /// Auto-sync to cloud on skill install/update
    #[serde(default)]
    pub auto_sync: bool,

    /// Last sync timestamp (ISO 8601)
    #[serde(default)]
    pub last_sync: Option<String>,
}

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Default sync strategy
    #[serde(default)]
    pub default_sync_strategy: SyncStrategy,

    /// Auto sync on install
    #[serde(default = "default_true")]
    pub auto_sync_on_install: bool,

    /// Check updates on startup
    #[serde(default = "default_true")]
    pub check_updates_on_startup: bool,

    /// Scan before install
    #[serde(default = "default_true")]
    pub scan_before_install: bool,

    /// Scan before update
    #[serde(default = "default_true")]
    pub scan_before_update: bool,

    /// Block high risk skills
    #[serde(default = "default_true")]
    pub block_high_risk: bool,

    /// Cloud sync configuration
    #[serde(default)]
    pub cloud_sync: CloudSyncConfig,
}

fn default_true() -> bool {
    true
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            default_sync_strategy: SyncStrategy::Auto,
            auto_sync_on_install: true,
            check_updates_on_startup: true,
            scan_before_install: true,
            scan_before_update: true,
            block_high_risk: true,
            cloud_sync: CloudSyncConfig::default(),
        }
    }
}

impl AppConfig {
    /// Get the config file path
    pub fn config_path() -> Result<PathBuf> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| Error::StoreError("Cannot find config directory".to_string()))?;

        let app_config_dir = config_dir.join("skillshub");

        // Create config directory if it doesn't exist
        if !app_config_dir.exists() {
            fs::create_dir_all(&app_config_dir)
                .map_err(|e| Error::StoreError(format!("Failed to create config dir: {}", e)))?;
        }

        Ok(app_config_dir.join("config.json"))
    }

    /// Load configuration from file
    pub fn load() -> Result<Self> {
        let config_path = Self::config_path()?;

        if !config_path.exists() {
            // Return default config if file doesn't exist
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&config_path)
            .map_err(|e| Error::StoreError(format!("Failed to read config: {}", e)))?;

        let config: AppConfig = serde_json::from_str(&content)
            .map_err(|e| Error::StoreError(format!("Failed to parse config: {}", e)))?;

        Ok(config)
    }

    /// Save configuration to file
    pub fn save(&self) -> Result<()> {
        let config_path = Self::config_path()?;

        let content = serde_json::to_string_pretty(self)
            .map_err(|e| Error::StoreError(format!("Failed to serialize config: {}", e)))?;

        fs::write(&config_path, content)
            .map_err(|e| Error::StoreError(format!("Failed to write config: {}", e)))?;

        Ok(())
    }

    /// Load or create default configuration
    pub fn load_or_default() -> Self {
        Self::load().unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        assert!(matches!(config.default_sync_strategy, SyncStrategy::Auto));
        assert!(config.auto_sync_on_install);
        assert!(config.check_updates_on_startup);
        assert!(config.scan_before_install);
        assert!(config.scan_before_update);
        assert!(config.block_high_risk);
    }

    #[test]
    fn test_config_serialization() {
        let config = AppConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&json).unwrap();

        assert!(matches!(deserialized.default_sync_strategy, SyncStrategy::Auto));
        assert_eq!(deserialized.auto_sync_on_install, config.auto_sync_on_install);
    }

    #[test]
    fn test_frontend_config_deserialization() {
        let json = r#"{"default_sync_strategy":"auto","auto_sync_on_install":true,"check_updates_on_startup":true,"scan_before_install":true,"scan_before_update":true,"block_high_risk":true,"cloud_sync":{"enabled":true,"provider":"ICloud","sync_folder":"~/Documents","auto_sync":false,"last_sync":null}}"#;
        let config: AppConfig = serde_json::from_str(json).unwrap();
        assert!(config.cloud_sync.enabled);
        assert_eq!(config.cloud_sync.provider, Some(CloudSyncProvider::ICloud));
        assert_eq!(config.cloud_sync.sync_folder, Some("~/Documents".to_string()));
    }
}
