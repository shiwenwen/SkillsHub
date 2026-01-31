//! Claude Code Plugins Scanner
//!
//! Support for scanning skills from Claude Code's plugin marketplace system.
//! Plugins are organized in `~/.claude/plugins` with the following structure:
//! - known_marketplaces.json: List of added marketplace sources
//! - installed_plugins.json: List of installed plugins
//! - marketplaces/: Cloned marketplace repositories
//! - cache/: Installed skill files

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{Error, Result};
use crate::models::{Skill, SkillSource, SkillVersion};

/// Source of a marketplace (GitHub or Git URL)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "source", rename_all = "lowercase")]
pub enum MarketplaceSource {
    /// GitHub repository
    Github { repo: String },
    /// Generic Git URL
    Git { url: String },
}

/// Known marketplace configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownMarketplace {
    /// Source type and details
    pub source: MarketplaceSource,
    /// Local installation path
    pub install_location: PathBuf,
    /// Last update timestamp
    pub last_updated: String,
}

/// Known marketplaces configuration file
pub type KnownMarketplacesConfig = HashMap<String, KnownMarketplace>;

/// Installed plugin entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPlugin {
    /// Installation scope (user or project)
    pub scope: String,
    /// Path to installed plugin files
    pub install_path: PathBuf,
    /// Version string (usually short git sha)
    pub version: String,
    /// Installation timestamp
    pub installed_at: String,
    /// Last update timestamp
    #[serde(default)]
    pub last_updated: Option<String>,
    /// Full git commit SHA
    #[serde(default)]
    pub git_commit_sha: Option<String>,
}

/// Installed plugins configuration file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledPluginsConfig {
    /// Config version
    pub version: u32,
    /// Map of plugin name@marketplace to installations
    pub plugins: HashMap<String, Vec<InstalledPlugin>>,
}

/// Owner information in marketplace.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceOwner {
    pub name: String,
    pub email: Option<String>,
}

/// Metadata in marketplace.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceMetadata {
    pub description: Option<String>,
    pub version: Option<String>,
}

/// Plugin definition in marketplace.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplacePlugin {
    /// Plugin name
    pub name: String,
    /// Description
    pub description: Option<String>,
    /// Source path (relative)
    pub source: String,
    /// Whether strict mode is enabled
    #[serde(default)]
    pub strict: bool,
    /// List of skill paths
    pub skills: Vec<String>,
}

/// Marketplace configuration file (.claude-plugin/marketplace.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceConfig {
    /// Marketplace name
    pub name: String,
    /// Owner information
    pub owner: Option<MarketplaceOwner>,
    /// Metadata
    pub metadata: Option<MarketplaceMetadata>,
    /// Available plugins
    pub plugins: Vec<MarketplacePlugin>,
}

/// A scanned plugin skill ready for sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSkill {
    /// Plugin name (e.g., "document-skills")
    pub plugin_name: String,
    /// Marketplace name (e.g., "anthropic-agent-skills")
    pub marketplace: String,
    /// Skill name (e.g., "pdf")
    pub skill_name: String,
    /// Path to the skill directory
    pub skill_path: PathBuf,
    /// Version string
    pub version: String,
    /// Git commit SHA if available
    pub commit_sha: Option<String>,
    /// Installation timestamp
    pub installed_at: String,
}

impl PluginSkill {
    /// Get a unique identifier for this plugin skill
    pub fn id(&self) -> String {
        format!(
            "{}@{}:{}",
            self.plugin_name, self.marketplace, self.skill_name
        )
    }

    /// Convert to a Skill model
    pub fn to_skill(&self) -> Result<Skill> {
        let skill_md_path = self.skill_path.join("SKILL.md");
        if !skill_md_path.exists() {
            return Err(Error::SkillNotFound(format!(
                "SKILL.md not found in {}",
                self.skill_path.display()
            )));
        }

        // Parse SKILL.md frontmatter for metadata
        let content = fs::read_to_string(&skill_md_path)?;
        let (name, description) = parse_skill_md_header(&content);

        Ok(Skill {
            id: self.id(),
            name: name.unwrap_or_else(|| self.skill_name.clone()),
            description: description.unwrap_or_default(),
            author: None,
            tags: vec!["plugin".to_string(), self.marketplace.clone()],
            compatible_tools: vec!["claude".to_string()],
            version: SkillVersion {
                version: self.version.clone(),
                commit: self.commit_sha.clone(),
                content_hash: String::new(), // TODO: calculate hash
                timestamp: Some(self.installed_at.clone()),
            },
            source: SkillSource::Local {
                path: self.skill_path.clone(),
            },
            skill_md_path: skill_md_path.clone(),
            resources: collect_resources(&self.skill_path),
            metadata: Default::default(),
        })
    }
}

