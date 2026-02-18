//! Sync commands - skill synchronization across tools

use skillshub_core::adapters::create_default_adapters;
use skillshub_core::config::AppConfig;
use skillshub_core::store::LocalStore;
use skillshub_core::sync::SyncEngine;

use super::types::{
    parse_tool_type, DistributedSkill, FullSyncResponse, HubStatusInfo, ScannedSkillInfo,
    SyncResult,
};

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
    let mut successful_tools_by_skill: std::collections::HashMap<
        String,
        std::collections::HashSet<String>,
    > = std::collections::HashMap::new();

    for skill_id in skill_ids {
        for tool_str in &tools {
            let tool = match parse_tool_type(tool_str) {
                Some(t) => t,
                None => continue,
            };

            let config = AppConfig::load_or_default();
            let tool_key = format!("{:?}", tool).to_lowercase();
            let strategy = config.strategy_for_tool(&tool_key);

            let result = engine.sync_skill(&skill_id, tool, strategy);
            if result.is_ok() {
                successful_tools_by_skill
                    .entry(skill_id.clone())
                    .or_default()
                    .insert(tool_str.to_lowercase());
            }
            results.push(SyncResult {
                skill_id: skill_id.clone(),
                tool: tool_str.clone(),
                success: result.is_ok(),
                error: result.err().map(|e| e.to_string()),
            });
        }
    }

    if !successful_tools_by_skill.is_empty() {
        let mut record_store = LocalStore::default_store().map_err(|e| e.to_string())?;
        for (skill_id, synced_tools) in successful_tools_by_skill {
            if let Some(record) = record_store.get_record(&skill_id) {
                let mut merged_tools: std::collections::HashSet<String> = record
                    .projected_tools
                    .iter()
                    .map(|tool| tool.to_lowercase())
                    .collect();
                merged_tools.extend(synced_tools.into_iter());

                let mut projected_tools: Vec<String> = merged_tools.into_iter().collect();
                projected_tools.sort();
                record_store
                    .update_projected_tools(&skill_id, projected_tools)
                    .map_err(|e| e.to_string())?;
            }
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

#[tauri::command]
pub async fn sync_single_skill(skill_id: String) -> Result<Vec<SyncResult>, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let mut engine = SyncEngine::new(store);

    let adapters = create_default_adapters();

    let config = AppConfig::load_or_default();

    let mut results = Vec::new();
    let mut synced_tools = Vec::new();

    for adapter in &adapters {
        if adapter.detect() {
            let tool = adapter.tool_type();
            let tool_name = format!("{:?}", tool).to_lowercase();

            let strategy = config.strategy_for_tool(&tool_name);
            let result = engine.sync_skill(&skill_id, tool, strategy);
            let success = result.is_ok();
            if success {
                synced_tools.push(tool_name.clone());
            }
            results.push(SyncResult {
                skill_id: skill_id.clone(),
                tool: tool_name,
                success,
                error: result.err().map(|e| e.to_string()),
            });
        }
    }

    if !synced_tools.is_empty() {
        let mut record_store = LocalStore::default_store().map_err(|e| e.to_string())?;
        if let Some(record) = record_store.get_record(&skill_id) {
            let mut all_tools: std::collections::HashSet<String> = record
                .projected_tools
                .iter()
                .map(|t| t.to_lowercase())
                .collect();
            all_tools.extend(synced_tools.into_iter());
            let mut projected_tools: Vec<String> = all_tools.into_iter().collect();
            projected_tools.sort();
            record_store
                .update_projected_tools(&skill_id, projected_tools)
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn toggle_skill_tool_sync(
    skill_id: String,
    tool_type: String,
    enable: bool,
) -> Result<SyncResult, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let skill_path = store.skill_path(&skill_id);

    if !skill_path.exists() {
        return Err(format!("Skill '{}' not found in store", skill_id));
    }

    let tool = parse_tool_type(&tool_type)
        .ok_or_else(|| format!("Unknown tool type: {}", tool_type))?;

    if enable {
        let mut engine = SyncEngine::new(store);
        for adapter in create_default_adapters() {
            engine.register_adapter(adapter);
        }

        let config = AppConfig::load_or_default();
        let tool_key = tool_type.to_lowercase();
        let strategy = config.strategy_for_tool(&tool_key);

        let result = engine.sync_skill(&skill_id, tool, strategy);

        if result.is_ok() {
            let mut record_store = LocalStore::default_store().map_err(|e| e.to_string())?;
            if let Some(record) = record_store.get_record(&skill_id) {
                let mut all_tools: std::collections::HashSet<String> = record
                    .projected_tools
                    .iter()
                    .map(|t| t.to_lowercase())
                    .collect();
                all_tools.insert(tool_type.to_lowercase());
                let mut projected_tools: Vec<String> = all_tools.into_iter().collect();
                projected_tools.sort();
                record_store
                    .update_projected_tools(&skill_id, projected_tools)
                    .map_err(|e| e.to_string())?;
            }
        }

        Ok(SyncResult {
            skill_id,
            tool: tool_type,
            success: result.is_ok(),
            error: result.err().map(|e| e.to_string()),
        })
    } else {
        let adapters = create_default_adapters();
        let adapter = adapters
            .iter()
            .find(|a| a.tool_type() == tool)
            .ok_or_else(|| format!("Adapter for tool '{}' not found", tool_type))?;

        let tool_dirs = adapter.skills_dirs();
        let mut removed = false;

        for dir in tool_dirs {
            let skill_in_tool = dir.join(&skill_id);
            if skill_in_tool.exists() {
                if skill_in_tool.is_symlink() {
                    std::fs::remove_file(&skill_in_tool)
                        .map_err(|e| format!("Failed to remove symlink: {}", e))?;
                } else {
                    std::fs::remove_dir_all(&skill_in_tool)
                        .map_err(|e| format!("Failed to remove directory: {}", e))?;
                }
                removed = true;
                break;
            }
        }

        if removed {
            let mut record_store = LocalStore::default_store().map_err(|e| e.to_string())?;
            if let Some(record) = record_store.get_record(&skill_id) {
                let projected_tools: Vec<String> = record
                    .projected_tools
                    .iter()
                    .filter(|t| t.to_lowercase() != tool_type.to_lowercase())
                    .cloned()
                    .collect();
                record_store
                    .update_projected_tools(&skill_id, projected_tools)
                    .map_err(|e| e.to_string())?;
            }
        }

        Ok(SyncResult {
            skill_id,
            tool: tool_type,
            success: removed,
            error: if removed {
                None
            } else {
                Some("Skill not found in tool directory".to_string())
            },
        })
    }
}

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

#[tauri::command]
pub async fn full_sync_skills() -> Result<FullSyncResponse, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let mut engine = SyncEngine::new(store);

    for adapter in create_default_adapters() {
        engine.register_adapter(adapter);
    }

    let config = AppConfig::load_or_default();

    let result = engine
        .full_sync(|tool| {
            let tool_key = format!("{:?}", tool).to_lowercase();
            config.strategy_for_tool(&tool_key)
        })
        .map_err(|e| e.to_string())?;

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
