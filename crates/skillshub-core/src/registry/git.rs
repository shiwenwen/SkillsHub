use std::path::PathBuf;
use std::process::Command;
use async_trait::async_trait;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;
use tokio::fs;

use crate::error::{Error, Result};
use crate::models::{Skill, SkillSource, SkillVersion};
use crate::registry::{parse_skill_md, RegistryProvider, SkillListing, SkillQuery, calculate_dir_hash};

/// Git-based registry (scans a remote repository)
pub struct GitRegistry {
    name: String,
    url: String,
    branch: Option<String>,
    cache_dir: PathBuf,
}

impl GitRegistry {
    pub fn new(name: impl Into<String>, url: impl Into<String>, branch: Option<String>) -> Self {
        // Calculate a stable cache path for this repo
        let url_str = url.into();
        let mut hasher = Sha256::new();
        hasher.update(url_str.as_bytes());
        let hash = hex::encode(hasher.finalize());
        
        let cache_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("skillshub")
            .join("cache")
            .join("git")
            .join(&hash[0..12]);

        Self {
            name: name.into(),
            url: url_str,
            branch,
            cache_dir,
        }
    }

    /// Ensure the repository is cloned and up to date
    async fn sync_repo(&self) -> Result<()> {
        if !self.cache_dir.exists() {
            fs::create_dir_all(&self.cache_dir).await.map_err(|e| Error::Io(e))?;
            
            // Clone
            let mut cmd = Command::new("git");
            cmd.arg("clone").arg("--depth").arg("1");
            if let Some(branch) = &self.branch {
                cmd.arg("-b").arg(branch);
            }
            cmd.arg(&self.url).arg(&self.cache_dir);
            
            let output = tokio::task::spawn_blocking(move || cmd.output())
                .await
                .map_err(|e| Error::System(format!("Failed to join clone task: {}", e)))?
                .map_err(|e| Error::System(format!("Failed to execute git clone: {}", e)))?;
                
            if !output.status.success() {
                return Err(Error::System(format!(
                    "Git clone failed: {}", 
                    String::from_utf8_lossy(&output.stderr)
                )));
            }
        } else {
            // Pull
            let dir = self.cache_dir.clone();
            let output = tokio::task::spawn_blocking(move || {
                Command::new("git")
                    .current_dir(dir)
                    .arg("pull")
                    .output()
            })
            .await
            .map_err(|e| Error::System(format!("Failed to join pull task: {}", e)))?
            .map_err(|e| Error::System(format!("Failed to execute git pull: {}", e)))?;

            // We don't fail hard on pull failure (might be offline), just log warn ideally
            if !output.status.success() {
                // For now, simple println since we don't have tracing setup in this snippet context fully visible
                // but in real code: tracing::warn!("Git pull failed");
            }
        }
        Ok(())
    }
}

#[async_trait]
impl RegistryProvider for GitRegistry {
    fn name(&self) -> &str {
        &self.name
    }

    async fn search(&self, query: &SkillQuery) -> Result<Vec<SkillListing>> {
        self.sync_repo().await?;
        
        let mut results = Vec::new();
        let cache_dir = self.cache_dir.clone();
        
        // Scan for SKILL.md files
        // We use spawn_blocking for blocking IO
        let listings = tokio::task::spawn_blocking(move || -> Result<Vec<SkillListing>> {
            let mut items = Vec::new();
            
            for entry in WalkDir::new(&cache_dir).max_depth(3) {
                let entry = match entry {
                    Ok(e) => e,
                    Err(_) => continue,
                };
                
                if entry.file_name() == "SKILL.md" {
                    let skill_path = entry.path().parent().unwrap();
                    let id = skill_path.file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unknown".to_string());
                        
                    // Parse metadata
                    let metadata = match parse_skill_md(&entry.path().to_path_buf()) {
                        Ok(m) => m,
                        Err(_) => continue,
                    };
                    
                    items.push(SkillListing {
                        id,
                        name: metadata.name.unwrap_or_default(),
                        description: metadata.description.unwrap_or_default(),
                        author: metadata.author,
                        tags: metadata.tags,
                        version: metadata.version.unwrap_or_else(|| "0.0.0".to_string()),
                        downloads: None,
                        rating: None,
                        source: SkillSource::Git { 
                            url: "TODO: passed in closure".to_string(), // we'll fix this in the main loop
                            branch: None, 
                            path: None 
                        },
                    });
                }
            }
            Ok(items)
        }).await.map_err(|e| Error::System(e.to_string()))??;
        
        // Fix up the source URL and filter
        for mut listing in listings {
            listing.source = SkillSource::Git {
                url: self.url.clone(),
                branch: self.branch.clone(),
                path: Some(listing.id.clone()), // Assuming skill ID is directory name
            };
            
            // Apply query filter
            let matches = query.query.as_ref().map_or(true, |q| {
                listing.id.contains(q) || listing.name.contains(q)
            });
            
            if matches {
                results.push(listing);
            }
        }

        Ok(results)
    }

    async fn get_skill(&self, skill_id: &str) -> Result<Skill> {
        // Determine path within cache
        // We need to find where this skill_id is located. 
        // For simplicity, we assume skill_id == directory name
        let skill_path = self.cache_dir.join(skill_id);
        let skill_md_path = skill_path.join("SKILL.md");
        
        if !skill_md_path.exists() {
            // Try to resync once
            self.sync_repo().await?;
            if !skill_md_path.exists() {
                return Err(Error::SkillNotFound(skill_id.to_string()));
            }
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
            source: SkillSource::Git {
                url: self.url.clone(),
                branch: self.branch.clone(),
                path: Some(skill_id.to_string()),
            },
            skill_md_path,
            resources: Vec::new(),
            metadata: std::collections::HashMap::new(),
        })
    }

    async fn fetch(&self, skill_id: &str, dest: &PathBuf) -> Result<PathBuf> {
        let skill_path = self.cache_dir.join(skill_id);
        if !skill_path.exists() {
            return Err(Error::SkillNotFound(skill_id.to_string()));
        }
        
        // Copy directory
        if dest.exists() {
            fs::remove_dir_all(dest).await.map_err(|e| Error::Io(e))?;
        }
        
        // Recursive copy using walkdir and fs
        let src = skill_path.clone();
        let dst = dest.clone();
        
        tokio::task::spawn_blocking(move || -> Result<()> {
            for entry in WalkDir::new(&src) {
                let entry = entry.map_err(|e| Error::Io(e.into()))?;
                let rel_path = entry.path().strip_prefix(&src).unwrap();
                let target_path = dst.join(rel_path);
                
                if entry.file_type().is_dir() {
                    std::fs::create_dir_all(&target_path).map_err(Error::Io)?;
                } else {
                    std::fs::copy(entry.path(), &target_path).map_err(Error::Io)?;
                }
            }
            Ok(())
        }).await.map_err(|e| Error::System(e.to_string()))??;
        
        Ok(dest.clone())
    }

    async fn versions(&self, skill_id: &str) -> Result<Vec<SkillVersion>> {
        let skill = self.get_skill(skill_id).await?;
        Ok(vec![skill.version])
    }
}