/// Scanner for Claude Code plugins
pub struct PluginScanner {
    plugins_dir: PathBuf,
}

impl PluginScanner {
    /// Create a new plugin scanner
    pub fn new(plugins_dir: PathBuf) -> Self {
        Self { plugins_dir }
    }

    /// Create a scanner for the default Claude plugins directory
    pub fn new_default() -> Option<Self> {
        dirs::home_dir().map(|h| Self::new(h.join(".claude").join("plugins")))
    }

    /// Check if the plugins directory exists
    pub fn exists(&self) -> bool {
        self.plugins_dir.exists()
    }

    /// Get the plugins directory path
    pub fn plugins_dir(&self) -> &Path {
        &self.plugins_dir
    }

    /// Load known marketplaces configuration
    pub fn load_known_marketplaces(&self) -> Result<KnownMarketplacesConfig> {
        let config_path = self.plugins_dir.join("known_marketplaces.json");
        if !config_path.exists() {
            return Ok(HashMap::new());
        }
        let content = fs::read_to_string(&config_path)?;
        let config: KnownMarketplacesConfig = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// Load installed plugins configuration
    pub fn load_installed_plugins(&self) -> Result<InstalledPluginsConfig> {
        let config_path = self.plugins_dir.join("installed_plugins.json");
        if !config_path.exists() {
            return Ok(InstalledPluginsConfig {
                version: 2,
                plugins: HashMap::new(),
            });
        }
        let content = fs::read_to_string(&config_path)?;
        let config: InstalledPluginsConfig = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// Load marketplace configuration from a marketplace directory
    pub fn load_marketplace_config(&self, marketplace_name: &str) -> Result<MarketplaceConfig> {
        let config_path = self
            .plugins_dir
            .join("marketplaces")
            .join(marketplace_name)
            .join(".claude-plugin")
            .join("marketplace.json");

        if !config_path.exists() {
            return Err(Error::ConfigNotFound(format!(
                "Marketplace config not found: {}",
                config_path.display()
            )));
        }

        let content = fs::read_to_string(&config_path)?;
        let config: MarketplaceConfig = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// Scan all installed plugin skills
    pub fn scan_installed_skills(&self) -> Result<Vec<PluginSkill>> {
        let installed = self.load_installed_plugins()?;
        let mut skills = Vec::new();

        for (plugin_key, installations) in installed.plugins {
            // Parse plugin_key: "plugin-name@marketplace-name"
            let parts: Vec<&str> = plugin_key.split('@').collect();
            if parts.len() != 2 {
                continue;
            }
            let plugin_name = parts[0];
            let marketplace = parts[1];

            for install in installations {
                // Scan skills in the installed plugin directory
                let plugin_skills = self.scan_plugin_directory(
                    &install.install_path,
                    plugin_name,
                    marketplace,
                    &install,
                )?;
                skills.extend(plugin_skills);
            }
        }

        Ok(skills)
    }

    /// Scan a plugin directory for skills
    fn scan_plugin_directory(
        &self,
        install_path: &Path,
        plugin_name: &str,
        marketplace: &str,
        install: &InstalledPlugin,
    ) -> Result<Vec<PluginSkill>> {
        let mut skills = Vec::new();

        // Check if this is a single skill or a collection
        let skill_md = install_path.join("SKILL.md");
        if skill_md.exists() {
            // Single skill at root level
            skills.push(PluginSkill {
                plugin_name: plugin_name.to_string(),
                marketplace: marketplace.to_string(),
                skill_name: plugin_name.to_string(),
                skill_path: install_path.to_path_buf(),
                version: install.version.clone(),
                commit_sha: install.git_commit_sha.clone(),
                installed_at: install.installed_at.clone(),
            });
        }

        // Check for skills subdirectory (collection of skills)
        let skills_dir = install_path.join("skills");
        if skills_dir.exists() && skills_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(&skills_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let skill_md = path.join("SKILL.md");
                        if skill_md.exists() {
                            let skill_name = path
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown")
                                .to_string();

                            skills.push(PluginSkill {
                                plugin_name: plugin_name.to_string(),
                                marketplace: marketplace.to_string(),
                                skill_name,
                                skill_path: path,
                                version: install.version.clone(),
                                commit_sha: install.git_commit_sha.clone(),
                                installed_at: install.installed_at.clone(),
                            });
                        }
                    }
                }
            }
        }

        Ok(skills)
    }

