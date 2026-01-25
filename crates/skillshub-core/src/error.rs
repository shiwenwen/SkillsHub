//! Error types for SkillsHub

use thiserror::Error;

/// Result type alias using SkillsHub Error
pub type Result<T> = std::result::Result<T, Error>;

/// SkillsHub error types
#[derive(Error, Debug)]
pub enum Error {
    #[error("Skill not found: {0}")]
    SkillNotFound(String),

    #[error("Invalid skill format: {0}")]
    InvalidSkillFormat(String),

    #[error("Registry error: {0}")]
    RegistryError(String),

    #[error("Store error: {0}")]
    StoreError(String),

    #[error("Sync error: {0}")]
    SyncError(String),

    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Security scan failed: {0}")]
    ScanError(String),

    #[error("Security policy violation: {0}")]
    PolicyViolation(String),

    #[error("Config not found: {0}")]
    ConfigNotFound(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("URL parse error: {0}")]
    UrlParse(#[from] url::ParseError),

    #[error("System error: {0}")]
    System(String),
}
