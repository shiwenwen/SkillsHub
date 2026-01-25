//! Local Store - skill repository management

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use walkdir::WalkDir;

use crate::error::{Error, Result};
use crate::models::{InstallRecord, Skill};

/// Local store configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreConfig {
    /// Root directory for the store
    pub root_dir: PathBuf,
}

impl Default for StoreConfig {
    fn default() -> Self {
        let root_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("skillshub")
            .join("store");
        Self { root_dir }
    }
}

/// Local skill store
pub struct LocalStore {
    config: StoreConfig,
    /// Cached install records
    records: HashMap<String, InstallRecord>,
}

impl LocalStore {
    /// Create a new local store
    pub fn new(config: StoreConfig) -> Result<Self> {
        fs::create_dir_all(&config.root_dir)?;
        fs::create_dir_all(config.root_dir.join("skills"))?;
        fs::create_dir_all(config.root_dir.join("metadata"))?;

        let mut store = Self {
            config,
            records: HashMap::new(),
        };
        store.load_records()?;
        Ok(store)
    }

    /// Create with default config
    pub fn default_store() -> Result<Self> {
        Self::new(StoreConfig::default())
    }

    /// Get the root directory
    pub fn root_dir(&self) -> &Path {
        &self.config.root_dir
    }

    /// Get the skills directory
    pub fn skills_dir(&self) -> PathBuf {
        self.config.root_dir.join("skills")
    }

    /// Get the path for a specific skill
    pub fn skill_path(&self, skill_id: &str) -> PathBuf {
        self.skills_dir().join(skill_id)
    }

    /// Check if a skill is installed
    pub fn is_installed(&self, skill_id: &str) -> bool {
        self.records.contains_key(skill_id)
    }

    /// Get install record for a skill
    pub fn get_record(&self, skill_id: &str) -> Option<&InstallRecord> {
        self.records.get(skill_id)
    }

    /// List all installed skills
    pub fn list_installed(&self) -> Vec<&InstallRecord> {
        self.records.values().collect()
    }

    /// Import a skill to the store
    pub async fn import_skill(&mut self, skill: &Skill, source_path: &Path) -> Result<InstallRecord> {
        let skill_dir = self.skill_path(&skill.id);
        
        // Copy skill files
        if source_path.is_dir() {
            copy_dir_all(source_path, &skill_dir)?;
        } else {
            fs::create_dir_all(&skill_dir)?;
            let dest = skill_dir.join(source_path.file_name().unwrap_or_default());
            fs::copy(source_path, dest)?;
        }

        // Create install record
        let record = InstallRecord {
            skill_id: skill.id.clone(),
            version: skill.version.clone(),
            installed_at: timestamp_now(),
            source: skill.source.clone(),
            projected_tools: Vec::new(),
            scan_passed: true,
        };

        self.save_record(&record)?;
        self.records.insert(skill.id.clone(), record.clone());

        Ok(record)
    }

    /// Remove a skill from the store
    pub fn remove_skill(&mut self, skill_id: &str) -> Result<()> {
        let skill_dir = self.skill_path(skill_id);
        if skill_dir.exists() {
            fs::remove_dir_all(&skill_dir)?;
        }

        let metadata_path = self.metadata_path(skill_id);
        if metadata_path.exists() {
            fs::remove_file(&metadata_path)?;
        }

        self.records.remove(skill_id);
        Ok(())
    }

    /// Calculate content hash for a skill directory
    pub fn calculate_hash(&self, skill_id: &str) -> Result<String> {
        let skill_dir = self.skill_path(skill_id);
        if !skill_dir.exists() {
            return Err(Error::SkillNotFound(skill_id.to_string()));
        }

        let mut hasher = Sha256::new();
        
        for entry in WalkDir::new(&skill_dir).sort_by_file_name() {
            let entry = entry.map_err(|e| Error::Io(e.into()))?;
            if entry.file_type().is_file() {
                let content = fs::read(entry.path())?;
                hasher.update(&content);
            }
        }

        Ok(hex::encode(hasher.finalize()))
    }

    fn metadata_path(&self, skill_id: &str) -> PathBuf {
        self.config.root_dir.join("metadata").join(format!("{}.json", skill_id))
    }

    fn save_record(&self, record: &InstallRecord) -> Result<()> {
        let path = self.metadata_path(&record.skill_id);
        let content = serde_json::to_string_pretty(record)?;
        fs::write(path, content)?;
        Ok(())
    }

    fn load_records(&mut self) -> Result<()> {
        let metadata_dir = self.config.root_dir.join("metadata");
        if !metadata_dir.exists() {
            return Ok(());
        }

        for entry in fs::read_dir(metadata_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(record) = serde_json::from_str::<InstallRecord>(&content) {
                        self.records.insert(record.skill_id.clone(), record);
                    }
                }
            }
        }

        Ok(())
    }
}

/// Recursively copy a directory
fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

fn timestamp_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", duration.as_secs())
}