    /// Get all available marketplaces
    pub fn list_marketplaces(&self) -> Result<Vec<(String, KnownMarketplace)>> {
        let config = self.load_known_marketplaces()?;
        Ok(config.into_iter().collect())
    }

    /// Get all plugins in a marketplace
    pub fn list_marketplace_plugins(
        &self,
        marketplace_name: &str,
    ) -> Result<Vec<MarketplacePlugin>> {
        let config = self.load_marketplace_config(marketplace_name)?;
        Ok(config.plugins)
    }
}

/// Parse SKILL.md header for name and description
fn parse_skill_md_header(content: &str) -> (Option<String>, Option<String>) {
    let mut name = None;
    let mut description = None;

    // Try to parse YAML frontmatter
    if let Some(stripped) = content.strip_prefix("---") {
        if let Some(end) = stripped.find("---") {
            let frontmatter = &stripped[..end];
            for line in frontmatter.lines() {
                let line = line.trim();
                if let Some(value) = line.strip_prefix("name:") {
                    name = Some(value.trim().trim_matches('"').to_string());
                } else if let Some(value) = line.strip_prefix("description:") {
                    description = Some(value.trim().trim_matches('"').to_string());
                }
            }
        }
    }

    // Fall back to first heading
    if name.is_none() {
        for line in content.lines() {
            let line = line.trim();
            if let Some(heading) = line.strip_prefix("# ") {
                name = Some(heading.to_string());
                break;
            }
        }
    }

    (name, description)
}

/// Collect resource files from a skill directory
fn collect_resources(skill_path: &Path) -> Vec<PathBuf> {
    let mut resources = Vec::new();

    if let Ok(entries) = fs::read_dir(skill_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Skip SKILL.md itself
            if name == "SKILL.md" {
                continue;
            }

            // Include markdown files and common resource directories
            if path.is_file() {
                if name.ends_with(".md") || name.ends_with(".txt") || name.ends_with(".json") {
                    resources.push(path);
                }
            } else if path.is_dir() {
                // Include scripts, examples, resources directories
                if name == "scripts" || name == "examples" || name == "resources" {
                    resources.push(path);
                }
            }
        }
    }

    resources
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_skill_md_header_with_frontmatter() {
        let content = r#"---
name: "Test Skill"
description: "A test skill"
---
# Test Skill

Content here.
"#;
        let (name, desc) = parse_skill_md_header(content);
        assert_eq!(name, Some("Test Skill".to_string()));
        assert_eq!(desc, Some("A test skill".to_string()));
    }

    #[test]
    fn test_parse_skill_md_header_without_frontmatter() {
        let content = r#"# My Awesome Skill

This is a skill.
"#;
        let (name, desc) = parse_skill_md_header(content);
        assert_eq!(name, Some("My Awesome Skill".to_string()));
        assert_eq!(desc, None);
    }

    #[test]
    fn test_plugin_skill_id() {
        let skill = PluginSkill {
            plugin_name: "document-skills".to_string(),
            marketplace: "anthropic-agent-skills".to_string(),
            skill_name: "pdf".to_string(),
            skill_path: PathBuf::from("/tmp/test"),
            version: "abc123".to_string(),
            commit_sha: None,
            installed_at: "2026-01-01T00:00:00Z".to_string(),
        };
        assert_eq!(skill.id(), "document-skills@anthropic-agent-skills:pdf");
    }
}
