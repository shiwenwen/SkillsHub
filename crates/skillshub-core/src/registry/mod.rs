//! Registry - skill discovery and fetching

use std::fs;
use std::path::PathBuf;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::models::{Skill, SkillMetadata, SkillSource, SkillVersion};

pub mod clawhub;
pub mod git;
pub use clawhub::ClawHubRegistry;
pub use git::GitRegistry;

/// Registry configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryConfig {
    /// Name of the registry
    pub name: String,
    /// Base URL or path
    pub url: String,
    /// Branch (for git)
    pub branch: Option<String>,
    /// Description
    pub description: Option<String>,
    /// Whether this registry is enabled
    pub enabled: bool,
    /// Registry type
    pub registry_type: RegistryType,
    /// Tags/Categories
    pub tags: Vec<String>,
}

/// Type of registry
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RegistryType {
    /// Git repository
    Git,
    /// HTTP API
    Http,
    /// Local directory
    Local,
    /// Curated/official registry
    Curated,
    /// ClawHub registry
    ClawHub,
}

/// A skill listing from the registry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillListing {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: Option<String>,
    pub tags: Vec<String>,
    pub version: String,
    pub downloads: Option<u64>,
    pub rating: Option<f32>,
    pub source: SkillSource,
}

/// Query parameters for searching skills
#[derive(Debug, Clone, Default)]
pub struct SkillQuery {
    pub query: Option<String>,
    pub tags: Vec<String>,
    pub author: Option<String>,
    pub compatible_tools: Vec<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Registry provider trait
#[async_trait]
pub trait RegistryProvider: Send + Sync {
    /// Get the registry name
    fn name(&self) -> &str;

    /// Search for skills
    async fn search(&self, query: &SkillQuery) -> Result<Vec<SkillListing>>;

    /// Get skill details
    async fn get_skill(&self, skill_id: &str) -> Result<Skill>;

    /// Fetch skill to a local path
    async fn fetch(&self, skill_id: &str, dest: &std::path::Path) -> Result<PathBuf>;

    /// Get available versions
    async fn versions(&self, skill_id: &str) -> Result<Vec<SkillVersion>>;
}

/// Manager for multiple registries
pub struct RegistryManager {
    configs: Vec<RegistryConfig>,
    config_path: PathBuf,
}

impl RegistryManager {
    pub fn new() -> Result<Self> {
        let config_dir = dirs::config_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("skillshub");
        fs::create_dir_all(&config_dir)?;

        let config_path = config_dir.join("registries.json");

        let mut manager = Self {
            configs: Vec::new(),
            config_path,
        };

        if manager.config_path.exists() {
            manager.load()?;
        } else {
            manager.configs = Self::default_registries();
            manager.save()?;
        }

        Ok(manager)
    }

    pub fn list(&self) -> Vec<RegistryConfig> {
        self.configs.clone()
    }

    pub fn add(&mut self, config: RegistryConfig) -> Result<()> {
        // Remove existing if name matches
        self.configs.retain(|c| c.name != config.name);
        self.configs.push(config);
        self.save()
    }

    pub fn remove(&mut self, name: &str) -> Result<()> {
        self.configs.retain(|c| c.name != name);
        self.save()
    }

    pub fn get_provider(&self, name: &str) -> Option<Box<dyn RegistryProvider>> {
        let config = self.configs.iter().find(|c| c.name == name)?;
        match config.registry_type {
            RegistryType::Git => Some(Box::new(GitRegistry::new(
                &config.name,
                &config.url,
                config.branch.clone(),
            ))),
            RegistryType::Local => Some(Box::new(LocalRegistry::new(
                &config.name,
                PathBuf::from(&config.url),
            ))),
            RegistryType::ClawHub => Some(Box::new(ClawHubRegistry::new(&config.name))),
            RegistryType::Http | RegistryType::Curated => {
                Some(Box::new(HttpRegistry::new(&config.name, &config.url)))
            }
        }
    }

    fn load(&mut self) -> Result<()> {
        let content = fs::read_to_string(&self.config_path)?;
        self.configs =
            serde_json::from_str(&content).unwrap_or_else(|_| Self::default_registries());
        Ok(())
    }

