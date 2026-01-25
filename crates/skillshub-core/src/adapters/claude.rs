//! Claude Code adapter

use std::path::PathBuf;

use crate::error::Result;
use crate::models::ToolType;

use super::ToolAdapter;

/// Adapter for Claude Code
pub struct ClaudeAdapter {
    custom_path: Option<PathBuf>,
}

impl ClaudeAdapter {
    pub fn new() -> Self {
        Self { custom_path: None }
    }

    pub fn with_path(path: PathBuf) -> Self {
        Self { custom_path: Some(path) }
    }

    fn default_path() -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".claude").join("skills"))
    }
}

impl Default for ClaudeAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolAdapter for ClaudeAdapter {
    fn tool_type(&self) -> ToolType {
        ToolType::Claude
    }

    fn detect(&self) -> bool {
        // Check if .claude directory exists
        dirs::home_dir()
            .map(|h| h.join(".claude").exists())
            .unwrap_or(false)
    }

    fn skills_dir(&self) -> Result<PathBuf> {
        let path = self.custom_path.clone()
            .or_else(Self::default_path)
            .ok_or_else(|| crate::error::Error::ToolNotFound("Claude".to_string()))?;
        
        std::fs::create_dir_all(&path)?;
        Ok(path)
    }

    fn config_dir(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".claude"))
    }

    fn plugins_dir(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".claude").join("plugins"))
    }
}

