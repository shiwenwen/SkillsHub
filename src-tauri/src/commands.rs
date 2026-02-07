//! Tauri commands for SkillsHub

use serde::Serialize;
use skillshub_core::adapters::create_default_adapters;
use skillshub_core::config::AppConfig;
use skillshub_core::models::{SyncStrategy, ToolType};
use skillshub_core::plugins::{PluginScanner, PluginSkill};
use skillshub_core::scanner::SecurityScanner;
use skillshub_core::store::LocalStore;

use skillshub_core::registry::{AggregatedRegistry, RegistryConfig, RegistryManager, SkillQuery};
use skillshub_core::sync::SyncEngine;
use std::path::PathBuf;

// Response types

#[derive(Debug, Serialize)]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub source: String,
    pub installed_at: String,
    pub scan_passed: bool,
    pub synced_tools: Vec<String>,
    pub author: Option<String>,
    pub tags: Vec<String>,
    pub downloads: Option<u64>,
    pub rating: Option<f32>,
}

#[derive(Debug, Serialize)]
pub struct ToolInfo {
    pub name: String,
    pub tool_type: String,
    pub detected: bool,
    pub skills_dir: Option<String>,
    pub skills_dirs: Vec<String>, // All skills directories (for tools with multiple paths)
    pub skill_count: usize,
}

#[derive(Debug, Serialize)]
pub struct ScanResult {
    pub skill_id: String,
    pub passed: bool,
    pub overall_risk: String,
    pub findings: Vec<Finding>,
}

#[derive(Debug, Serialize)]
pub struct SecurityRuleInfo {
    pub id: String,
    pub name: String,
    pub risk_level: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct Finding {
    pub rule_name: String,
    pub risk_level: String,
    pub description: String,
    pub file: String,
    pub line: Option<usize>,
    pub recommendation: String,
}

#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub skill_id: String,
    pub tool: String,
    pub success: bool,
    pub error: Option<String>,
}

// Skill commands

#[tauri::command]
pub async fn list_installed_skills() -> Result<Vec<SkillInfo>, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let installed = store.list_installed();

    Ok(installed
        .into_iter()
        .map(|r| SkillInfo {
            id: r.skill_id.clone(),
            name: r.skill_id.clone(),
            version: r.version.version.clone(),
            description: String::new(),
            source: r.source.display(),
            installed_at: r.installed_at.clone(),
            scan_passed: r.scan_passed,
            synced_tools: r.projected_tools.clone(),
            author: None, // Installed record currently lacks author metadata storage in simple list, would need to load full skill
            tags: Vec::new(),
            downloads: None,
            rating: None,
        })
        .collect())
}

#[tauri::command]
pub async fn get_skill_info(skill_id: String) -> Result<SkillInfo, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let record = store
        .get_record(&skill_id)
        .ok_or_else(|| format!("Skill '{}' not found", skill_id))?;

    Ok(SkillInfo {
        id: record.skill_id.clone(),
        name: record.skill_id.clone(),
        version: record.version.version.clone(),
        description: String::new(),
        source: record.source.display(),
        installed_at: record.installed_at.clone(),
        scan_passed: record.scan_passed,
        synced_tools: record.projected_tools.clone(),
        author: None, // TODO: Load from SKILL.md if possible
        tags: Vec::new(),
        downloads: None,
        rating: None,
    })
}

#[tauri::command]
pub async fn install_skill(skill_id: String, _tools: Vec<String>) -> Result<String, String> {
    // Get the skill from registry and install it
    let manager = RegistryManager::new().map_err(|e| e.to_string())?;
    let mut aggregated = AggregatedRegistry::new();

    for config in manager.list() {
        if config.enabled {
            if let Some(provider) = manager.get_provider(&config.name) {
                aggregated.add_registry(provider);
            }
        }
    }

    // Try to get the skill from registry
    match aggregated.get_skill(&skill_id).await {
        Ok(remote_skill) => {
            let mut store = LocalStore::default_store().map_err(|e| e.to_string())?;

            // Check if already installed
            let skill_path = store.skill_path(&skill_id);
            if skill_path.exists() {
                return Err(format!("Skill '{}' is already installed", skill_id));
            }

            // Import the skill
            store
                .import_skill(&remote_skill, &remote_skill.skill_md_path)
                .await
                .map_err(|e| e.to_string())?;

            Ok(format!(
                "Skill '{}' v{} installed successfully",
                skill_id, remote_skill.version.version
            ))
        }
        Err(e) => Err(format!("Failed to fetch skill '{}': {}", skill_id, e)),
    }
}

