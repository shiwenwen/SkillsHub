//! Shared response types and utility functions for Tauri commands

use serde::{Deserialize, Serialize};
use skillshub_core::models::ToolType;

#[derive(Debug, Serialize)]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub source: String,
    pub installed_at: String,
    pub scan_passed: bool,
    pub synced_tools: Vec<String>,
    pub author: Option<String>,
    pub tags: Vec<String>,
    pub downloads: Option<u64>,
    pub rating: Option<f32>,
}

#[derive(Debug, Serialize)]
pub struct ToolInfo {
    pub name: String,
    pub tool_type: String,
    pub detected: bool,
    pub skills_dir: Option<String>,
    pub skills_dirs: Vec<String>,
    pub skill_count: usize,
}

#[derive(Debug, Serialize)]
pub struct ScanResult {
    pub skill_id: String,
    pub passed: bool,
    pub overall_risk: String,
    pub findings: Vec<Finding>,
}

#[derive(Debug, Serialize)]
pub struct SecurityRuleInfo {
    pub id: String,
    pub name: String,
    pub risk_level: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct Finding {
    pub rule_name: String,
    pub risk_level: String,
    pub description: String,
    pub file: String,
    pub line: Option<usize>,
    pub recommendation: String,
}

#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub skill_id: String,
    pub tool: String,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SkillDetailInfo {
    pub id: String,
    pub name: String,
    pub skill_path: String,
    pub skill_md_content: Option<String>,
    pub files: Vec<SkillFileInfo>,
    pub synced_tools: Vec<SyncedToolInfo>,
}

#[derive(Debug, Serialize)]
pub struct SkillFileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct SyncedToolInfo {
    pub tool_name: String,
    pub tool_type: String,
    pub is_synced: bool,
    pub is_link: bool,
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpdateCheckInfo {
    pub skill_id: String,
    pub current_version: String,
    pub current_hash: String,
    pub latest_version: String,
    pub latest_hash: String,
    pub has_update: bool,
    pub source_registry: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ScannedSkillInfo {
    pub id: String,
    pub path: String,
    pub tool: String,
    pub in_hub: bool,
    pub is_link: bool,
}

#[derive(Debug, Serialize)]
pub struct FullSyncResponse {
    pub collected_count: usize,
    pub collected_skills: Vec<String>,
    pub distributed_count: usize,
    pub distributed: Vec<DistributedSkill>,
}

#[derive(Debug, Serialize)]
pub struct DistributedSkill {
    pub skill_id: String,
    pub tool: String,
    pub success: bool,
}

#[derive(Debug, Serialize)]
pub struct HubStatusInfo {
    pub skill_id: String,
    pub hub_path: String,
    pub synced_to: Vec<String>,
    pub missing_in: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct StoreInfo {
    pub path: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub skill_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomToolConfig {
    pub id: String,
    pub name: String,
    pub global_path: Option<String>,
    pub project_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityScanRecord {
    pub skill: String,
    pub scanned_at: u64,
    pub risk: String,
    pub findings: usize,
    pub source: String,
}

#[derive(Debug, Serialize)]
pub struct CloudSyncResponse {
    pub pushed: Vec<String>,
    pub pulled: Vec<String>,
}

/// Parse a tool type string into a ToolType enum
pub fn parse_tool_type(s: &str) -> Option<ToolType> {
    match s.to_lowercase().as_str() {
        "amp" => Some(ToolType::Amp),
        "antigravity" => Some(ToolType::Antigravity),
        "claude" => Some(ToolType::Claude),
        "codebuddy" => Some(ToolType::CodeBuddy),
        "codex" => Some(ToolType::Codex),
        "copilot" => Some(ToolType::Copilot),
        "cursor" => Some(ToolType::Cursor),
        "factory" => Some(ToolType::Factory),
        "gemini" => Some(ToolType::Gemini),
        "goose" => Some(ToolType::Goose),
        "kilocode" => Some(ToolType::KiloCode),
        "kimi" => Some(ToolType::Kimi),
        "opencode" => Some(ToolType::OpenCode),
        "openclaw" => Some(ToolType::OpenClaw),
        "qwen" => Some(ToolType::Qwen),
        "roocode" => Some(ToolType::RooCode),
        "trae" => Some(ToolType::Trae),
        "windsurf" => Some(ToolType::Windsurf),
        _ => None,
    }
}
