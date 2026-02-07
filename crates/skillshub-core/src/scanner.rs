//! Security Scanner - static analysis for skills

use std::fs;
use std::path::Path;

use regex::Regex;
use walkdir::WalkDir;

use crate::error::Result;
use crate::models::{RiskLevel, ScanPolicy, ScanReport, SecurityFinding};

/// Security scanner for skills
pub struct SecurityScanner {
    rules: Vec<ScanRule>,
    policy: ScanPolicy,
}

/// Security rule metadata for UI display
#[derive(Debug, Clone)]
pub struct SecurityRuleInfo {
    pub id: String,
    pub name: String,
    pub risk_level: RiskLevel,
}

/// A scanning rule
pub struct ScanRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub risk_level: RiskLevel,
    pub pattern: Regex,
    pub file_patterns: Vec<String>,
    pub recommendation: String,
}

impl SecurityScanner {
    /// Create a new scanner with default rules
    pub fn new() -> Self {
        Self::with_policy(ScanPolicy::default())
    }

    /// Create a scanner with custom policy
    pub fn with_policy(policy: ScanPolicy) -> Self {
        Self {
            rules: default_rules(),
            policy,
        }
    }

    /// Add a custom rule
    pub fn add_rule(&mut self, rule: ScanRule) {
        self.rules.push(rule);
    }

    /// List all active rules as metadata for display
    pub fn list_rules(&self) -> Vec<SecurityRuleInfo> {
        let mut rules: Vec<SecurityRuleInfo> = self
            .rules
            .iter()
            .map(|rule| SecurityRuleInfo {
                id: rule.id.clone(),
                name: rule.name.clone(),
                risk_level: rule.risk_level,
            })
            .collect();

        rules.push(SecurityRuleInfo {
            id: "FILE001".to_string(),
            name: "Binary Executable".to_string(),
            risk_level: RiskLevel::Block,
        });
        rules.push(SecurityRuleInfo {
            id: "FILE002".to_string(),
            name: "Shell Script".to_string(),
            risk_level: RiskLevel::Medium,
        });

        rules
    }

    /// Scan a skill directory
    pub fn scan(&self, skill_id: &str, skill_path: &Path) -> Result<ScanReport> {
        let mut report = ScanReport::clean(skill_id, "");

        // Update hash
        report.version_hash = calculate_hash(skill_path)?;

        // Scan all relevant files
        for entry in WalkDir::new(skill_path) {
            let entry = entry.map_err(|e| crate::error::Error::Io(e.into()))?;

            if !entry.file_type().is_file() {
                continue;
            }

            let path = entry.path();
            let _file_name = path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            // Check for suspicious file types
            if let Some(finding) = self.check_file_type(path) {
                report.add_finding(finding);
            }

            // Scan text files for patterns
            if is_text_file(path) {
                if let Ok(content) = fs::read_to_string(path) {
                    for finding in self.scan_content(&content, path) {
                        report.add_finding(finding);
                    }
                }
            }
        }

        // Apply policy
        report.passed = self.apply_policy(&report);

        Ok(report)
    }

    /// Scan file content for dangerous patterns
    fn scan_content(&self, content: &str, file_path: &Path) -> Vec<SecurityFinding> {
        let mut findings = Vec::new();

        for rule in &self.rules {
            // Skip whitelisted rules
            if self.policy.whitelisted_rules.contains(&rule.id) {
                continue;
            }

            // Check file pattern match
            let file_name = file_path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            let file_matches = rule.file_patterns.is_empty()
                || rule.file_patterns.iter().any(|p| {
                    glob::Pattern::new(p)
                        .map(|pat| pat.matches(&file_name))
                        .unwrap_or(false)
                });

            if !file_matches {
                continue;
            }

            // Search for pattern matches
            for (line_num, line) in content.lines().enumerate() {
                if rule.pattern.is_match(line) {
                    findings.push(SecurityFinding {
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        risk_level: rule.risk_level,
                        description: rule.description.clone(),
                        file: file_path.to_path_buf(),
                        line: Some(line_num + 1),
                        snippet: Some(truncate_line(line, 100)),
                        recommendation: rule.recommendation.clone(),
                    });
                }
            }
        }

        findings
    }

    /// Check for suspicious file types
    fn check_file_type(&self, path: &Path) -> Option<SecurityFinding> {
        let extension = path.extension().map(|s| s.to_string_lossy().to_lowercase());

        match extension.as_deref() {
            Some("exe") | Some("dll") | Some("so") | Some("dylib") => Some(SecurityFinding {
                rule_id: "FILE001".to_string(),
                rule_name: "Binary Executable".to_string(),
                risk_level: RiskLevel::Block,
                description: "Binary executable files are not allowed in skills".to_string(),
                file: path.to_path_buf(),
                line: None,
                snippet: None,
                recommendation: "Remove the binary file or provide source code instead".to_string(),
            }),
            Some("sh") | Some("bash") | Some("zsh") => Some(SecurityFinding {
                rule_id: "FILE002".to_string(),
                rule_name: "Shell Script".to_string(),
                risk_level: RiskLevel::Medium,
                description: "Shell scripts should be reviewed for dangerous commands".to_string(),
                file: path.to_path_buf(),
                line: None,
                snippet: None,
                recommendation: "Review script content before installation".to_string(),
            }),
            _ => None,
        }
    }