    fn save(&self) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.configs)?;
        fs::write(&self.config_path, content)?;
        Ok(())
    }

    fn default_registries() -> Vec<RegistryConfig> {
        vec![
            RegistryConfig {
                name: "clawhub".to_string(),
                url: "https://www.clawhub.com".to_string(), // URL is for display/reference, API URL hardcoded in impl for now
                branch: None,
                description: Some("Official ClawHub Skills Registry".to_string()),
                enabled: true,
                registry_type: RegistryType::ClawHub,
                tags: vec!["official".to_string(), "clawhub".to_string()],
            },
            RegistryConfig {
                name: "anthropics".to_string(),
                url: "https://github.com/anthropics/skills".to_string(),
                branch: None,
                description: Some("Anthropic 官方 Claude Code 技能仓库".to_string()),
                enabled: true,
                registry_type: RegistryType::Git,
                tags: vec!["official".to_string(), "verified".to_string()],
            },
            RegistryConfig {
                name: "obra".to_string(),
                url: "https://github.com/obra/superpowers".to_string(),
                branch: None,
                description: Some("Superpowers - software development workflow".to_string()),
                enabled: true,
                registry_type: RegistryType::Git,
                tags: vec!["official".to_string(), "verified".to_string()],
            },
            RegistryConfig {
                name: "ComposioHQ".to_string(),
                url: "https://github.com/ComposioHQ/awesome-claude-skills".to_string(),
                branch: None,
                description: Some("Awesome list of Claude skills".to_string()),
                enabled: true,
                registry_type: RegistryType::Git,
                tags: vec!["community".to_string()],
            },
            RegistryConfig {
                name: "vercel-labs".to_string(),
                url: "https://github.com/vercel-labs/agent-skills".to_string(),
                branch: None,
                description: Some("Vercel Labs Agent Skills".to_string()),
                enabled: true,
                registry_type: RegistryType::Git,
                tags: vec!["community".to_string()],
            }, // Add more defaults if needed, but this is a good start
        ]
    }
}

/// Aggregated registry that combines multiple sources
pub struct AggregatedRegistry {
    registries: Vec<Box<dyn RegistryProvider>>,
}

impl AggregatedRegistry {
    pub fn new() -> Self {
        Self {
            registries: Vec::new(),
        }
    }

    pub fn add_registry(&mut self, registry: Box<dyn RegistryProvider>) {
        self.registries.push(registry);
    }

    pub async fn search(&self, query: &SkillQuery) -> Result<Vec<SkillListing>> {
        let mut results = Vec::new();
        for registry in &self.registries {
            if let Ok(listings) = registry.search(query).await {
                results.extend(listings);
            }
        }
        Ok(results)
    }

    pub async fn get_skill(&self, skill_id: &str) -> Result<Skill> {
        for registry in &self.registries {
            if let Ok(skill) = registry.get_skill(skill_id).await {
                return Ok(skill);
            }
        }
        Err(crate::error::Error::SkillNotFound(skill_id.to_string()))
    }
}

impl Default for AggregatedRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Local directory registry
pub struct LocalRegistry {
    name: String,
    path: PathBuf,
}

impl LocalRegistry {
    pub fn new(name: impl Into<String>, path: PathBuf) -> Self {
        Self {
            name: name.into(),
            path,
        }
    }
}

#[async_trait]
impl RegistryProvider for LocalRegistry {
    fn name(&self) -> &str {
        &self.name
    }

    async fn search(&self, query: &SkillQuery) -> Result<Vec<SkillListing>> {
        let mut results = Vec::new();

        if !self.path.exists() {
            return Ok(results);
        }

        for entry in std::fs::read_dir(&self.path)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    let id = entry.file_name().to_string_lossy().to_string();
                    let metadata = parse_skill_md(&skill_md)?;

                    // Apply query filter
                    let matches = query.query.as_ref().is_none_or(|q| {
                        id.contains(q) || metadata.name.as_ref().is_some_and(|n| n.contains(q))
                    });

                    if matches {
                        results.push(SkillListing {
                            id: id.clone(),
                            name: metadata.name.unwrap_or(id),
                            description: metadata.description.unwrap_or_default(),
                            author: metadata.author,
                            tags: metadata.tags,
                            version: metadata.version.unwrap_or_else(|| "0.0.0".to_string()),
                            downloads: None,
                            rating: None,
                            source: SkillSource::Local { path: path.clone() },
                        });
                    }
                }
            }
        }

        Ok(results)
    }

    async fn get_skill(&self, skill_id: &str) -> Result<Skill> {
        let skill_path = self.path.join(skill_id);
        let skill_md_path = skill_path.join("SKILL.md");

        if !skill_md_path.exists() {
            return Err(crate::error::Error::SkillNotFound(skill_id.to_string()));
        }

        let metadata = parse_skill_md(&skill_md_path)?;
        let content_hash = calculate_dir_hash(&skill_path)?;

        Ok(Skill {
            id: skill_id.to_string(),
            name: metadata.name.unwrap_or_else(|| skill_id.to_string()),
            description: metadata.description.unwrap_or_default(),
            author: metadata.author,
            tags: metadata.tags,
            compatible_tools: metadata.compatible_tools,
            version: SkillVersion::new(
                metadata.version.unwrap_or_else(|| "0.0.0".to_string()),
                content_hash,
            ),
            source: SkillSource::Local {
                path: skill_path.clone(),
            },
            skill_md_path,
            resources: Vec::new(),
            metadata: std::collections::HashMap::new(),
        })
    }

    async fn fetch(&self, skill_id: &str, _dest: &std::path::Path) -> Result<PathBuf> {
        let skill_path = self.path.join(skill_id);
        if !skill_path.exists() {
            return Err(crate::error::Error::SkillNotFound(skill_id.to_string()));
        }

        // For local registry, just return the path
        Ok(skill_path)
    }

    async fn versions(&self, skill_id: &str) -> Result<Vec<SkillVersion>> {
        let skill = self.get_skill(skill_id).await?;
        Ok(vec![skill.version])
    }
}

