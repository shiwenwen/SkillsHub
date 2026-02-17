//! Update checking module for skills
//!
//! Provides functionality to check for updates to installed skills by comparing
//! local versions with remote registry versions.

use serde::Serialize;

use crate::error::Result;
use crate::models::SkillVersion;
use crate::registry::AggregatedRegistry;
use crate::store::LocalStore;

/// Information about an available update for a skill
#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    /// Skill ID
    pub skill_id: String,
    /// Currently installed version string
    pub current_version: String,
    /// Current content hash
    pub current_hash: String,
    /// Latest available version string
    pub latest_version: String,
    /// Latest content hash
    pub latest_hash: String,
    /// Whether an update is available
    pub has_update: bool,
    /// Source registry name
    pub source_registry: Option<String>,
}

impl UpdateInfo {
    /// Create an UpdateInfo indicating no update is available
    pub fn no_update(skill_id: &str, version: &SkillVersion) -> Self {
        Self {
            skill_id: skill_id.to_string(),
            current_version: version.version.clone(),
            current_hash: version.content_hash.clone(),
            latest_version: version.version.clone(),
            latest_hash: version.content_hash.clone(),
            has_update: false,
            source_registry: None,
        }
    }

    /// Create an UpdateInfo indicating an update is available
    pub fn with_update(
        skill_id: &str,
        current: &SkillVersion,
        latest: &SkillVersion,
        registry: Option<String>,
    ) -> Self {
        Self {
            skill_id: skill_id.to_string(),
            current_version: current.version.clone(),
            current_hash: current.content_hash.clone(),
            latest_version: latest.version.clone(),
            latest_hash: latest.content_hash.clone(),
            has_update: true,
            source_registry: registry,
        }
    }
}

/// Check for updates for all installed skills
///
/// Compares installed skills against available versions in the registry.
/// Uses content_hash for reliable comparison across different source types.
pub async fn check_all_updates(
    store: &LocalStore,
    registry: &AggregatedRegistry,
) -> Result<Vec<UpdateInfo>> {
    let installed = store.list_installed();
    let mut updates = Vec::new();

    for record in installed {
        let update_info = check_skill_update(&record.skill_id, &record.version, registry).await;
        updates.push(update_info);
    }

    Ok(updates)
}

/// Check for update for a single skill
pub async fn check_skill_update(
    skill_id: &str,
    current_version: &SkillVersion,
    registry: &AggregatedRegistry,
) -> UpdateInfo {
    // Try to get versions from registry, tracking which registry it came from
    match registry.get_skill_with_source(skill_id).await {
        Ok((remote_skill, source_registry)) => {
            // Compare content hashes - this is the most reliable method
            if remote_skill.version.content_hash != current_version.content_hash {
                UpdateInfo::with_update(
                    skill_id,
                    current_version,
                    &remote_skill.version,
                    Some(source_registry),
                )
            } else {
                UpdateInfo::no_update(skill_id, current_version)
            }
        }
        Err(_) => {
            // Could not find skill in registry, no update available
            UpdateInfo::no_update(skill_id, current_version)
        }
    }
}

/// Get only skills that have updates available
pub async fn get_available_updates(
    store: &LocalStore,
    registry: &AggregatedRegistry,
) -> Result<Vec<UpdateInfo>> {
    let all_updates = check_all_updates(store, registry).await?;
    Ok(all_updates.into_iter().filter(|u| u.has_update).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_info_no_update() {
        let version = SkillVersion::new("1.0.0", "abc123");
        let info = UpdateInfo::no_update("test-skill", &version);

        assert_eq!(info.skill_id, "test-skill");
        assert!(!info.has_update);
        assert_eq!(info.current_version, "1.0.0");
        assert_eq!(info.current_hash, "abc123");
    }

    #[test]
    fn test_update_info_with_update() {
        let current = SkillVersion::new("1.0.0", "abc123");
        let latest = SkillVersion::new("1.1.0", "def456");
        let info = UpdateInfo::with_update(
            "test-skill",
            &current,
            &latest,
            Some("test-registry".to_string()),
        );

        assert!(info.has_update);
        assert_eq!(info.current_version, "1.0.0");
        assert_eq!(info.latest_version, "1.1.0");
        assert_eq!(info.source_registry, Some("test-registry".to_string()));
    }
}
