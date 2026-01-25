//! Trae adapter

use std::path::PathBuf;

use crate::error::Result;
use crate::models::ToolType;

use super::ToolAdapter;

/// Adapter for Trae (only project-level, no global path)
pub struct TraeAdapter {
    custom_path: Option<PathBuf>,
}

impl TraeAdapter {
    pub fn new() -> Self {
        Self { custom_path: None }
    }

    pub fn with_path(path: PathBuf) -> Self {
        Self { custom_path: Some(path) }
    }
}

impl Default for TraeAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolAdapter for TraeAdapter {
    fn tool_type(&self) -> ToolType {
        ToolType::Trae
    }

    fn detect(&self) -> bool {
        // Trae has no global path, just check if .trae exists in current directory
        std::path::Path::new(".trae").exists()
    }

    fn skills_dir(&self) -> Result<PathBuf> {
        // Trae only supports project-level skills
        if let Some(path) = &self.custom_path {
            std::fs::create_dir_all(path)?;
            return Ok(path.clone());
        }
        Err(crate::error::Error::ToolNotFound("Trae (no global path available)".to_string()))
    }

    fn config_dir(&self) -> Option<PathBuf> {
        None // Trae has no global config directory
    }
}
