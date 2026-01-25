//! Tool profile and adapter models

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Supported Agent tools
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolType {
    Amp,
    Antigravity,
    Claude,
    Codex,
    Cursor,
    CodeBuddy,
    Factory,
    Gemini,
    Copilot,
    Goose,
    KiloCode,
    Kimi,
    OpenCode,
    Qwen,
    RooCode,
    Trae,
    Windsurf,
    Custom,
}

impl ToolType {
    /// Get all built-in tool types (excluding Custom)
    pub fn all_builtin() -> Vec<ToolType> {
        vec![
            ToolType::Amp,
            ToolType::Antigravity,
            ToolType::Claude,
            ToolType::Codex,
            ToolType::Cursor,
            ToolType::CodeBuddy,
            ToolType::Factory,
            ToolType::Gemini,
            ToolType::Copilot,
            ToolType::Goose,
            ToolType::KiloCode,
            ToolType::Kimi,
            ToolType::OpenCode,
            ToolType::Qwen,
            ToolType::RooCode,
            ToolType::Trae,
            ToolType::Windsurf,
        ]
    }

    /// Get the default global skills directory for this tool
    pub fn default_skills_dir(&self) -> Option<PathBuf> {
        let home = dirs::home_dir()?;
        match self {
            ToolType::Amp => Some(home.join(".config").join("agents").join("skills")),
            ToolType::Antigravity => Some(home.join(".gemini").join("antigravity").join("skills")),
            ToolType::Claude => Some(home.join(".claude").join("skills")),
            ToolType::Codex => Some(home.join(".codex").join("skills")),
            ToolType::Cursor => Some(home.join(".cursor").join("skills")),
            ToolType::CodeBuddy => Some(home.join(".codebuddy").join("skills")),
            ToolType::Factory => Some(home.join(".factory").join("skills")),
            ToolType::Gemini => Some(home.join(".gemini").join("skills")),
            ToolType::Copilot => Some(home.join(".copilot").join("skills")),
            ToolType::Goose => Some(home.join(".config").join("goose").join("skills")),
            ToolType::KiloCode => Some(home.join(".kilocode").join("skills")),
            ToolType::Kimi => Some(home.join(".kimi").join("skills")),
            ToolType::OpenCode => Some(home.join(".config").join("opencode").join("skills")),
            ToolType::Qwen => Some(home.join(".qwen").join("skills")),
            ToolType::RooCode => Some(home.join(".roo").join("skills")),
            ToolType::Trae => None, // Trae has no global path
            ToolType::Windsurf => Some(home.join(".codeium").join("windsurf").join("skills")),
            ToolType::Custom => None,
        }
    }

    /// Get the default project-level skills directory for this tool
    pub fn default_project_dir(&self) -> Option<&'static str> {
        match self {
            ToolType::Amp => Some(".agents/skills/"),
            ToolType::Antigravity => Some(".agent/skills/"),
            ToolType::Claude => Some(".claude/skills/"),
            ToolType::Codex => Some(".codex/skills/"),
            ToolType::Cursor => Some(".cursor/skills/"),
            ToolType::CodeBuddy => Some(".codebuddy/skills/"),
            ToolType::Factory => Some(".factory/skills/"),
            ToolType::Gemini => Some(".gemini/skills/"),
            ToolType::Copilot => Some(".github/skills/"),
            ToolType::Goose => Some(".goose/skills/"),
            ToolType::KiloCode => Some(".kilocode/skills/"),
            ToolType::Kimi => Some(".kimi/skills/"),
            ToolType::OpenCode => Some(".opencode/skills/"),
            ToolType::Qwen => Some(".qwen/skills/"),
            ToolType::RooCode => Some(".roo/skills/"),
            ToolType::Trae => Some(".trae/skills/"),
            ToolType::Windsurf => Some(".windsurf/skills/"),
            ToolType::Custom => None,
        }
    }

    /// Get the display name
    pub fn display_name(&self) -> &str {
        match self {
            ToolType::Amp => "Amp",
            ToolType::Antigravity => "Antigravity",
            ToolType::Claude => "Claude Code",
            ToolType::Codex => "Codex",
            ToolType::Cursor => "Cursor",
            ToolType::CodeBuddy => "CodeBuddy",
            ToolType::Factory => "Droid/Factory",
            ToolType::Gemini => "Gemini CLI",
            ToolType::Copilot => "GitHub Copilot",
            ToolType::Goose => "Goose",
            ToolType::KiloCode => "Kilo Code",
            ToolType::Kimi => "Kimi CLI",
            ToolType::OpenCode => "OpenCode",
            ToolType::Qwen => "Qwen Code",
            ToolType::RooCode => "Roo Code",
            ToolType::Trae => "Trae",
            ToolType::Windsurf => "Windsurf",
            ToolType::Custom => "Custom",
        }
    }
}

impl std::fmt::Display for ToolType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.display_name())
    }
}

/// Configuration for a tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolProfile {
    /// Tool type
    pub tool_type: ToolType,
    /// Whether this tool is enabled for sync
    pub enabled: bool,
    /// Custom global skills directory (overrides default)
    pub custom_global_path: Option<PathBuf>,
    /// Custom project skills directory (overrides default)
    pub custom_project_path: Option<String>,
    /// Sync strategy for this tool
    pub sync_strategy: SyncStrategy,
    /// Whether the tool was detected on the system
    pub detected: bool,
    /// Custom tool name (only for Custom type)
    pub custom_name: Option<String>,
}

impl ToolProfile {
    /// Create a new tool profile with defaults
    pub fn new(tool_type: ToolType) -> Self {
        Self {
            tool_type,
            enabled: true,
            custom_global_path: None,
            custom_project_path: None,
            sync_strategy: SyncStrategy::Auto,
            detected: false,
            custom_name: None,
        }
    }

    /// Create a custom tool profile
    pub fn new_custom(name: String, global_path: Option<PathBuf>, project_path: Option<String>) -> Self {
        Self {
            tool_type: ToolType::Custom,
            enabled: true,
            custom_global_path: global_path,
            custom_project_path: project_path,
            sync_strategy: SyncStrategy::Auto,
            detected: true,
            custom_name: Some(name),
        }
    }

    /// Get the effective global skills directory
    pub fn global_skills_dir(&self) -> Option<PathBuf> {
        self.custom_global_path.clone().or_else(|| self.tool_type.default_skills_dir())
    }

    /// Get the effective project skills directory
    pub fn project_skills_dir(&self) -> Option<String> {
        self.custom_project_path.clone().or_else(|| self.tool_type.default_project_dir().map(|s| s.to_string()))
    }

    /// Get the display name
    pub fn display_name(&self) -> String {
        self.custom_name.clone().unwrap_or_else(|| self.tool_type.display_name().to_string())
    }
}

/// Strategy for syncing skills to a tool
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum SyncStrategy {
    /// Auto-detect best strategy (link-first, copy-fallback)
    #[default]
    Auto,
    /// Always use symbolic links
    Link,
    /// Always copy files
    Copy,
}

impl std::fmt::Display for SyncStrategy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SyncStrategy::Auto => write!(f, "auto"),
            SyncStrategy::Link => write!(f, "link"),
            SyncStrategy::Copy => write!(f, "copy"),
        }
    }
}

/// Result of a projection operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectionResult {
    /// Tool that was projected to
    pub tool: ToolType,
    /// Whether the operation succeeded
    pub success: bool,
    /// Strategy that was used
    pub strategy_used: SyncStrategy,
    /// Path where skill was projected
    pub target_path: PathBuf,
    /// Error message if failed
    pub error: Option<String>,
}
