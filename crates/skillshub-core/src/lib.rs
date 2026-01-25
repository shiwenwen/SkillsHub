//! SkillsHub Core Library
//!
//! Core functionality for the unified Agent Skills management platform.
//! Provides skill management, multi-tool sync, security scanning, and registry access.

pub mod adapters;
pub mod error;
pub mod models;
pub mod plugins;
pub mod registry;
pub mod scanner;
pub mod store;
pub mod sync;

pub use error::{Error, Result};
pub use models::*;
pub use plugins::{PluginScanner, PluginSkill};

