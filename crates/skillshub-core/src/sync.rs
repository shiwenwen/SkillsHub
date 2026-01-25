//! Sync Engine - multi-tool synchronization

use std::fs;
use std::path::Path;

use crate::adapters::ToolAdapter;
use crate::error::{Error, Result};
use crate::models::{
    DriftInfo, DriftType, SkillSyncStatus, SyncAction, SyncActionType, SyncPlan,
    SyncState, SyncStrategy, ToolProfile, ToolSyncState, ToolType,
};
use crate::store::LocalStore;

/// Sync engine for managing multi-tool synchronization
pub struct SyncEngine {
    store: LocalStore,
    adapters: Vec<Box<dyn ToolAdapter>>,
    state: SyncState,
}

impl SyncEngine {
    /// Create a new sync engine
    pub fn new(store: LocalStore) -> Self {
        Self {
            store,
            adapters: Vec::new(),
            state: SyncState::default(),
        }
    }

    /// Register a tool adapter
    pub fn register_adapter(&mut self, adapter: Box<dyn ToolAdapter>) {
        self.adapters.push(adapter);
    }

    /// Get all registered adapters
    pub fn adapters(&self) -> &[Box<dyn ToolAdapter>] {
        &self.adapters
    }

    /// Get the local store reference
    pub fn store(&self) -> &LocalStore {
        &self.store
    }

    /// Get mutable store reference
    pub fn store_mut(&mut self) -> &mut LocalStore {
        &mut self.store
    }

    /// Detect which tools are available
    pub fn detect_tools(&self) -> Vec<ToolProfile> {
        let mut profiles = Vec::new();
        
        for adapter in &self.adapters {
            let mut profile = ToolProfile::new(adapter.tool_type());
            profile.detected = adapter.detect();
            profiles.push(profile);
        }
        
        profiles
    }

    /// Create a sync plan for a skill
    pub fn plan_sync(
        &self,
        skill_id: &str,
        tools: &[ToolType],
        strategy: SyncStrategy,
    ) -> Result<SyncPlan> {
        let mut plan = SyncPlan::new();
        
        // Check if skill exists in store
        if !self.store.is_installed(skill_id) {
            return Err(Error::SkillNotFound(skill_id.to_string()));
        }

        for tool in tools {
            let adapter = self.get_adapter(*tool)?;
            
            if !adapter.detect() {
                continue;
            }

            // Check current state
            let current = self.state.tools.get(&tool.to_string())
                .and_then(|ts| ts.skills.get(skill_id));

            let action = match current {
                None => SyncActionType::Add,
                Some(status) => {
                    if status.drift.is_some() {
                        SyncActionType::Repair
                    } else {
                        // Check if version changed
                        let record = self.store.get_record(skill_id);
                        if record.map(|r| &r.version) != Some(&status.version) {
                            SyncActionType::Update
                        } else {
                            continue; // Already in sync
                        }
                    }
                }
            };

            let sync_action = SyncAction {
                skill_id: skill_id.to_string(),
                tool: *tool,
                action,
                strategy,
            };

            match action {
                SyncActionType::Add => plan.to_add.push(sync_action),
                SyncActionType::Update => plan.to_update.push(sync_action),
                SyncActionType::Repair => plan.to_repair.push(sync_action),
                SyncActionType::Remove => plan.to_remove.push(sync_action),
            }
        }

        Ok(plan)
    }

    /// Execute a sync plan
    pub fn execute_plan(&mut self, plan: &SyncPlan) -> Result<Vec<SyncResult>> {
        let mut results = Vec::new();

        // Process additions
        for action in &plan.to_add {
            let result = self.sync_skill(&action.skill_id, action.tool, action.strategy);
            results.push(SyncResult {
                skill_id: action.skill_id.clone(),
                tool: action.tool,
                action: action.action,
                success: result.is_ok(),
                error: result.err().map(|e| e.to_string()),
            });
        }

        // Process updates
        for action in &plan.to_update {
            let result = self.sync_skill(&action.skill_id, action.tool, action.strategy);
            results.push(SyncResult {
                skill_id: action.skill_id.clone(),
                tool: action.tool,
                action: action.action,
                success: result.is_ok(),
                error: result.err().map(|e| e.to_string()),
            });
        }

        // Process repairs
        for action in &plan.to_repair {
            let result = self.repair_skill(&action.skill_id, action.tool, action.strategy);
            results.push(SyncResult {
                skill_id: action.skill_id.clone(),
                tool: action.tool,
                action: action.action,
                success: result.is_ok(),
                error: result.err().map(|e| e.to_string()),
            });
        }

        // Process removals
        for action in &plan.to_remove {
            let result = self.unsync_skill(&action.skill_id, action.tool);
            results.push(SyncResult {
                skill_id: action.skill_id.clone(),
                tool: action.tool,
                action: action.action,
                success: result.is_ok(),
                error: result.err().map(|e| e.to_string()),
            });
        }

        Ok(results)
    }