#[tauri::command]
pub async fn uninstall_skill(skill_id: String) -> Result<(), String> {
    let mut store = LocalStore::default_store().map_err(|e| e.to_string())?;
    store.remove_skill(&skill_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_skill(skill_id: String) -> Result<String, String> {
    // Get the skill from registry and update it
    let manager = RegistryManager::new().map_err(|e| e.to_string())?;
    let mut aggregated = AggregatedRegistry::new();

    for config in manager.list() {
        if config.enabled {
            if let Some(provider) = manager.get_provider(&config.name) {
                aggregated.add_registry(provider);
            }
        }
    }

    // Try to get the latest version from registry
    match aggregated.get_skill(&skill_id).await {
        Ok(remote_skill) => {
            let mut store = LocalStore::default_store().map_err(|e| e.to_string())?;

            // Import the updated skill
            let skill_path = store.skill_path(&skill_id);
            if skill_path.exists() {
                // Remove old version first
                store.remove_skill(&skill_id).map_err(|e| e.to_string())?;
            }

            // Import new version
            store
                .import_skill(&remote_skill, &remote_skill.skill_md_path)
                .await
                .map_err(|e| e.to_string())?;

            Ok(format!(
                "Skill '{}' updated to version {}",
                skill_id, remote_skill.version.version
            ))
        }
        Err(e) => Err(format!("Failed to fetch update for '{}': {}", skill_id, e)),
    }
}

// Update check commands

#[derive(Debug, Serialize)]
pub struct UpdateCheckInfo {
    pub skill_id: String,
    pub current_version: String,
    pub current_hash: String,
    pub latest_version: String,
    pub latest_hash: String,
    pub has_update: bool,
    pub source_registry: Option<String>,
}

/// Check for updates for all installed skills
#[tauri::command]
pub async fn check_skill_updates() -> Result<Vec<UpdateCheckInfo>, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let manager = RegistryManager::new().map_err(|e| e.to_string())?;
    let mut aggregated = AggregatedRegistry::new();

    for config in manager.list() {
        if config.enabled {
            if let Some(provider) = manager.get_provider(&config.name) {
                aggregated.add_registry(provider);
            }
        }
    }

    let installed = store.list_installed();
    let mut updates = Vec::new();

    for record in installed {
        let update_info = match aggregated.get_skill(&record.skill_id).await {
            Ok(remote_skill) => {
                let has_update = remote_skill.version.content_hash != record.version.content_hash;
                UpdateCheckInfo {
                    skill_id: record.skill_id.clone(),
                    current_version: record.version.version.clone(),
                    current_hash: record.version.content_hash.clone(),
                    latest_version: remote_skill.version.version.clone(),
                    latest_hash: remote_skill.version.content_hash.clone(),
                    has_update,
                    source_registry: None,
                }
            }
            Err(_) => {
                // Skill not found in registry, no update available
                UpdateCheckInfo {
                    skill_id: record.skill_id.clone(),
                    current_version: record.version.version.clone(),
                    current_hash: record.version.content_hash.clone(),
                    latest_version: record.version.version.clone(),
                    latest_hash: record.version.content_hash.clone(),
                    has_update: false,
                    source_registry: None,
                }
            }
        };
        updates.push(update_info);
    }

    Ok(updates)
}

// Sync commands

#[tauri::command]
pub async fn sync_skills(
    skill_ids: Vec<String>,
    tools: Vec<String>,
) -> Result<Vec<SyncResult>, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let mut engine = SyncEngine::new(store);

    for adapter in create_default_adapters() {
        engine.register_adapter(adapter);
    }

    let mut results = Vec::new();

    for skill_id in skill_ids {
        for tool_str in &tools {
            let tool = match tool_str.to_lowercase().as_str() {
                "claude" => ToolType::Claude,
                "cursor" => ToolType::Cursor,
                "gemini" => ToolType::Gemini,
                "opencode" => ToolType::OpenCode,
                _ => continue,
            };

            let result = engine.sync_skill(&skill_id, tool, SyncStrategy::Auto);
            results.push(SyncResult {
                skill_id: skill_id.clone(),
                tool: tool_str.clone(),
                success: result.is_ok(),
                error: result.err().map(|e| e.to_string()),
            });
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn check_drift() -> Result<Vec<(String, String, String)>, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let engine = SyncEngine::new(store);

    let drifts = engine.check_drift();
    Ok(drifts
        .into_iter()
        .map(|(skill, tool, drift)| (skill, tool.to_string(), drift.drift_type.to_string()))
        .collect())
}

// Scan commands

#[tauri::command]
pub async fn scan_skill(skill_id: String) -> Result<ScanResult, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let skill_path = store.skill_path(&skill_id);

    if !skill_path.exists() {
        return Err(format!("Skill '{}' not found in store", skill_id));
    }

    let scanner = SecurityScanner::new();
    let report = scanner
        .scan(&skill_id, &skill_path)
        .map_err(|e| e.to_string())?;

    Ok(ScanResult {
        skill_id,
        passed: report.passed,
        overall_risk: report.overall_risk.to_string(),
        findings: report
            .findings
            .into_iter()
            .map(|f| Finding {
                rule_name: f.rule_name,
                risk_level: f.risk_level.to_string(),
                description: f.description,
                file: f.file.display().to_string(),
                line: f.line,
                recommendation: f.recommendation,
            })
            .collect(),
    })
}

#[tauri::command]
pub async fn list_security_rules() -> Result<Vec<SecurityRuleInfo>, String> {
    let scanner = SecurityScanner::new();
    Ok(scanner
        .list_rules()
        .into_iter()
        .map(|rule| SecurityRuleInfo {
            id: rule.id,
            name: rule.name,
            risk_level: rule.risk_level.to_string(),
            enabled: true,
        })
        .collect())
}

// Tool commands

#[tauri::command]
pub async fn list_tools() -> Result<Vec<ToolInfo>, String> {
    let adapters = create_default_adapters();

    Ok(adapters
        .iter()
        .map(|adapter| {
            let detected = adapter.detect();
            let skills_dir = adapter.skills_dir().ok();

            // Get all skills directories (for tools with multiple paths like OpenClaw)
            let all_dirs = adapter.skills_dirs();
            let skills_dirs: Vec<String> =
                all_dirs.iter().map(|p| p.display().to_string()).collect();

            // Count skills across all directories (avoiding duplicates by skill name)
            let mut skill_names = std::collections::HashSet::new();
            for dir in &all_dirs {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        if entry.path().is_dir() {
                            if let Some(name) = entry.path().file_name() {
                                skill_names.insert(name.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }

            ToolInfo {
                name: adapter.tool_type().display_name().to_string(),
                tool_type: format!("{:?}", adapter.tool_type()).to_lowercase(),
                detected,
                skills_dir: skills_dir.map(|p| p.display().to_string()),
                skills_dirs,
                skill_count: skill_names.len(),
            }
        })
        .collect())
}

#[tauri::command]
pub async fn detect_tools() -> Result<Vec<ToolInfo>, String> {
    list_tools().await
}

// Registry commands

#[tauri::command]
pub async fn search_skills(query: String) -> Result<Vec<SkillInfo>, String> {
    let manager = RegistryManager::new().map_err(|e| e.to_string())?;
    let mut aggregated = AggregatedRegistry::new();

    for config in manager.list() {
        if config.enabled {
            if let Some(provider) = manager.get_provider(&config.name) {
                aggregated.add_registry(provider);
            }
        }
    }

    let q = SkillQuery {
        query: Some(query),
        ..Default::default()
    };

    let listings = aggregated.search(&q).await.map_err(|e| e.to_string())?;

    Ok(listings
        .into_iter()
        .map(|l| SkillInfo {
            id: l.id,
            name: l.name,
            version: l.version,
            description: l.description,
            source: l.source.display(),
            installed_at: String::new(),
            scan_passed: false,
            synced_tools: Vec::new(),
            author: l.author,
            tags: l.tags,
            downloads: l.downloads,
            rating: l.rating,
        })
        .collect())
}

#[tauri::command]
pub async fn list_registries() -> Result<Vec<RegistryConfig>, String> {
    let manager = RegistryManager::new().map_err(|e| e.to_string())?;
    Ok(manager.list())
}

#[tauri::command]
pub async fn add_registry(config: RegistryConfig) -> Result<(), String> {
    let mut manager = RegistryManager::new().map_err(|e| e.to_string())?;
    manager.add(config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_registry(name: String) -> Result<(), String> {
    let mut manager = RegistryManager::new().map_err(|e| e.to_string())?;
    manager.remove(&name).map_err(|e| e.to_string())
}

// Plugin commands

#[derive(Debug, Serialize)]
pub struct PluginSkillInfo {
    pub id: String,
    pub plugin_name: String,
    pub marketplace: String,
    pub skill_name: String,
    pub skill_path: String,
    pub version: String,
    pub commit_sha: Option<String>,
    pub installed_at: String,
}

impl From<PluginSkill> for PluginSkillInfo {
    fn from(skill: PluginSkill) -> Self {
        Self {
            id: skill.id(),
            plugin_name: skill.plugin_name,
            marketplace: skill.marketplace,
            skill_name: skill.skill_name,
            skill_path: skill.skill_path.display().to_string(),
            version: skill.version,
            commit_sha: skill.commit_sha,
            installed_at: skill.installed_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct MarketplaceInfo {
    pub name: String,
    pub source_type: String,
    pub source_repo: String,
    pub install_location: String,
    pub last_updated: String,
}

/// Scan Claude plugins directory for installed skills
#[tauri::command]
pub async fn scan_claude_plugins() -> Result<Vec<PluginSkillInfo>, String> {
    let scanner = PluginScanner::new_default()
        .ok_or_else(|| "Cannot determine home directory".to_string())?;

    if !scanner.exists() {
        return Ok(Vec::new());
    }

    let skills = scanner.scan_installed_skills().map_err(|e| e.to_string())?;

    Ok(skills.into_iter().map(PluginSkillInfo::from).collect())
}

/// List known marketplaces
#[tauri::command]
pub async fn list_claude_marketplaces() -> Result<Vec<MarketplaceInfo>, String> {
    let scanner = PluginScanner::new_default()
        .ok_or_else(|| "Cannot determine home directory".to_string())?;

    if !scanner.exists() {
        return Ok(Vec::new());
    }

    let marketplaces = scanner.list_marketplaces().map_err(|e| e.to_string())?;

    Ok(marketplaces
        .into_iter()
        .map(|(name, config)| {
            let (source_type, source_repo) = match config.source {
                skillshub_core::plugins::MarketplaceSource::Github { repo } => {
                    ("github".to_string(), repo)
                }
                skillshub_core::plugins::MarketplaceSource::Git { url } => ("git".to_string(), url),
            };
            MarketplaceInfo {
                name,
                source_type,
                source_repo,
                install_location: config.install_location.display().to_string(),
                last_updated: config.last_updated,
            }
        })
        .collect())
}

/// Sync a plugin skill to other tools
#[tauri::command]
#[allow(non_snake_case)]
pub async fn sync_plugin_skill(
    skillPath: String,
    skillId: String,
    tools: Vec<String>,
) -> Result<Vec<SyncResult>, String> {
    let engine_store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let mut engine = SyncEngine::new(engine_store);

    for adapter in create_default_adapters() {
        engine.register_adapter(adapter);
    }

    let source = PathBuf::from(&skillPath);
    let mut results = Vec::new();
    let mut synced_tools = Vec::new();

    for tool_str in &tools {
        let tool = match tool_str.to_lowercase().as_str() {
            "amp" => ToolType::Amp,
            "antigravity" => ToolType::Antigravity,
            "claude" => ToolType::Claude,
            "codebuddy" => ToolType::CodeBuddy,
            "codex" => ToolType::Codex,
            "copilot" => ToolType::Copilot,
            "cursor" => ToolType::Cursor,
            "factory" => ToolType::Factory,
            "gemini" => ToolType::Gemini,
            "goose" => ToolType::Goose,
            "kilocode" => ToolType::KiloCode,
            "kimi" => ToolType::Kimi,
            "opencode" => ToolType::OpenCode,
            "qwen" => ToolType::Qwen,
            "roocode" => ToolType::RooCode,
            "trae" => ToolType::Trae,
            "windsurf" => ToolType::Windsurf,
            _ => continue,
        };

        // Skip syncing to Claude itself (source tool)
        if tool == ToolType::Claude {
            continue;
        }

        let result = engine.sync_plugin_skill(&source, &skillId, tool, SyncStrategy::Auto);
        let success = result.is_ok();
        if success {
            synced_tools.push(tool_str.clone());
        }
        results.push(SyncResult {
            skill_id: skillId.clone(),
            tool: tool_str.clone(),
            success,
            error: result.err().map(|e| e.to_string()),
        });
    }

    // Register the skill in LocalStore so it appears in the "Local Skills" list
    if !synced_tools.is_empty() {
        if let Ok(mut register_store) = LocalStore::default_store() {
            let _ = register_store.register_plugin_skill(&skillId, &source, synced_tools);
        }
    }

    Ok(results)
}

/// Scan all tool directories for skills
#[tauri::command]
pub async fn scan_all_skills() -> Result<Vec<ScannedSkillInfo>, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let mut engine = SyncEngine::new(store);

    for adapter in create_default_adapters() {
        engine.register_adapter(adapter);
    }

    let scanned = engine.scan_all_tools();

    Ok(scanned
        .into_iter()
        .map(|s| ScannedSkillInfo {
            id: s.id,
            path: s.path.to_string_lossy().to_string(),
            tool: format!("{:?}", s.tool),
            in_hub: s.in_hub,
            is_link: s.is_link,
        })
        .collect())
}

/// Full sync: collect from tools to hub, then distribute to all tools
#[tauri::command]
pub async fn full_sync_skills() -> Result<FullSyncResponse, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let mut engine = SyncEngine::new(store);

    for adapter in create_default_adapters() {
        engine.register_adapter(adapter);
    }

    // Load configuration to get default sync strategy
    let config = AppConfig::load_or_default();
    let strategy = config.default_sync_strategy;

    let result = engine.full_sync(strategy).map_err(|e| e.to_string())?;

    Ok(FullSyncResponse {
        collected_count: result.collected_count,
        collected_skills: result.collected_skills,
        distributed_count: result.distributed.len(),
        distributed: result
            .distributed
            .into_iter()
            .map(|(skill, tool, success)| DistributedSkill {
                skill_id: skill,
                tool: format!("{:?}", tool),
                success,
            })
            .collect(),
    })
}

/// Get hub status - skills in hub and their sync status
#[tauri::command]
pub async fn get_hub_status() -> Result<Vec<HubStatusInfo>, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let mut engine = SyncEngine::new(store);

    for adapter in create_default_adapters() {
        engine.register_adapter(adapter);
    }

    let status = engine.get_hub_status();

    Ok(status
        .into_iter()
        .map(|s| HubStatusInfo {
            skill_id: s.skill_id,
            hub_path: s.hub_path.to_string_lossy().to_string(),
            synced_to: s
                .synced_to
                .into_iter()
                .map(|t| format!("{:?}", t))
                .collect(),
            missing_in: s
                .missing_in
                .into_iter()
                .map(|t| format!("{:?}", t))
                .collect(),
        })
        .collect())
}

// New response types for scan/sync

#[derive(Debug, Serialize)]
pub struct ScannedSkillInfo {
    pub id: String,
    pub path: String,
    pub tool: String,
    pub in_hub: bool,
    pub is_link: bool,
}

#[derive(Debug, Serialize)]
pub struct FullSyncResponse {
    pub collected_count: usize,
    pub collected_skills: Vec<String>,
    pub distributed_count: usize,
    pub distributed: Vec<DistributedSkill>,
}

#[derive(Debug, Serialize)]
pub struct DistributedSkill {
    pub skill_id: String,
    pub tool: String,
    pub success: bool,
}

#[derive(Debug, Serialize)]
pub struct HubStatusInfo {
    pub skill_id: String,
    pub hub_path: String,
    pub synced_to: Vec<String>,
    pub missing_in: Vec<String>,
}

// Custom tool management

use serde::Deserialize;

/// Custom tool configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomToolConfig {
    pub id: String,
    pub name: String,
    pub global_path: Option<String>,
    pub project_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityScanRecord {
    pub skill: String,
    pub scanned_at: u64,
    pub risk: String,
    pub findings: usize,
    pub source: String,
}

/// Get the path to custom tools config file
fn custom_tools_config_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_local_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
        .ok_or("Cannot determine data directory")?;
    Ok(data_dir.join("skillshub").join("custom_tools.json"))
}

/// Get the path to security scan records file
fn security_scan_records_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_local_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
        .ok_or("Cannot determine data directory")?;
    Ok(data_dir
        .join("skillshub")
        .join("security_scan_records.json"))
}

/// Load security scan records from file
fn load_security_scan_records_from_file() -> Result<Vec<SecurityScanRecord>, String> {
    let path = security_scan_records_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read security scan records: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse security scan records: {}", e))
}

/// Save security scan records to file
fn save_security_scan_records_to_file(records: &[SecurityScanRecord]) -> Result<(), String> {
    let path = security_scan_records_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(records)
        .map_err(|e| format!("Failed to serialize security scan records: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write security scan records: {}", e))
}

/// Load custom tools from config file
fn load_custom_tools_from_file() -> Result<Vec<CustomToolConfig>, String> {
    let path = custom_tools_config_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read custom tools config: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse custom tools config: {}", e))
}

/// Save custom tools to config file
fn save_custom_tools_to_file(tools: &[CustomToolConfig]) -> Result<(), String> {
    let path = custom_tools_config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(tools)
        .map_err(|e| format!("Failed to serialize custom tools: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write custom tools config: {}", e))
}

/// List all custom tools
#[tauri::command]
pub async fn list_custom_tools() -> Result<Vec<CustomToolConfig>, String> {
    load_custom_tools_from_file()
}

/// Add a new custom tool
#[tauri::command]
pub async fn add_custom_tool(
    name: String,
    global_path: Option<String>,
    project_path: Option<String>,
) -> Result<CustomToolConfig, String> {
    let mut tools = load_custom_tools_from_file()?;

    let new_tool = CustomToolConfig {
        id: format!(
            "custom-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        ),
        name,
        global_path,
        project_path,
    };

    tools.push(new_tool.clone());
    save_custom_tools_to_file(&tools)?;

    Ok(new_tool)
}

/// Update a custom tool by ID
#[tauri::command]
pub async fn update_custom_tool(
    id: String,
    name: String,
    global_path: Option<String>,
    project_path: Option<String>,
) -> Result<CustomToolConfig, String> {
    let mut tools = load_custom_tools_from_file()?;

    let tool = tools
        .iter_mut()
        .find(|t| t.id == id)
        .ok_or_else(|| format!("Custom tool with id '{}' not found", id))?;

    tool.name = name;
    tool.global_path = global_path;
    tool.project_path = project_path;

    let updated_tool = tool.clone();
    save_custom_tools_to_file(&tools)?;

    Ok(updated_tool)
}

/// Remove a custom tool by ID
#[tauri::command]
pub async fn remove_custom_tool(id: String) -> Result<(), String> {
    let mut tools = load_custom_tools_from_file()?;
    let original_len = tools.len();
    tools.retain(|t| t.id != id);

    if tools.len() == original_len {
        return Err(format!("Custom tool with id '{}' not found", id));
    }

    save_custom_tools_to_file(&tools)
}

/// Get recent security scan records
#[tauri::command]
pub async fn get_security_scan_records() -> Result<Vec<SecurityScanRecord>, String> {
    load_security_scan_records_from_file()
}

/// Save recent security scan records
#[tauri::command]
pub async fn save_security_scan_records(records: Vec<SecurityScanRecord>) -> Result<(), String> {
    // Keep at most 100 entries to avoid unbounded growth
    let limited: Vec<SecurityScanRecord> = records.into_iter().take(100).collect();
    save_security_scan_records_to_file(&limited)
}

// ============================================================================
// Store Info Commands
// ============================================================================

#[derive(Debug, Serialize)]
pub struct StoreInfo {
    pub path: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub skill_count: usize,
}

/// Calculate directory size recursively
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

/// Format bytes to human-readable string
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

/// Get store path and stats
#[tauri::command]
pub async fn get_store_info() -> Result<StoreInfo, String> {
    let store_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("skillshub")
        .join("store");

    let path = store_dir.display().to_string();

    // Calculate size
    let size_bytes = if store_dir.exists() {
        calc_dir_size(&store_dir)
    } else {
        0
    };
    let size_display = format_size(size_bytes);

    // Count skills
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

// ============================================================================
// Configuration Management Commands
// ============================================================================

/// Get application configuration
#[tauri::command]
pub async fn get_app_config() -> Result<AppConfig, String> {
    AppConfig::load().map_err(|e| e.to_string())
}

/// Save application configuration
#[tauri::command]
pub async fn save_app_config(config: AppConfig) -> Result<(), String> {
    config.save().map_err(|e| e.to_string())
}

// ============================================================================
// Cloud Sync Commands
// ============================================================================

use skillshub_core::cloud_sync::{
    CloudSyncEngine, CloudSyncResult as CoreCloudSyncResult, DetectedCloudDrive,
};

/// Detect available cloud drives on the system
#[tauri::command]
pub async fn detect_cloud_drives() -> Result<Vec<DetectedCloudDrive>, String> {
    Ok(skillshub_core::cloud_sync::detect_cloud_drives())
}

#[derive(Debug, Serialize)]
pub struct CloudSyncResponse {
    pub pushed: Vec<String>,
    pub pulled: Vec<String>,
}

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

/// Push local skills to cloud
#[tauri::command]
pub async fn cloud_sync_push() -> Result<CloudSyncResponse, String> {
    let engine = create_cloud_engine()?;
    let pushed = engine.push_to_cloud().map_err(|e| e.to_string())?;
    Ok(CloudSyncResponse {
        pushed,
        pulled: vec![],
    })
}

/// Pull skills from cloud
#[tauri::command]
pub async fn cloud_sync_pull() -> Result<CloudSyncResponse, String> {
    let engine = create_cloud_engine()?;
    let pulled = engine.pull_from_cloud().map_err(|e| e.to_string())?;
    Ok(CloudSyncResponse {
        pushed: vec![],
        pulled,
    })
}

/// Full bidirectional cloud sync
#[tauri::command]
pub async fn cloud_sync_full() -> Result<CloudSyncResponse, String> {
    let engine = create_cloud_engine()?;
    let result = engine.sync().map_err(|e| e.to_string())?;

    // Update last_sync timestamp in config
    let mut config = AppConfig::load_or_default();
    config.cloud_sync.last_sync = Some(CloudSyncEngine::now_timestamp());
    config.save().map_err(|e| e.to_string())?;

    Ok(result.into())
}

/// Open a directory in the system file manager
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
