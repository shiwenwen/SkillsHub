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

    fn default_path() -> Option<PathBuf> {
        // First check for the standard workspace path: ~/.openclaw/workspace/skills/
        if let Some(home) = dirs::home_dir() {
            let workspace_path = home.join(".openclaw").join("workspace").join("skills");
            if workspace_path.exists() {
                return Some(workspace_path);
            }
        }

        // Try to detect OpenClaw installation path by running `which openclaw`
        // OpenClaw is typically installed globally via npm, so paths may vary:
        // - ~/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/
        // - /usr/local/lib/node_modules/openclaw/skills/
        // - Other Node version manager paths

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
            .custom_path
            .clone()
            .or_else(Self::default_path)
            .ok_or_else(|| crate::error::Error::ToolNotFound("OpenClaw".to_string()))?;

        std::fs::create_dir_all(&path)?;
        Ok(path)
    }

    fn config_dir(&self) -> Option<PathBuf> {
        // OpenClaw might have a config directory, but it's unclear from the info provided
        // This can be updated if OpenClaw has a specific config directory
        None
    }
}