/// HTTP-backed registry (JSON endpoint)
pub struct HttpRegistry {
    name: String,
    base_url: String,
}

impl HttpRegistry {
    pub fn new(name: impl Into<String>, base_url: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            base_url: base_url.into(),
        }
    }

    fn listings_endpoint(&self) -> String {
        format!("{}/skills", self.base_url.trim_end_matches('/'))
    }
}

#[async_trait]
impl RegistryProvider for HttpRegistry {
    fn name(&self) -> &str {
        &self.name
    }

    async fn search(&self, query: &SkillQuery) -> Result<Vec<SkillListing>> {
        let mut results: Vec<SkillListing> =
            reqwest::get(self.listings_endpoint()).await?.json().await?;

        if let Some(q) = &query.query {
            results.retain(|item| item.id.contains(q) || item.name.contains(q));
        }

        if !query.tags.is_empty() {
            results.retain(|item| {
                query
                    .tags
                    .iter()
                    .all(|tag| item.tags.iter().any(|t| t == tag))
            });
        }

        if let Some(limit) = query.limit {
            results.truncate(limit);
        }

        Ok(results)
    }

    async fn get_skill(&self, skill_id: &str) -> Result<Skill> {
        let url = format!(
            "{}/skills/{}",
            self.base_url.trim_end_matches('/'),
            skill_id
        );
        Ok(reqwest::get(url).await?.json().await?)
    }

    async fn fetch(&self, _skill_id: &str, _dest: &std::path::Path) -> Result<PathBuf> {
        Err(crate::error::Error::System(
            "HTTP registry fetch is not supported yet".to_string(),
        ))
    }

    async fn versions(&self, skill_id: &str) -> Result<Vec<SkillVersion>> {
        let skill = self.get_skill(skill_id).await?;
        Ok(vec![skill.version])
    }
}

/// Parse SKILL.md frontmatter
pub fn parse_skill_md(path: &PathBuf) -> Result<SkillMetadata> {
    let content = std::fs::read_to_string(path)?;

    let mut metadata = SkillMetadata::default();

    // Parse simple frontmatter key-value pairs (without extra YAML dependency)
    if let Some(stripped) = content.strip_prefix("---") {
        if let Some(end) = stripped.find("---") {
            let yaml_str = &stripped[..end];
            for line in yaml_str.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if let Some((key, value)) = line.split_once(':') {
                    let key = key.trim();
                    let value = value.trim().trim_matches('"').trim_matches('\'');
                    match key {
                        "name" => metadata.name = Some(value.to_string()),
                        "description" => metadata.description = Some(value.to_string()),
                        "author" => metadata.author = Some(value.to_string()),
                        "version" => metadata.version = Some(value.to_string()),
                        "tags" => {
                            metadata.tags = value
                                .trim_matches('[')
                                .trim_matches(']')
                                .split(',')
                                .map(|s| s.trim().trim_matches('"').trim_matches('\''))
                                .filter(|s| !s.is_empty())
                                .map(|s| s.to_string())
                                .collect();
                        }
                        "compatible_tools" => {
                            metadata.compatible_tools = value
                                .trim_matches('[')
                                .trim_matches(']')
                                .split(',')
                                .map(|s| s.trim().trim_matches('"').trim_matches('\''))
                                .filter(|s| !s.is_empty())
                                .map(|s| s.to_string())
                                .collect();
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    for line in content.lines() {
        if let Some(stripped) = line.strip_prefix("# ") {
            metadata.name = Some(stripped.trim().to_string());
            break;
        }
    }

    // Extract description from first paragraph
    let paragraphs: Vec<&str> = content.split("\n\n").collect();
    if paragraphs.len() > 1 {
        metadata.description = Some(paragraphs[1].trim().to_string());
    }

    Ok(metadata)
}

pub fn calculate_dir_hash(path: &PathBuf) -> Result<String> {
    use sha2::{Digest, Sha256};
    use walkdir::WalkDir;

    let mut hasher = Sha256::new();

    for entry in WalkDir::new(path).sort_by_file_name() {
        let entry = entry.map_err(|e| crate::error::Error::Io(e.into()))?;
        if entry.file_type().is_file() {
            let content = std::fs::read(entry.path())?;
            hasher.update(&content);
        }
    }

    Ok(hex::encode(hasher.finalize()))
}