    /// Sync a skill to a specific tool
    pub fn sync_skill(
        &mut self,
        skill_id: &str,
        tool: ToolType,
        strategy: SyncStrategy,
    ) -> Result<()> {
        let adapter = self.get_adapter(tool)?;
        let source_path = self.store.skill_path(skill_id);

        if !source_path.exists() {
            return Err(Error::SkillNotFound(skill_id.to_string()));
        }

        let target_dir = adapter.skills_dir()?;
        let target_path = target_dir.join(skill_id);

        // Determine actual strategy to use
        let actual_strategy = match strategy {
            SyncStrategy::Auto => {
                // Try link first
                if self.try_link(&source_path, &target_path).is_ok() {
                    SyncStrategy::Link
                } else {
                    SyncStrategy::Copy
                }
            }
            SyncStrategy::Link => {
                self.create_link(&source_path, &target_path)?;
                SyncStrategy::Link
            }
            SyncStrategy::Copy => {
                self.copy_skill(&source_path, &target_path)?;
                SyncStrategy::Copy
            }
        };

        // Update state
        let record = self.store.get_record(skill_id)
            .ok_or_else(|| Error::SkillNotFound(skill_id.to_string()))?;

        let status = SkillSyncStatus {
            skill_id: skill_id.to_string(),
            version: record.version.clone(),
            strategy: actual_strategy,
            target_path,
            drift: None,
        };

        self.update_state(tool, skill_id, status);

        Ok(())
    }

    /// Remove a skill from a tool
    pub fn unsync_skill(&mut self, skill_id: &str, tool: ToolType) -> Result<()> {
        let adapter = self.get_adapter(tool)?;
        let target_dir = adapter.skills_dir()?;
        let target_path = target_dir.join(skill_id);

        if target_path.exists() {
            if target_path.is_symlink() {
                fs::remove_file(&target_path)?;
            } else {
                fs::remove_dir_all(&target_path)?;
            }
        }

        // Remove from state
        if let Some(tool_state) = self.state.tools.get_mut(&tool.to_string()) {
            tool_state.skills.remove(skill_id);
        }

        Ok(())
    }

    /// Check for drift in all synced skills
    pub fn check_drift(&self) -> Vec<(String, ToolType, DriftInfo)> {
        let mut drifts = Vec::new();

        for (_tool_name, tool_state) in &self.state.tools {
            for (skill_id, status) in &tool_state.skills {
                if let Some(drift) = self.detect_drift(skill_id, &status.target_path) {
                    drifts.push((
                        skill_id.clone(),
                        tool_state.tool,
                        drift,
                    ));
                }
            }
        }

        drifts
    }

    /// Repair a skill that has drifted
    fn repair_skill(
        &mut self,
        skill_id: &str,
        tool: ToolType,
        strategy: SyncStrategy,
    ) -> Result<()> {
        // Remove existing
        self.unsync_skill(skill_id, tool)?;
        // Re-sync
        self.sync_skill(skill_id, tool, strategy)
    }

    fn get_adapter(&self, tool: ToolType) -> Result<&dyn ToolAdapter> {
        self.adapters
            .iter()
            .find(|a| a.tool_type() == tool)
            .map(|a| a.as_ref())
            .ok_or_else(|| Error::ToolNotFound(tool.to_string()))
    }

    fn try_link(&self, source: &Path, target: &Path) -> Result<()> {
        if target.exists() {
            fs::remove_dir_all(target)?;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(source, target)?;
        }
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_dir(source, target)?;
        }
        
        Ok(())
    }

    fn create_link(&self, source: &Path, target: &Path) -> Result<()> {
        self.try_link(source, target)
    }

    fn copy_skill(&self, source: &Path, target: &Path) -> Result<()> {
        if target.exists() {
            fs::remove_dir_all(target)?;
        }
        copy_dir_all(source, target)
    }

    fn detect_drift(&self, skill_id: &str, target_path: &Path) -> Option<DriftInfo> {
        if !target_path.exists() {
            return Some(DriftInfo {
                drift_type: DriftType::Missing,
                description: "Skill directory not found".to_string(),
                detected_at: timestamp_now(),
            });
        }

        if target_path.is_symlink() {
            let link_target = fs::read_link(target_path).ok()?;
            let expected = self.store.skill_path(skill_id);
            
            if link_target != expected {
                return Some(DriftInfo {
                    drift_type: DriftType::WrongTarget,
                    description: format!("Link points to {:?} instead of {:?}", link_target, expected),
                    detected_at: timestamp_now(),
                });
            }

            if !link_target.exists() {
                return Some(DriftInfo {
                    drift_type: DriftType::BrokenLink,
                    description: "Symlink target does not exist".to_string(),
                    detected_at: timestamp_now(),
                });
            }
        }

        None
    }

    fn update_state(&mut self, tool: ToolType, skill_id: &str, status: SkillSyncStatus) {
        let tool_state = self.state.tools
            .entry(tool.to_string())
            .or_insert_with(|| ToolSyncState {
                tool,
                skills: std::collections::HashMap::new(),
                last_sync: None,
            });
        
        tool_state.skills.insert(skill_id.to_string(), status);
        tool_state.last_sync = Some(timestamp_now());
        self.state.last_sync = Some(timestamp_now());
    }
}

/// Result of a sync operation
#[derive(Debug, Clone)]
pub struct SyncResult {
    pub skill_id: String,
    pub tool: ToolType,
    pub action: SyncActionType,
    pub success: bool,
    pub error: Option<String>,
}

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
