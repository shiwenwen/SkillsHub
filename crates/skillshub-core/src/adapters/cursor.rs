//! Cursor adapter

use std::path::PathBuf;

use crate::error::Result;
use crate::models::ToolType;

use super::ToolAdapter;

/// Adapter for Cursor IDE
pub struct CursorAdapter {
    custom_path: Option<PathBuf>,
}

impl CursorAdapter {
    pub fn new() -> Self {
        Self { custom_path: None }
    }

    pub fn with_path(path: PathBuf) -> Self {
        Self {
            custom_path: Some(path),
        }
    }

    fn default_path() -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".cursor").join("skills"))
    }
}

impl Default for CursorAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolAdapter for CursorAdapter {
    fn tool_type(&self) -> ToolType {
        ToolType::Cursor
    }

    fn detect(&self) -> bool {
        dirs::home_dir()
            .map(|h| h.join(".cursor").exists())
            .unwrap_or(false)
    }

    fn skills_dir(&self) -> Result<PathBuf> {
        let path = self
            .custom_path
            .clone()
            .or_else(Self::default_path)
            .ok_or_else(|| crate::error::Error::ToolNotFound("Cursor".to_string()))?;

        std::fs::create_dir_all(&path)?;
        Ok(path)
    }

    fn config_dir(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".cursor"))
    }
}
