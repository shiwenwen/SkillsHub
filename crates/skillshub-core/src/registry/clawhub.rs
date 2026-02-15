use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;
use std::path::PathBuf;
use tokio::fs;

use crate::error::{Error, Result};
use crate::models::{Skill, SkillSource, SkillVersion};
use crate::registry::{calculate_dir_hash, RegistryProvider, SkillListing, SkillQuery};

/// ClawHub registry (API-based)
pub struct ClawHubRegistry {
    name: String,
    api_url: String,
    client: Client,
}

#[derive(Debug, Deserialize)]
struct ClawHubSearchResponse {
    items: Vec<ClawHubSkill>,
    // nextCursor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClawHubSkill {
    slug: String,
    #[serde(rename = "displayName")]
    display_name: String,
    summary: String,
    #[serde(rename = "latestVersion")]
    latest_version: ClawHubVersion,
    stats: Option<ClawHubStats>,
}

#[derive(Debug, Deserialize)]
struct ClawHubVersion {
    version: String,
}

#[derive(Debug, Deserialize)]
struct ClawHubStats {
    downloads: Option<u64>,
    // stars: Option<u64>,
}

impl ClawHubRegistry {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            api_url: "https://auth.clawdhub.com/api/v1".to_string(),
            client: Client::new(),
        }
    }

    async fn download_file(&self, url: &str, dest: &PathBuf) -> Result<()> {
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| Error::System(format!("Failed to download file: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::System(format!(
                "Failed to download file: status {}",
                response.status()
            )));
        }

        let content = response
            .bytes()
            .await
            .map_err(|e| Error::System(format!("Failed to read content: {}", e)))?;
        fs::write(dest, content).await.map_err(Error::Io)?;

        Ok(())
    }
}

#[async_trait]
impl RegistryProvider for ClawHubRegistry {
    fn name(&self) -> &str {
        &self.name
    }

    async fn search(&self, query: &SkillQuery) -> Result<Vec<SkillListing>> {
        let url = format!("{}/skills", self.api_url);
        let mut request = self.client.get(&url);

        if let Some(q) = &query.query {
            request = request.query(&[("q", q)]);
        }

        let response = request
            .send()
            .await
            .map_err(|e| Error::System(format!("Failed to connect to ClawHub: {}", e)))?;

        if !response.status().is_success() {
            return Err(Error::System(format!(
                "ClawHub API error: {}",
                response.status()
            )));
        }

        let data: ClawHubSearchResponse = response
            .json()
            .await
            .map_err(|e| Error::System(format!("Failed to parse ClawHub response: {}", e)))?;

        let listings = data
            .items
            .into_iter()
            .map(|item| {
                SkillListing {
                    id: item.slug.clone(),
                    name: item.display_name,
                    description: item.summary,
                    author: None, // ClawHub API doesn't seem to expose author directly in the list view easily, or it's part of slug
                    tags: Vec::new(), // Not in the list response
                    version: item.latest_version.version,
                    downloads: item.stats.and_then(|s| s.downloads),
                    rating: None,
                    source: SkillSource::Registry {
                        registry_url: self.api_url.clone(),
                        skill_id: item.slug,
                    },
                }
            })
            .collect();

        Ok(listings)
    }

    async fn get_skill(&self, skill_id: &str) -> Result<Skill> {
        let cache_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("skillshub")
            .join("cache")
            .join("clawhub")
            .join(skill_id);

        let skill_md_path = cache_dir.join("SKILL.md");

        if !skill_md_path.exists() {
            self.fetch(skill_id, &cache_dir).await?;
        }

        if !skill_md_path.exists() {
            return Err(Error::SkillNotFound(skill_id.to_string()));
        }

        let metadata = crate::registry::parse_skill_md(&skill_md_path)?;
        let content_hash = calculate_dir_hash(&cache_dir)?;

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
            source: SkillSource::Registry {
                registry_url: self.api_url.clone(),
                skill_id: skill_id.to_string(),
            },
            skill_md_path,
            resources: Vec::new(),
            metadata: std::collections::HashMap::new(),
        })
    }

    async fn fetch(&self, skill_id: &str, dest: &std::path::Path) -> Result<PathBuf> {
        if dest.exists() {
            fs::remove_dir_all(dest).await.map_err(Error::Io)?;
        }
        fs::create_dir_all(dest).await.map_err(Error::Io)?;

        let download_url = format!("{}/download?slug={}", self.api_url, skill_id);
        let zip_path = dest.join(format!("{}.zip", skill_id));

        self.download_file(&download_url, &zip_path).await?;

        let output = std::process::Command::new("unzip")
            .arg("-o")
            .arg(&zip_path)
            .arg("-d")
            .arg(dest)
            .output()
            .map_err(|e| Error::System(format!("Failed to execute unzip: {}", e)))?;

        if !output.status.success() {
            return Err(Error::System(format!(
                "Unzip failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        fs::remove_file(zip_path).await.map_err(Error::Io)?;

        Ok(dest.to_path_buf())
    }

    async fn versions(&self, skill_id: &str) -> Result<Vec<SkillVersion>> {
        let skill = self.get_skill(skill_id).await?;
        Ok(vec![skill.version])
    }
}
