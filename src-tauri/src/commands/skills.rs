//! Skill CRUD and detail commands

use skillshub_core::adapters::create_default_adapters;
use skillshub_core::registry::{AggregatedRegistry, RegistryManager};
use skillshub_core::store::LocalStore;

use super::types::{SkillDetailInfo, SkillFileInfo, SkillInfo, SyncedToolInfo, UpdateCheckInfo};

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
            author: None,
            tags: Vec::new(),
            downloads: None,
            rating: None,
        })
        .collect())
}

#[tauri::command]
pub async fn get_skill_info(skill_id: String) -> Result<SkillInfo, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;

    if let Some(record) = store.get_record(&skill_id) {
        return Ok(SkillInfo {
            id: record.skill_id.clone(),
            name: record.skill_id.clone(),
            version: record.version.version.clone(),
            description: String::new(),
            source: record.source.display(),
            installed_at: record.installed_at.clone(),
            scan_passed: record.scan_passed,
            synced_tools: record.projected_tools.clone(),
            author: None,
            tags: Vec::new(),
            downloads: None,
            rating: None,
        });
    }

    let skill_path = store.skill_path(&skill_id);
    if skill_path.exists() {
        let installed_at = skill_path
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs().to_string())
                    .unwrap_or_default()
            })
            .unwrap_or_default();

        return Ok(SkillInfo {
            id: skill_id.clone(),
            name: skill_id.clone(),
            version: "unknown".to_string(),
            description: String::new(),
            source: "scanned".to_string(),
            installed_at,
            scan_passed: true,
            synced_tools: Vec::new(),
            author: None,
            tags: Vec::new(),
            downloads: None,
            rating: None,
        });
    }

    Err(format!("Skill '{}' not found", skill_id))
}

#[tauri::command]
pub async fn get_skill_detail(skill_id: String) -> Result<SkillDetailInfo, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let skill_path = store.skill_path(&skill_id);

    if !skill_path.exists() {
        return Err(format!("Skill '{}' not found in store", skill_id));
    }

    let skill_md_path = skill_path.join("SKILL.md");
    let skill_md_content = if skill_md_path.exists() {
        std::fs::read_to_string(&skill_md_path).ok()
    } else {
        None
    };

    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&skill_path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            let metadata = entry.metadata().ok();
            files.push(SkillFileInfo {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry_path.display().to_string(),
                is_dir: entry_path.is_dir(),
                size: metadata.map(|m| m.len()).unwrap_or(0),
            });
        }
    }
    files.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    let adapters = create_default_adapters();
    let mut synced_tools = Vec::new();

    for adapter in adapters {
        if adapter.detect() {
            let tool_name = adapter.tool_type().display_name().to_string();
            let tool_type = format!("{:?}", adapter.tool_type()).to_lowercase();

            let tool_dirs = adapter.skills_dirs();
            let mut is_synced = false;
            let mut is_link = false;
            let mut synced_path: Option<String> = None;

            for dir in tool_dirs {
                let potential_path = dir.join(&skill_id);
                if potential_path.exists() {
                    is_synced = true;
                    is_link = potential_path.is_symlink();
                    synced_path = Some(potential_path.display().to_string());
                    break;
                }
            }

            synced_tools.push(SyncedToolInfo {
                tool_name,
                tool_type,
                is_synced,
                is_link,
                path: synced_path,
            });
        }
    }

    Ok(SkillDetailInfo {
        id: skill_id.clone(),
        name: skill_id,
        skill_path: skill_path.display().to_string(),
        skill_md_content,
        files,
        synced_tools,
    })
}

#[tauri::command]
pub async fn install_skill(skill_id: String, _tools: Vec<String>) -> Result<String, String> {
    let manager = RegistryManager::new().map_err(|e| e.to_string())?;
    let mut aggregated = AggregatedRegistry::new();

    for config in manager.list() {
        if config.enabled {
            if let Some(provider) = manager.get_provider(&config.name) {
                aggregated.add_registry(provider);
            }
        }
    }

    match aggregated.get_skill(&skill_id).await {
        Ok(remote_skill) => {
            let mut store = LocalStore::default_store().map_err(|e| e.to_string())?;

            let skill_path = store.skill_path(&skill_id);
            if skill_path.exists() {
                return Err(format!("Skill '{}' is already installed", skill_id));
            }

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
    let manager = RegistryManager::new().map_err(|e| e.to_string())?;
    let mut aggregated = AggregatedRegistry::new();

    for config in manager.list() {
        if config.enabled {
            if let Some(provider) = manager.get_provider(&config.name) {
                aggregated.add_registry(provider);
            }
        }
    }

    match aggregated.get_skill(&skill_id).await {
        Ok(remote_skill) => {
            let mut store = LocalStore::default_store().map_err(|e| e.to_string())?;

            let skill_path = store.skill_path(&skill_id);
            if skill_path.exists() {
                store.remove_skill(&skill_id).map_err(|e| e.to_string())?;
            }

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
            Err(_) => UpdateCheckInfo {
                skill_id: record.skill_id.clone(),
                current_version: record.version.version.clone(),
                current_hash: record.version.content_hash.clone(),
                latest_version: record.version.version.clone(),
                latest_hash: record.version.content_hash.clone(),
                has_update: false,
                source_registry: None,
            },
        };
        updates.push(update_info);
    }

    Ok(updates)
}