    /// Apply policy to determine if scan passed
    fn apply_policy(&self, report: &ScanReport) -> bool {
        for finding in &report.findings {
            if finding.risk_level >= self.policy.block_threshold {
                return false;
            }
        }
        true
    }
}

impl Default for SecurityScanner {
    fn default() -> Self {
        Self::new()
    }
}

/// Create default scanning rules
fn default_rules() -> Vec<ScanRule> {
    vec![
        ScanRule {
            id: "CMD001".to_string(),
            name: "Destructive Command".to_string(),
            description: "Command that could delete or destroy data".to_string(),
            risk_level: RiskLevel::High,
            pattern: Regex::new(r"(?i)(rm\s+-rf|del\s+/[sq]|format\s+|mkfs\.)").unwrap(),
            file_patterns: vec!["*.md".to_string(), "*.sh".to_string(), "*.py".to_string()],
            recommendation: "Review the command carefully before execution".to_string(),
        },
        ScanRule {
            id: "CMD002".to_string(),
            name: "Privilege Escalation".to_string(),
            description: "Command that attempts to escalate privileges".to_string(),
            risk_level: RiskLevel::High,
            pattern: Regex::new(r"(?i)(sudo\s+|chmod\s+[0-7]*7|chown\s+root)").unwrap(),
            file_patterns: vec!["*.md".to_string(), "*.sh".to_string()],
            recommendation: "Avoid commands requiring elevated privileges".to_string(),
        },
        ScanRule {
            id: "NET001".to_string(),
            name: "External Data Transfer".to_string(),
            description: "Potential data exfiltration via network".to_string(),
            risk_level: RiskLevel::High,
            pattern: Regex::new(r"(?i)(curl\s+.*(-d|--data)|wget\s+.*--post|nc\s+-e)").unwrap(),
            file_patterns: vec!["*.md".to_string(), "*.sh".to_string(), "*.py".to_string()],
            recommendation: "Verify the destination and data being sent".to_string(),
        },
        ScanRule {
            id: "CRED001".to_string(),
            name: "Credential Access".to_string(),
            description: "Accessing sensitive credential files or environment variables"
                .to_string(),
            risk_level: RiskLevel::High,
            pattern: Regex::new(r"(?i)(\.ssh/|\.aws/|\.gnupg/|API_KEY|SECRET_KEY|PASSWORD|TOKEN)")
                .unwrap(),
            file_patterns: vec!["*.md".to_string(), "*.sh".to_string(), "*.py".to_string()],
            recommendation: "Ensure credentials are not being leaked".to_string(),
        },
        ScanRule {
            id: "EVAL001".to_string(),
            name: "Dynamic Code Execution".to_string(),
            description: "Dynamic code execution which could be dangerous".to_string(),
            risk_level: RiskLevel::Medium,
            pattern: Regex::new(r"(?i)(eval\(|exec\(|subprocess\.call|os\.system)").unwrap(),
            file_patterns: vec!["*.py".to_string(), "*.js".to_string()],
            recommendation: "Avoid dynamic code execution when possible".to_string(),
        },
        ScanRule {
            id: "PATH001".to_string(),
            name: "System Path Access".to_string(),
            description: "Accessing sensitive system directories".to_string(),
            risk_level: RiskLevel::Medium,
            pattern: Regex::new(r"(?i)(/etc/passwd|/etc/shadow|/var/log|C:\\Windows\\System32)")
                .unwrap(),
            file_patterns: vec!["*.md".to_string(), "*.sh".to_string(), "*.py".to_string()],
            recommendation: "Verify that system path access is necessary".to_string(),
        },
    ]
}

fn is_text_file(path: &Path) -> bool {
    let text_extensions = [
        "md", "txt", "sh", "py", "js", "ts", "json", "yaml", "yml", "toml", "rs", "go",
    ];
    path.extension()
        .map(|e| text_extensions.contains(&e.to_string_lossy().to_lowercase().as_str()))
        .unwrap_or(false)
}

fn truncate_line(line: &str, max_len: usize) -> String {
    if line.len() > max_len {
        format!("{}...", &line[..max_len])
    } else {
        line.to_string()
    }
}

fn calculate_hash(path: &Path) -> Result<String> {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();

    for entry in WalkDir::new(path).sort_by_file_name() {
        let entry = entry.map_err(|e| crate::error::Error::Io(e.into()))?;
        if entry.file_type().is_file() {
            let content = fs::read(entry.path())?;
            hasher.update(&content);
        }
    }

    Ok(hex::encode(hasher.finalize()))
}
