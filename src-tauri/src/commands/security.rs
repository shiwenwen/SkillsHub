//! Security scan commands

use std::path::PathBuf;

use skillshub_core::scanner::SecurityScanner;
use skillshub_core::store::LocalStore;

use super::types::{Finding, ScanResult, SecurityRuleInfo, SecurityScanRecord};

#[tauri::command]
pub async fn scan_skill(skill_id: String) -> Result<ScanResult, String> {
    let store = LocalStore::default_store().map_err(|e| e.to_string())?;
    let skill_path = store.skill_path(&skill_id);

    if !skill_path.exists() {
        return Err(format!("Skill '{}' not found in store", skill_id));
    }

    let scanner = SecurityScanner::new();
    let report = scanner
        .scan(&skill_id, &skill_path)
        .map_err(|e| e.to_string())?;

    Ok(ScanResult {
        skill_id,
        passed: report.passed,
        overall_risk: report.overall_risk.to_string(),
        findings: report
            .findings
            .into_iter()
            .map(|f| Finding {
                rule_name: f.rule_name,
                risk_level: f.risk_level.to_string(),
                description: f.description,
                file: f.file.display().to_string(),
                line: f.line,
                recommendation: f.recommendation,
            })
            .collect(),
    })
}

#[tauri::command]
pub async fn list_security_rules() -> Result<Vec<SecurityRuleInfo>, String> {
    let scanner = SecurityScanner::new();
    Ok(scanner
        .list_rules()
        .into_iter()
        .map(|rule| SecurityRuleInfo {
            id: rule.id,
            name: rule.name,
            risk_level: rule.risk_level.to_string(),
            enabled: true,
        })
        .collect())
}

fn security_scan_records_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_local_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
        .ok_or("Cannot determine data directory")?;
    Ok(data_dir
        .join("skillshub")
        .join("security_scan_records.json"))
}

fn load_security_scan_records_from_file() -> Result<Vec<SecurityScanRecord>, String> {
    let path = security_scan_records_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read security scan records: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse security scan records: {}", e))
}

fn save_security_scan_records_to_file(records: &[SecurityScanRecord]) -> Result<(), String> {
    let path = security_scan_records_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(records)
        .map_err(|e| format!("Failed to serialize security scan records: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write security scan records: {}", e))
}

#[tauri::command]
pub async fn get_security_scan_records() -> Result<Vec<SecurityScanRecord>, String> {
    load_security_scan_records_from_file()
}

#[tauri::command]
pub async fn save_security_scan_records(records: Vec<SecurityScanRecord>) -> Result<(), String> {
    let limited: Vec<SecurityScanRecord> = records.into_iter().take(100).collect();
    save_security_scan_records_to_file(&limited)
}
