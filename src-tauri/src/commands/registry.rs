//! Registry commands - search, list, add, remove registries

use skillshub_core::registry::{AggregatedRegistry, RegistryConfig, RegistryManager, SkillQuery};

use super::types::SkillInfo;

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
