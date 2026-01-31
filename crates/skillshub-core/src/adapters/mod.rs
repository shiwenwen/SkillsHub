//! Tool Adapters - integration with different Agent tools

mod amp;
mod antigravity;
mod claude;
mod codebuddy;
mod codex;
mod copilot;
mod cursor;
mod factory;
mod gemini;
mod goose;
mod kilocode;
mod kimi;
mod openclaw;
mod opencode;
mod qwen;
mod roocode;
mod trae;
mod windsurf;

use std::path::PathBuf;

use crate::error::Result;
use crate::models::ToolType;

pub use amp::AmpAdapter;
pub use antigravity::AntigravityAdapter;
pub use claude::ClaudeAdapter;
pub use codebuddy::CodeBuddyAdapter;
pub use codex::CodexAdapter;
pub use copilot::CopilotAdapter;
pub use cursor::CursorAdapter;
pub use factory::FactoryAdapter;
pub use gemini::GeminiAdapter;
pub use goose::GooseAdapter;
pub use kilocode::KiloCodeAdapter;
pub use kimi::KimiAdapter;
pub use openclaw::OpenClawAdapter;
pub use opencode::OpenCodeAdapter;
pub use qwen::QwenAdapter;
pub use roocode::RooCodeAdapter;
pub use trae::TraeAdapter;
pub use windsurf::WindsurfAdapter;

/// Trait for tool-specific adapters
pub trait ToolAdapter: Send + Sync {
    /// Get the tool type
    fn tool_type(&self) -> ToolType;

    /// Detect if the tool is installed
    fn detect(&self) -> bool;

    /// Get the skills directory for this tool
    fn skills_dir(&self) -> Result<PathBuf>;

    /// Get custom configuration directory if any
    fn config_dir(&self) -> Option<PathBuf> {
        None
    }

    /// Get plugins directory for tools that support plugin marketplaces
    fn plugins_dir(&self) -> Option<PathBuf> {
        None
    }

    /// Check if this tool supports symlinks
    fn supports_symlinks(&self) -> bool {
        true
    }

    /// Get the expected skill structure for this tool
    fn skill_structure(&self) -> SkillStructure {
        SkillStructure::default()
    }
}

/// Expected structure for skills in a tool
#[derive(Debug, Clone, Default)]
pub struct SkillStructure {
    /// Whether the tool expects an index file
    pub needs_index: bool,
    /// Index file name if needed
    pub index_file: Option<String>,
    /// Whether skills should be in subdirectories
    pub use_subdirectories: bool,
}

/// Create all default adapters
pub fn create_default_adapters() -> Vec<Box<dyn ToolAdapter>> {
    vec![
        Box::new(AmpAdapter::new()),
        Box::new(AntigravityAdapter::new()),
        Box::new(ClaudeAdapter::new()),
        Box::new(CodeBuddyAdapter::new()),
        Box::new(CodexAdapter::new()),
        Box::new(CopilotAdapter::new()),
        Box::new(CursorAdapter::new()),
        Box::new(FactoryAdapter::new()),
        Box::new(GeminiAdapter::new()),
        Box::new(GooseAdapter::new()),
        Box::new(KiloCodeAdapter::new()),
        Box::new(KimiAdapter::new()),
        Box::new(OpenCodeAdapter::new()),
        Box::new(OpenClawAdapter::new()),
        Box::new(QwenAdapter::new()),
        Box::new(RooCodeAdapter::new()),
        Box::new(TraeAdapter::new()),
        Box::new(WindsurfAdapter::new()),
    ]
}
