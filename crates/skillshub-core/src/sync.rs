//! Sync Engine - multi-tool synchronization

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::adapters::ToolAdapter;
use crate::error::{Error, Result};
use crate::models::{
    DriftInfo, DriftType, HubSyncStatus, ScannedSkill, SkillSyncStatus, SyncAction, SyncActionType,
    SyncPlan, SyncState, SyncStrategy, ToolProfile, ToolSyncState, ToolType,
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
            let current = self
                .state
                .tools
                .get(&tool.to_string())
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
        let record = self
            .store
            .get_record(skill_id)
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

        for tool_state in self.state.tools.values() {
            for (skill_id, status) in &tool_state.skills {
                if let Some(drift) = self.detect_drift(skill_id, &status.target_path) {
                    drifts.push((skill_id.clone(), tool_state.tool, drift));
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
                    description: format!(
                        "Link points to {:?} instead of {:?}",
                        link_target, expected
                    ),
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
        let tool_state =
            self.state
                .tools
                .entry(tool.to_string())
                .or_insert_with(|| ToolSyncState {
                    tool,
                    skills: HashMap::new(),
                    last_sync: None,
                });

        tool_state.skills.insert(skill_id.to_string(), status);
        tool_state.last_sync = Some(timestamp_now());
        self.state.last_sync = Some(timestamp_now());
    }

    /// Sync a plugin skill from Claude plugins to another tool
    ///
    /// This allows syncing skills installed via Claude's plugin marketplace
    /// to other tools that support skills.
    pub fn sync_plugin_skill(
        &mut self,
        source_path: &Path,
        skill_id: &str,
        tool: ToolType,
        strategy: SyncStrategy,
    ) -> Result<()> {
        if !source_path.exists() {
            return Err(Error::SkillNotFound(format!(
                "Plugin skill not found: {}",
                source_path.display()
            )));
        }

        let adapter = self.get_adapter(tool)?;
        let target_dir = adapter.skills_dir()?;
        let target_path = target_dir.join(skill_id);

        // Determine actual strategy to use
        let actual_strategy = match strategy {
            SyncStrategy::Auto => {
                // Try link first
                if self.try_link(source_path, &target_path).is_ok() {
                    SyncStrategy::Link
                } else {
                    SyncStrategy::Copy
                }
            }
            SyncStrategy::Link => {
                self.create_link(source_path, &target_path)?;
                SyncStrategy::Link
            }
            SyncStrategy::Copy => {
                self.copy_skill(source_path, &target_path)?;
                SyncStrategy::Copy
            }
        };

        // Create a minimal version for plugin skills
        let version = crate::models::SkillVersion::new("plugin", "from-claude-plugins");

        let status = SkillSyncStatus {
            skill_id: skill_id.to_string(),
            version,
            strategy: actual_strategy,
            target_path,
            drift: None,
        };

        self.update_state(tool, skill_id, status);

        Ok(())
    }

    /// Scan all tool directories for skills
    /// Returns a list of all skills found across all tools
    pub fn scan_all_tools(&self) -> Vec<ScannedSkill> {
        let mut all_skills = Vec::new();
        let hub_skills = self.get_hub_skill_ids();
        // O(1) dedup: (skill_id, tool_type) set
        let mut seen: HashSet<(String, ToolType)> = HashSet::new();

        for adapter in &self.adapters {
            // Use skills_dirs() to scan multiple directories per tool
            for skills_dir in adapter.skills_dirs() {
                if skills_dir.exists() {
                    if let Ok(entries) = fs::read_dir(&skills_dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if path.is_dir() || path.is_symlink() {
                                if let Some(name) = path.file_name() {
                                    let skill_id = name.to_string_lossy().to_string();
                                    // Skip hidden directories
                                    if skill_id.starts_with('.') {
                                        continue;
                                    }
                                    // O(1) dedup check
                                    let key = (skill_id.clone(), adapter.tool_type());
                                    if !seen.insert(key) {
                                        continue;
                                    }
                                    all_skills.push(ScannedSkill {
                                        id: skill_id.clone(),
                                        path: path.clone(),
                                        tool: adapter.tool_type(),
                                        in_hub: hub_skills.contains(&skill_id),
                                        is_link: path.is_symlink(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        all_skills
    }

    /// Get set of skill IDs in the hub (O(1) lookup)
    fn get_hub_skill_ids(&self) -> HashSet<String> {
        let skills_dir = self.store.skills_dir();
        let mut ids = HashSet::new();
        if skills_dir.exists() {
            if let Ok(entries) = fs::read_dir(&skills_dir) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Some(name) = entry.path().file_name() {
                            let id = name.to_string_lossy().to_string();
                            if !id.starts_with('.') {
                                ids.insert(id);
                            }
                        }
                    }
                }
            }
        }
        ids
    }

    /// Collect skills from tools into the hub
    /// Copies skills that exist in tools but not in the hub
    pub fn collect_to_hub(&mut self) -> Result<Vec<String>> {
        let scanned = self.scan_all_tools();
        let mut collected = Vec::new();

        for skill in scanned {
            if !skill.in_hub {
                // Check if we already collected this skill
                let hub_path = self.store.skills_dir().join(&skill.id);
                if hub_path.exists() {
                    continue;
                }

                // Copy skill to hub
                if skill.is_link {
                    // Resolve the symlink and copy the actual content
                    if let Ok(resolved) = fs::read_link(&skill.path) {
                        let real_path = if resolved.is_absolute() {
                            resolved
                        } else {
                            skill
                                .path
                                .parent()
                                .unwrap_or(Path::new("/"))
                                .join(&resolved)
                        };
                        if real_path.exists() {
                            copy_dir_all(&real_path, &hub_path)?;
                            collected.push(skill.id.clone());
                        }
                    }
                } else if skill.path.is_dir() {
                    copy_dir_all(&skill.path, &hub_path)?;
                    collected.push(skill.id.clone());
                }
            }
        }

        Ok(collected)
    }

    /// Distribute skills from hub to all tools
    /// Creates symlinks (or copies if symlinks fail) in each tool's skills directory
    /// `strategy_resolver` returns the effective strategy for a given tool type
    pub fn distribute_from_hub<F>(
        &mut self,
        strategy_resolver: F,
    ) -> Result<Vec<(String, ToolType, bool)>>
    where
        F: Fn(ToolType) -> SyncStrategy,
    {
        let hub_skill_ids = self.get_hub_skill_ids();
        let mut results = Vec::new();

        for skill_id in hub_skill_ids {
            let source = self.store.skills_dir().join(&skill_id);
            if !source.exists() {
                continue;
            }

            for adapter in &self.adapters {
                if let Ok(target_dir) = adapter.skills_dir() {
                    let target = target_dir.join(&skill_id);

                    // Skip if already exists
                    if target.exists() || target.is_symlink() {
                        continue;
                    }

                    // Create target directory's parent if needed
                    if let Some(parent) = target.parent() {
                        let _ = fs::create_dir_all(parent);
                    }

                    // Apply per-tool sync strategy
                    let strategy = strategy_resolver(adapter.tool_type());
                    let success = match strategy {
                        SyncStrategy::Auto => {
                            // Try symlink first, fall back to copy
                            self.try_link(&source, &target).is_ok()
                                || copy_dir_all(&source, &target).is_ok()
                        }
                        SyncStrategy::Link => {
                            // Always use symlink
                            self.try_link(&source, &target).is_ok()
                        }
                        SyncStrategy::Copy => {
                            // Always copy
                            copy_dir_all(&source, &target).is_ok()
                        }
                    };

                    results.push((skill_id.clone(), adapter.tool_type(), success));
                }
            }
        }

        Ok(results)
    }

    /// Full sync: collect from tools, then distribute to all tools
    /// `strategy_resolver` returns the effective strategy for a given tool type
    pub fn full_sync<F>(&mut self, strategy_resolver: F) -> Result<FullSyncResult>
    where
        F: Fn(ToolType) -> SyncStrategy,
    {
        let collected = self.collect_to_hub()?;
        let distributed = self.distribute_from_hub(strategy_resolver)?;

        Ok(FullSyncResult {
            collected_count: collected.len(),
            collected_skills: collected,
            distributed,
        })
    }

    /// Get hub sync status - which skills are in hub and where they're synced
    pub fn get_hub_status(&self) -> Vec<HubSyncStatus> {
        let hub_skill_ids = self.get_hub_skill_ids();
        let scanned = self.scan_all_tools();
        let all_tools: Vec<ToolType> = self.adapters.iter().map(|a| a.tool_type()).collect();

        // Build O(1) lookup: skill_id -> [tools where it exists]
        let mut skill_tools: HashMap<String, Vec<ToolType>> = HashMap::new();
        for s in &scanned {
            skill_tools
                .entry(s.id.clone())
                .or_default()
                .push(s.tool);
        }

        hub_skill_ids
            .iter()
            .map(|skill_id| {
                let synced_to = skill_tools
                    .get(skill_id)
                    .cloned()
                    .unwrap_or_default();

                let missing_in: Vec<ToolType> = all_tools
                    .iter()
                    .filter(|t| !synced_to.contains(t))
                    .cloned()
                    .collect();

                HubSyncStatus {
                    skill_id: skill_id.clone(),
                    hub_path: self.store.skills_dir().join(skill_id),
                    synced_to,
                    missing_in,
                }
            })
            .collect()
    }
}

/// Result of a full sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullSyncResult {
    pub collected_count: usize,
    pub collected_skills: Vec<String>,
    pub distributed: Vec<(String, ToolType, bool)>,
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
