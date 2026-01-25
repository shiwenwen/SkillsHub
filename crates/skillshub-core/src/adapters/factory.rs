//! Droid/Factory adapter

use std::path::PathBuf;

use crate::error::Result;
use crate::models::ToolType;

use super::ToolAdapter;

/// Adapter for Droid/Factory
pub struct FactoryAdapter {
    custom_path: Option<PathBuf>,
}

impl FactoryAdapter {
    pub fn new() -> Self {
        Self { custom_path: None }
    }

    pub fn with_path(path: PathBuf) -> Self {
        Self { custom_path: Some(path) }
    }

    fn default_path() -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".factory").join("skills"))
    }
}

impl Default for FactoryAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolAdapter for FactoryAdapter {
    fn tool_type(&self) -> ToolType {
        ToolType::Factory
    }

    fn detect(&self) -> bool {
        dirs::home_dir()
            .map(|h| h.join(".factory").exists())
            .unwrap_or(false)
    }

    fn skills_dir(&self) -> Result<PathBuf> {
        let path = self.custom_path.clone()
            .or_else(Self::default_path)
            .ok_or_else(|| crate::error::Error::ToolNotFound("Factory".to_string()))?;
        
        std::fs::create_dir_all(&path)?;
        Ok(path)
    }

    fn config_dir(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".factory"))
    }
}
