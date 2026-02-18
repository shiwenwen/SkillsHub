//! Tool Adapters - integration with different Agent tools
//!
//! Uses the `define_adapter!` macro to eliminate boilerplate across standard adapters.
//! Only adapters with genuinely unique logic (OpenClaw, Trae) are implemented manually.

mod openclaw;
mod trae;

use std::path::PathBuf;

use crate::error::Result;
use crate::models::ToolType;

pub use openclaw::OpenClawAdapter;
pub use trae::TraeAdapter;

/// Trait for tool-specific adapters
pub trait ToolAdapter: Send + Sync {
    /// Get the tool type
    fn tool_type(&self) -> ToolType;

    /// Detect if the tool is installed
    fn detect(&self) -> bool;

    /// Get the primary skills directory for this tool (used for syncing/writing)
    fn skills_dir(&self) -> Result<PathBuf>;

    /// Get all skills directories for this tool (used for scanning)
    /// Some tools may have multiple directories (e.g., workspace + installation path)
    /// By default, returns only the primary skills_dir
    fn skills_dirs(&self) -> Vec<PathBuf> {
        self.skills_dir().into_iter().collect()
    }

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

/// Macro to generate standard tool adapter implementations.
///
/// Supports:
/// - Single or multiple detect paths (OR logic)
/// - Optional plugins directory (only Claude uses this)
macro_rules! define_adapter {
    (
        $name:ident, $tool_type:expr, $tool_name:expr,
        skills: $skills_path:expr,
        detect: [$($detect_path:expr),+ $(,)?],
        config: $config_path:expr
        $(, plugins: $plugins_path:expr)?
    ) => {
        pub struct $name {
            custom_path: Option<PathBuf>,
        }

        impl $name {
            pub fn new() -> Self {
                Self { custom_path: None }
            }

            pub fn with_path(path: PathBuf) -> Self {
                Self { custom_path: Some(path) }
            }

            fn default_path() -> Option<PathBuf> {
                dirs::home_dir().map(|h| h.join($skills_path))
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl ToolAdapter for $name {
            fn tool_type(&self) -> ToolType {
                $tool_type
            }

            fn detect(&self) -> bool {
                dirs::home_dir()
                    .map(|h| $( h.join($detect_path).exists() )||+)
                    .unwrap_or(false)
            }

            fn skills_dir(&self) -> Result<PathBuf> {
                let path = self
                    .custom_path
                    .clone()
                    .or_else(Self::default_path)
                    .ok_or_else(|| crate::error::Error::ToolNotFound($tool_name.to_string()))?;
                std::fs::create_dir_all(&path)?;
                Ok(path)
            }

            fn config_dir(&self) -> Option<PathBuf> {
                dirs::home_dir().map(|h| h.join($config_path))
            }

            $(
                fn plugins_dir(&self) -> Option<PathBuf> {
                    dirs::home_dir().map(|h| h.join($plugins_path))
                }
            )?
        }
    };
}

// ── Standard adapters (single detect path) ──────────────────────────────────

define_adapter!(AmpAdapter, ToolType::Amp, "Amp",
    skills: ".config/agents/skills",
    detect: [".config/agents"],
    config: ".config/agents"
);

define_adapter!(AntigravityAdapter, ToolType::Antigravity, "Antigravity",
    skills: ".gemini/antigravity/skills",
    detect: [".gemini/antigravity"],
    config: ".gemini/antigravity"
);

define_adapter!(ClaudeAdapter, ToolType::Claude, "Claude",
    skills: ".claude/skills",
    detect: [".claude"],
    config: ".claude",
    plugins: ".claude/plugins"
);

define_adapter!(CodeBuddyAdapter, ToolType::CodeBuddy, "CodeBuddy",
    skills: ".codebuddy/skills",
    detect: [".codebuddy"],
    config: ".codebuddy"
);

define_adapter!(CodexAdapter, ToolType::Codex, "Codex",
    skills: ".codex/skills",
    detect: [".codex"],
    config: ".codex"
);

define_adapter!(CursorAdapter, ToolType::Cursor, "Cursor",
    skills: ".cursor/skills",
    detect: [".cursor"],
    config: ".cursor"
);

define_adapter!(FactoryAdapter, ToolType::Factory, "Factory",
    skills: ".factory/skills",
    detect: [".factory"],
    config: ".factory"
);

define_adapter!(GeminiAdapter, ToolType::Gemini, "Gemini",
    skills: ".gemini/skills",
    detect: [".gemini"],
    config: ".gemini"
);

define_adapter!(KiloCodeAdapter, ToolType::KiloCode, "Kilo Code",
    skills: ".kilocode/skills",
    detect: [".kilocode"],
    config: ".kilocode"
);

define_adapter!(KimiAdapter, ToolType::Kimi, "Kimi CLI",
    skills: ".kimi/skills",
    detect: [".kimi"],
    config: ".kimi"
);

define_adapter!(OpenCodeAdapter, ToolType::OpenCode, "OpenCode",
    skills: ".opencode/skills",
    detect: [".opencode"],
    config: ".opencode"
);

define_adapter!(QwenAdapter, ToolType::Qwen, "Qwen Code",
    skills: ".qwen/skills",
    detect: [".qwen"],
    config: ".qwen"
);

define_adapter!(RooCodeAdapter, ToolType::RooCode, "Roo Code",
    skills: ".roo/skills",
    detect: [".roo"],
    config: ".roo"
);

// ── Multi-detect adapters (OR logic for detection) ──────────────────────────

define_adapter!(CopilotAdapter, ToolType::Copilot, "GitHub Copilot",
    skills: ".copilot/skills",
    detect: [".copilot", ".github"],
    config: ".copilot"
);

define_adapter!(GooseAdapter, ToolType::Goose, "Goose",
    skills: ".config/goose/skills",
    detect: [".config/goose", ".goose"],
    config: ".config/goose"
);

define_adapter!(WindsurfAdapter, ToolType::Windsurf, "Windsurf",
    skills: ".codeium/windsurf/skills",
    detect: [".codeium/windsurf", ".windsurf"],
    config: ".codeium/windsurf"
);

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
