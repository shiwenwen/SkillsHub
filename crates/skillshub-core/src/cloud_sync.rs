//! Cloud storage sync for SkillsHub
//!
//! Syncs skills to/from cloud storage providers (iCloud Drive, Google Drive, OneDrive)
//! by using their local folder mount points.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::config::{CloudSyncConfig, CloudSyncProvider};
use crate::error::{Error, Result};

/// A detected cloud drive on the local filesystem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedCloudDrive {
    pub provider: CloudSyncProvider,
    pub path: String,
    pub display_name: String,
}

/// Result of a cloud sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncResult {
    pub pushed: Vec<String>,
    pub pulled: Vec<String>,
}

/// Detect available cloud drives on the system
pub fn detect_cloud_drives() -> Vec<DetectedCloudDrive> {
    let mut drives = Vec::new();
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return drives,
    };

    // macOS: iCloud Drive
    let icloud = home.join("Library/Mobile Documents/com~apple~CloudDrive");
    if icloud.exists() {
        drives.push(DetectedCloudDrive {
            provider: CloudSyncProvider::ICloud,
            path: icloud.to_string_lossy().to_string(),
            display_name: "iCloud Drive".into(),
        });
    }

    // macOS: CloudStorage directory (Google Drive, OneDrive)
    let cloud_storage = home.join("Library/CloudStorage");
    if let Ok(entries) = fs::read_dir(&cloud_storage) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("GoogleDrive") && entry.path().is_dir() {
                drives.push(DetectedCloudDrive {
                    provider: CloudSyncProvider::GoogleDrive,
                    path: entry.path().to_string_lossy().to_string(),
                    display_name: format!("Google Drive ({})", name),
                });
            }
            if name.starts_with("OneDrive") && entry.path().is_dir() {
                drives.push(DetectedCloudDrive {
                    provider: CloudSyncProvider::OneDrive,
                    path: entry.path().to_string_lossy().to_string(),
                    display_name: format!("OneDrive ({})", name),
                });
            }
        }
    }

    // Windows paths
    #[cfg(windows)]
    {
        let onedrive = home.join("OneDrive");
        if onedrive.is_dir() {
            drives.push(DetectedCloudDrive {
                provider: CloudSyncProvider::OneDrive,
                path: onedrive.to_string_lossy().to_string(),
                display_name: "OneDrive".into(),
            });
        }
        let gdrive = home.join("Google Drive");
        if gdrive.is_dir() {
            drives.push(DetectedCloudDrive {
                provider: CloudSyncProvider::GoogleDrive,
                path: gdrive.to_string_lossy().to_string(),
                display_name: "Google Drive".into(),
            });
        }
    }

    drives
}

/// Cloud sync engine
pub struct CloudSyncEngine {
    config: CloudSyncConfig,
    store_dir: PathBuf,
}

impl CloudSyncEngine {
    /// Create a new cloud sync engine
    ///
    /// `store_dir` is the local store root (e.g. `~/.local/share/skillshub/store`)
    pub fn new(config: CloudSyncConfig, store_dir: PathBuf) -> Self {
        Self { config, store_dir }
    }

    /// The cloud-side SkillsHub directory
    fn cloud_root(&self) -> Result<PathBuf> {
        let folder = self
            .config
            .sync_folder
            .as_ref()
            .ok_or_else(|| Error::SyncError("Cloud sync folder not configured".into()))?;

        // Expand ~ to home directory
        let expanded = if let Some(stripped) = folder.strip_prefix("~/") {
            let home = dirs::home_dir()
                .ok_or_else(|| Error::SyncError("Cannot determine home directory".into()))?;
            home.join(stripped)
        } else {
            PathBuf::from(folder)
        };

        Ok(expanded.join("SkillsHub"))
    }

    fn cloud_skills_dir(&self) -> Result<PathBuf> {
        Ok(self.cloud_root()?.join("skills"))
    }

    fn cloud_metadata_dir(&self) -> Result<PathBuf> {
        Ok(self.cloud_root()?.join("metadata"))
    }

    fn local_skills_dir(&self) -> PathBuf {
        self.store_dir.join("skills")
    }

    fn local_metadata_dir(&self) -> PathBuf {
        self.store_dir.join("metadata")
    }

    /// Push local skills and metadata to cloud
    pub fn push_to_cloud(&self) -> Result<Vec<String>> {
        let cloud_skills = self.cloud_skills_dir()?;
        let cloud_metadata = self.cloud_metadata_dir()?;
        fs::create_dir_all(&cloud_skills)?;
        fs::create_dir_all(&cloud_metadata)?;

        let mut pushed = Vec::new();

        // Push skills
        let local_skills = self.local_skills_dir();
        if local_skills.is_dir() {
            for entry in fs::read_dir(&local_skills)?.flatten() {
                if entry.path().is_dir() {
                    let skill_id = entry.file_name().to_string_lossy().to_string();
                    let dest = cloud_skills.join(&skill_id);
                    copy_dir_all(&entry.path(), &dest)?;
                    pushed.push(skill_id);
                }
            }
        }

        // Push metadata
        let local_metadata = self.local_metadata_dir();
        if local_metadata.is_dir() {
            for entry in fs::read_dir(&local_metadata)?.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name() {
                        fs::copy(&path, cloud_metadata.join(name))?;
                    }
                }
            }
        }

        Ok(pushed)
    }

    /// Pull skills from cloud that are not present locally
    pub fn pull_from_cloud(&self) -> Result<Vec<String>> {
        let cloud_skills = self.cloud_skills_dir()?;
        let cloud_metadata = self.cloud_metadata_dir()?;
        let local_skills = self.local_skills_dir();
        let local_metadata = self.local_metadata_dir();
        fs::create_dir_all(&local_skills)?;
        fs::create_dir_all(&local_metadata)?;

        let mut pulled = Vec::new();

        // Pull skills not present locally
        if cloud_skills.is_dir() {
            for entry in fs::read_dir(&cloud_skills)?.flatten() {
                if entry.path().is_dir() {
                    let skill_id = entry.file_name().to_string_lossy().to_string();
                    let local_dest = local_skills.join(&skill_id);
                    if !local_dest.exists() {
                        copy_dir_all(&entry.path(), &local_dest)?;
                        pulled.push(skill_id);
                    }
                }
            }
        }

        // Pull metadata not present locally
        if cloud_metadata.is_dir() {
            for entry in fs::read_dir(&cloud_metadata)?.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name() {
                        let local_dest = local_metadata.join(name);
                        if !local_dest.exists() {
                            fs::copy(&path, &local_dest)?;
                        }
                    }
                }
            }
        }

        Ok(pulled)
    }

    /// Full bidirectional sync (push then pull, local wins on conflict)
    pub fn sync(&self) -> Result<CloudSyncResult> {
        if !self.config.enabled {
            return Err(Error::SyncError("Cloud sync is not enabled".into()));
        }

        let pushed = self.push_to_cloud()?;
        let pulled = self.pull_from_cloud()?;

        Ok(CloudSyncResult { pushed, pulled })
    }

    /// Get the current timestamp as ISO 8601 string
    pub fn now_timestamp() -> String {
        use std::time::SystemTime;
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        format!("{}", now)
    }
}

/// Recursively copy a directory
fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)?.flatten() {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}
