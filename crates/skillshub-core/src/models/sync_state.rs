//! Sync state models

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use super::{SkillVersion, SyncStrategy, ToolType};

/// Sync state for all tools
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncState {
    /// Per-tool sync status
    pub tools: HashMap<String, ToolSyncState>,
    /// Last sync timestamp
    pub last_sync: Option<String>,
}

/// Sync state for a single tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSyncState {
    /// Tool type
    pub tool: ToolType,
    /// Skills synced to this tool
    pub skills: HashMap<String, SkillSyncStatus>,
    /// Last sync time for this tool
    pub last_sync: Option<String>,
}

/// Sync status for a single skill in a tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSyncStatus {
    /// Skill ID
    pub skill_id: String,
    /// Version synced to this tool
    pub version: SkillVersion,
    /// Strategy used for sync
    pub strategy: SyncStrategy,
    /// Target path in tool directory
    pub target_path: PathBuf,
    /// Whether there's drift detected
    pub drift: Option<DriftInfo>,
}

/// Information about drift
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftInfo {
    /// Type of drift
    pub drift_type: DriftType,
    /// Description of the drift
    pub description: String,
    /// Detected at timestamp
    pub detected_at: String,
}

/// Types of drift that can occur
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DriftType {
    /// Skill is missing from tool directory
    Missing,
    /// Version mismatch
    VersionMismatch,
    /// Content was modified locally
    ContentModified,
    /// Link is broken
    BrokenLink,
    /// Link points to wrong location
    WrongTarget,
}

impl std::fmt::Display for DriftType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DriftType::Missing => write!(f, "missing"),
            DriftType::VersionMismatch => write!(f, "version mismatch"),
            DriftType::ContentModified => write!(f, "content modified"),
            DriftType::BrokenLink => write!(f, "broken link"),
            DriftType::WrongTarget => write!(f, "wrong target"),
        }
    }
}

/// Plan for a sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPlan {
    /// Skills to add
    pub to_add: Vec<SyncAction>,
    /// Skills to update
    pub to_update: Vec<SyncAction>,
    /// Skills to remove
    pub to_remove: Vec<SyncAction>,
    /// Drifts to repair
    pub to_repair: Vec<SyncAction>,
}

impl SyncPlan {
    pub fn new() -> Self {
        Self {
            to_add: Vec::new(),
            to_update: Vec::new(),
            to_remove: Vec::new(),
            to_repair: Vec::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.to_add.is_empty()
            && self.to_update.is_empty()
            && self.to_remove.is_empty()
            && self.to_repair.is_empty()
    }
}

impl Default for SyncPlan {
    fn default() -> Self {
        Self::new()
    }
}

/// A sync action to perform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncAction {
    /// Skill ID
    pub skill_id: String,
    /// Target tool
    pub tool: ToolType,
    /// Action type
    pub action: SyncActionType,
    /// Strategy to use
    pub strategy: SyncStrategy,
}

/// Type of sync action
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncActionType {
    Add,
    Update,
    Remove,
    Repair,
}

/// A skill scanned from a tool's skills directory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedSkill {
    /// Skill ID (directory name)
    pub id: String,
    /// Full path to the skill
    pub path: PathBuf,
    /// Which tool this skill was found in
    pub tool: ToolType,
    /// Whether this skill exists in SkillsHub central repository
    pub in_hub: bool,
    /// Whether this is a symlink
    pub is_link: bool,
}

/// Sync status for the Hub's central view
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HubSyncStatus {
    /// Skill ID
    pub skill_id: String,
    /// Path in SkillsHub repository
    pub hub_path: PathBuf,
    /// Tools that have this skill
    pub synced_to: Vec<ToolType>,
    /// Tools missing this skill
    pub missing_in: Vec<ToolType>,
}
