//! OpenClaw adapter

use std::path::PathBuf;
use std::process::Command;

use crate::error::Result;
use crate::models::ToolType;

use super::ToolAdapter;

/// Adapter for OpenClaw
pub struct OpenClawAdapter {
    custom_path: Option<PathBuf>,
}

impl OpenClawAdapter {
    pub fn new() -> Self {
        Self { custom_path: None }
    }

    pub fn with_path(path: PathBuf) -> Self {
        Self {
            custom_path: Some(path),
        }
    }

    /// Get the workspace path: ~/.openclaw/workspace/skills/
    fn workspace_path() -> Option<PathBuf> {
        dirs::home_dir().map(|home| home.join(".openclaw").join("workspace").join("skills"))
    }

    /// Detect OpenClaw installation path by running `which openclaw`
    /// Returns path like: ~/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/
    fn detect_install_skills_path() -> Option<PathBuf> {
        Command::new("which")
            .arg("openclaw")
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout);
                    let path = path.trim();
                    if !path.is_empty() {
                        // Extract the node_modules path from the binary path
                        // e.g., ~/.nvm/versions/node/v22.22.0/bin/openclaw
                        //    -> ~/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/
                        let bin_path = PathBuf::from(path);
                        if let Some(parent) = bin_path.parent() {
                            if let Some(grandparent) = parent.parent() {
                                let skills_path = grandparent
                                    .join("lib")
                                    .join("node_modules")
                                    .join("openclaw")
                                    .join("skills");
                                if skills_path.exists() {
                                    return Some(skills_path);
                                }
                            }
                        }
                    }
                }
                None
            })
    }

    /// Get primary path (workspace path - for writing)
    fn primary_path(&self) -> Option<PathBuf> {
        self.custom_path.clone().or_else(Self::workspace_path)
    }
}

impl Default for OpenClawAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolAdapter for OpenClawAdapter {
    fn tool_type(&self) -> ToolType {
        ToolType::OpenClaw
    }

    fn detect(&self) -> bool {
        // Check if openclaw command is available
        Command::new("which")
            .arg("openclaw")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    fn skills_dir(&self) -> Result<PathBuf> {
        let path = self
            .primary_path()
            .ok_or_else(|| crate::error::Error::ToolNotFound("OpenClaw".to_string()))?;

        std::fs::create_dir_all(&path)?;
        Ok(path)
    }

    /// Get all skills directories (workspace + installation path)
    fn skills_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();

        // 1. Custom path (if set)
        if let Some(ref custom) = self.custom_path {
            if custom.exists() {
                dirs.push(custom.clone());
            }
        }

        // 2. Workspace path: ~/.openclaw/workspace/skills/
        if let Some(workspace) = Self::workspace_path() {
            if workspace.exists() && !dirs.contains(&workspace) {
                dirs.push(workspace);
            }
        }

        // 3. Installation path (NPM global)
        if let Some(install_path) = Self::detect_install_skills_path() {
            if !dirs.contains(&install_path) {
                dirs.push(install_path);
            }
        }

        dirs
    }

    fn config_dir(&self) -> Option<PathBuf> {
        // OpenClaw config directory
        dirs::home_dir().map(|home| home.join(".openclaw"))
    }
}

