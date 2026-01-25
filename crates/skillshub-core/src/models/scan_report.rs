//! Security scan report models

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Risk level for security findings
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    /// Informational, no action needed
    Low,
    /// Worth noting, user should be aware
    Medium,
    /// Significant risk, requires confirmation
    High,
    /// Critical risk, blocks installation
    Block,
}

impl std::fmt::Display for RiskLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RiskLevel::Low => write!(f, "LOW"),
            RiskLevel::Medium => write!(f, "MEDIUM"),
            RiskLevel::High => write!(f, "HIGH"),
            RiskLevel::Block => write!(f, "BLOCK"),
        }
    }
}

/// A security finding from the scanner
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityFinding {
    /// Rule ID that triggered this finding
    pub rule_id: String,
    /// Human-readable rule name
    pub rule_name: String,
    /// Risk level
    pub risk_level: RiskLevel,
    /// Description of the finding
    pub description: String,
    /// File where the finding was detected
    pub file: PathBuf,
    /// Line number if applicable
    pub line: Option<usize>,
    /// The matched content snippet
    pub snippet: Option<String>,
    /// Recommended action
    pub recommendation: String,
}

/// Complete scan report for a skill
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanReport {
    /// Skill ID that was scanned
    pub skill_id: String,
    /// Overall risk level (highest of all findings)
    pub overall_risk: RiskLevel,
    /// Whether the skill passed the policy
    pub passed: bool,
    /// List of findings
    pub findings: Vec<SecurityFinding>,
    /// Scan timestamp
    pub scanned_at: String,
    /// Version that was scanned
    pub version_hash: String,
    /// Summary statistics
    pub summary: ScanSummary,
}

impl ScanReport {
    /// Create a new clean scan report (no findings)
    pub fn clean(skill_id: impl Into<String>, version_hash: impl Into<String>) -> Self {
        Self {
            skill_id: skill_id.into(),
            overall_risk: RiskLevel::Low,
            passed: true,
            findings: Vec::new(),
            scanned_at: chrono_now(),
            version_hash: version_hash.into(),
            summary: ScanSummary::default(),
        }
    }

    /// Add a finding and update overall risk
    pub fn add_finding(&mut self, finding: SecurityFinding) {
        if finding.risk_level > self.overall_risk {
            self.overall_risk = finding.risk_level;
        }
        if finding.risk_level >= RiskLevel::Block {
            self.passed = false;
        }
        self.summary.add(&finding.risk_level);
        self.findings.push(finding);
    }
}

/// Summary of scan findings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScanSummary {
    pub total: usize,
    pub low: usize,
    pub medium: usize,
    pub high: usize,
    pub block: usize,
}

impl ScanSummary {
    fn add(&mut self, level: &RiskLevel) {
        self.total += 1;
        match level {
            RiskLevel::Low => self.low += 1,
            RiskLevel::Medium => self.medium += 1,
            RiskLevel::High => self.high += 1,
            RiskLevel::Block => self.block += 1,
        }
    }
}

/// Scan policy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanPolicy {
    /// Minimum risk level to report
    pub report_threshold: RiskLevel,
    /// Risk level that requires confirmation
    pub confirm_threshold: RiskLevel,
    /// Risk level that blocks installation
    pub block_threshold: RiskLevel,
    /// Whitelisted rule IDs
    pub whitelisted_rules: Vec<String>,
    /// Whitelisted skill sources
    pub trusted_sources: Vec<String>,
}

impl Default for ScanPolicy {
    fn default() -> Self {
        Self {
            report_threshold: RiskLevel::Low,
            confirm_threshold: RiskLevel::High,
            block_threshold: RiskLevel::Block,
            whitelisted_rules: Vec::new(),
            trusted_sources: Vec::new(),
        }
    }
}

fn chrono_now() -> String {
    // Simple timestamp without external dependency
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", duration.as_secs())
}
