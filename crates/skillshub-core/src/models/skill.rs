//! Skill data models

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Represents a skill package (SKILL.md + resources)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    /// Unique identifier for the skill
    pub id: String,
    /// Display name
    pub name: String,
    /// Description of the skill
    pub description: String,
    /// Author or maintainer
    pub author: Option<String>,
    /// Tags for categorization
    pub tags: Vec<String>,
    /// Compatible tools
    pub compatible_tools: Vec<String>,
    /// Current version
    pub version: SkillVersion,
    /// Source information
    pub source: SkillSource,
    /// Path to SKILL.md content
    pub skill_md_path: PathBuf,
    /// Additional resource files
    pub resources: Vec<PathBuf>,
    /// Metadata from SKILL.md frontmatter
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Version information for a skill
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SkillVersion {
    /// Version string (semver, tag, or commit)
    pub version: String,
    /// Git commit hash if applicable
    pub commit: Option<String>,
    /// Content hash for integrity verification
    pub content_hash: String,
    /// Timestamp of this version
    pub timestamp: Option<String>,
}

impl SkillVersion {
    pub fn new(version: impl Into<String>, content_hash: impl Into<String>) -> Self {
        Self {
            version: version.into(),
            commit: None,
            content_hash: content_hash.into(),
            timestamp: None,
        }
    }
}

/// Source of a skill
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SkillSource {
    /// From a Git repository
    Git {
        url: String,
        branch: Option<String>,
        path: Option<String>,
    },
    /// From a registry
    Registry {
        registry_url: String,
        skill_id: String,
    },
    /// From an HTTP URL
    Http { url: String },
    /// Local file path
    Local { path: PathBuf },
}

impl SkillSource {
    /// Get a display string for the source
    pub fn display(&self) -> String {
        match self {
            SkillSource::Git { url, .. } => format!("git:{}", url),
            SkillSource::Registry {
                registry_url,
                skill_id,
            } => {
                format!("registry:{}:{}", registry_url, skill_id)
            }
            SkillSource::Http { url } => format!("http:{}", url),
            SkillSource::Local { path } => format!("local:{}", path.display()),
        }
    }
}

/// Skill metadata parsed from SKILL.md frontmatter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub tags: Vec<String>,
    pub compatible_tools: Vec<String>,
    /// Required permissions/capabilities
    pub permissions: Vec<String>,
    /// Dependencies on other skills
    pub dependencies: Vec<String>,
}

/// Installation record for a skill
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallRecord {
    /// Skill ID
    pub skill_id: String,
    /// Installed version
    pub version: SkillVersion,
    /// Installation timestamp
    pub installed_at: String,
    /// Source it was installed from
    pub source: SkillSource,
    /// Tools it's been projected to
    pub projected_tools: Vec<String>,
    /// Security scan result at install time
    pub scan_passed: bool,
}
