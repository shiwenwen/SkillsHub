//! Plugin commands - Claude plugin scanning and syncing

use serde::Serialize;
use std::path::PathBuf;

use skillshub_core::adapters::create_default_adapters;
use skillshub_core::config::AppConfig;
use skillshub_core::models::ToolType;
use skillshub_core::plugins::{PluginScanner, PluginSkill};
use skillshub_core::store::LocalStore;
use skillshub_core::sync::SyncEngine;

use super::types::{parse_tool_type, SyncResult};

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
        let tool = match parse_tool_type(tool_str) {
            Some(t) => t,
            None => continue,
        };

        // Skip syncing to Claude itself (source tool)
        if tool == ToolType::Claude {
            continue;
        }

        let config = AppConfig::load_or_default();
        let tool_key = format!("{:?}", tool).to_lowercase();
        let strategy = config.strategy_for_tool(&tool_key);

        let result = engine.sync_plugin_skill(&source, &skillId, tool, strategy);
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

    if !synced_tools.is_empty() {
        if let Ok(mut register_store) = LocalStore::default_store() {
            let _ = register_store.register_plugin_skill(&skillId, &source, synced_tools);
        }
    }

    Ok(results)
}
