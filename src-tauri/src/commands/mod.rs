//! Tauri commands for SkillsHub
//!
//! Split into focused modules for maintainability:
//! - `types` - Shared response types and utility functions
//! - `skills` - Skill CRUD, detail, and update checking
//! - `sync` - Multi-tool synchronization and drift detection
//! - `security` - Security scanning and scan records
//! - `tools` - Tool detection and custom tool management
//! - `registry` - Registry search and management
//! - `plugins` - Claude plugin scanning and syncing
//! - `cloud` - Cloud drive sync operations
//! - `config` - App configuration, store info, and utilities

pub mod cloud;
pub mod config;
pub mod plugins;
pub mod registry;
pub mod security;
pub mod skills;
pub mod sync;
pub mod tools;
pub mod types;

// Re-export all commands for use in lib.rs
pub use cloud::*;
pub use config::*;
pub use plugins::*;
pub use registry::*;
pub use security::*;
pub use skills::*;
pub use sync::*;
pub use tools::*;
