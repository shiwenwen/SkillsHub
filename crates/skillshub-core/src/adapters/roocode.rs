//! Roo Code adapter

use std::path::PathBuf;

use crate::error::Result;
use crate::models::ToolType;

use super::ToolAdapter;

/// Adapter for Roo Code
pub struct RooCodeAdapter {
    custom_path: Option<PathBuf>,
}

impl RooCodeAdapter {
    pub fn new() -> Self {
        Self { custom_path: None }
    }

    pub fn with_path(path: PathBuf) -> Self {
        Self { custom_path: Some(path) }
    }

    fn default_path() -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".roo").join("skills"))
    }
}

impl Default for RooCodeAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolAdapter for RooCodeAdapter {
    fn tool_type(&self) -> ToolType {
        ToolType::RooCode
    }

    fn detect(&self) -> bool {
        dirs::home_dir()
            .map(|h| h.join(".roo").exists())
            .unwrap_or(false)
    }

    fn skills_dir(&self) -> Result<PathBuf> {
        let path = self.custom_path.clone()
            .or_else(Self::default_path)
            .ok_or_else(|| crate::error::Error::ToolNotFound("Roo Code".to_string()))?;
        
        std::fs::create_dir_all(&path)?;
        Ok(path)
    }

    fn config_dir(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".roo"))
    }
}
