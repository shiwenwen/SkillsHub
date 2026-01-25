//! Tauri commands for SkillsHub

use serde::Serialize;
use skillshub_core::adapters::create_default_adapters;
use skillshub_core::models::{SyncStrategy, ToolType};
use skillshub_core::scanner::SecurityScanner;
use skillshub_core::store::LocalStore;

use skillshub_core::sync::SyncEngine;
use skillshub_core::registry::{RegistryManager, RegistryConfig, SkillQuery, AggregatedRegistry};

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
}

#[derive(Debug, Serialize)]
pub struct ToolInfo {
    pub name: String,
    pub tool_type: String,
    pub detected: bool,
    pub skills_dir: Option<String>,
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
    })
}

#[tauri::command]
pub async fn install_skill(skill_path: String, _tools: Vec<String>) -> Result<String, String> {
    // This is a simplified version - full implementation would include
    // fetching from registry, scanning, etc.
    Ok(format!("Skill installation initiated for: {}", skill_path))
}

#[tauri::command]
pub async fn uninstall_skill(skill_id: String) -> Result<(), String> {
    let mut store = LocalStore::default_store().map_err(|e| e.to_string())?;
    store.remove_skill(&skill_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_skill(skill_id: String) -> Result<String, String> {
    // Placeholder for update logic
    Ok(format!("Update check completed for: {}", skill_id))
}

// Sync commands

#[tauri::command]
pub async fn sync_skills(skill_ids: Vec<String>, tools: Vec<String>) -> Result<Vec<SyncResult>, String> {
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
        .map(|(skill, tool, drift)| {
            (skill, tool.to_string(), drift.drift_type.to_string())
        })
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
    let report = scanner.scan(&skill_id, &skill_path).map_err(|e| e.to_string())?;

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

// Tool commands

#[tauri::command]
pub async fn list_tools() -> Result<Vec<ToolInfo>, String> {
    let adapters = create_default_adapters();

    Ok(adapters
        .iter()
        .map(|adapter| {
            let detected = adapter.detect();
            let skills_dir = adapter.skills_dir().ok();
            let skill_count = skills_dir
                .as_ref()
                .and_then(|dir| {
                    std::fs::read_dir(dir)
                        .ok()
                        .map(|entries| entries.filter_map(|e| e.ok()).filter(|e| e.path().is_dir()).count())
                })
                .unwrap_or(0);

            ToolInfo {
                name: adapter.tool_type().display_name().to_string(),
                tool_type: format!("{:?}", adapter.tool_type()).to_lowercase(),
                detected,
                skills_dir: skills_dir.map(|p| p.display().to_string()),
                skill_count,
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
    
    Ok(listings.into_iter().map(|l| SkillInfo {
        id: l.id,
        name: l.name,
        version: l.version,
        description: l.description,
        source: l.source.display(),
        installed_at: String::new(),
        scan_passed: false,
        synced_tools: Vec::new(),
    }).collect())
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
