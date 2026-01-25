//! Scan command - security scan a skill

use colored::Colorize;
use std::path::PathBuf;

use skillshub_core::models::{RiskLevel, ScanPolicy};
use skillshub_core::scanner::SecurityScanner;
use skillshub_core::store::LocalStore;

pub async fn run(target: &str, policy: &str) -> anyhow::Result<()> {
    println!("{} Scanning: {}", "🔍".cyan(), target.bold());
    println!();

    // Determine target path
    let skill_path = if PathBuf::from(target).exists() {
        PathBuf::from(target)
    } else {
        // Look in store
        let store = LocalStore::default_store()?;
        if store.is_installed(target) {
            store.skill_path(target)
        } else {
            return Err(anyhow::anyhow!("Skill or path not found: {}", target));
        }
    };

    // Configure policy
    let scan_policy = match policy {
        "strict" => ScanPolicy {
            block_threshold: RiskLevel::High,
            confirm_threshold: RiskLevel::Medium,
            ..Default::default()
        },
        _ => ScanPolicy::default(),
    };

    let scanner = SecurityScanner::with_policy(scan_policy);
    let report = scanner.scan(target, &skill_path)?;

    // Display results
    println!("{}", "═".repeat(50).dimmed());
    println!("{}", "Security Scan Report".bold());
    println!("{}", "═".repeat(50).dimmed());
    println!();

    println!(
        "Skill: {}",
        target.bold()
    );
    println!(
        "Overall Risk: {}",
        format_risk_level(report.overall_risk)
    );
    println!(
        "Status: {}",
        if report.passed {
            "PASSED".green().bold()
        } else {
            "BLOCKED".red().bold()
        }
    );
    println!();

    // Summary
    println!("{}", "Summary:".bold());
    println!("  Total findings: {}", report.summary.total);
    if report.summary.block > 0 {
        println!("  {} BLOCK", format!("  {}", report.summary.block).red());
    }
    if report.summary.high > 0 {
        println!("  {} HIGH", format!("  {}", report.summary.high).red());
    }
    if report.summary.medium > 0 {
        println!("  {} MEDIUM", format!("  {}", report.summary.medium).yellow());
    }
    if report.summary.low > 0 {
        println!("  {} LOW", format!("  {}", report.summary.low).dimmed());
    }
    println!();

    // Findings
    if !report.findings.is_empty() {
        println!("{}", "Findings:".bold());
        println!();
        
        for finding in &report.findings {
            let risk_str = format_risk_level(finding.risk_level);
            println!(
                "  {} [{}] {}",
                "•".cyan(),
                risk_str,
                finding.rule_name.bold()
            );
            println!("    {}", finding.description.dimmed());
            if let Some(ref snippet) = finding.snippet {
                println!("    Code: {}", snippet.yellow());
            }
            println!("    File: {}", finding.file.display());
            if let Some(line) = finding.line {
                println!("    Line: {}", line);
            }
            println!("    Recommendation: {}", finding.recommendation.cyan());
            println!();
        }
    }

    println!("{}", "═".repeat(50).dimmed());

    if report.passed {
        println!("{} Scan complete - no blocking issues found", "✓".green());
    } else {
        println!("{} Scan complete - blocking issues found", "✗".red());
    }

    Ok(())
}

fn format_risk_level(level: RiskLevel) -> colored::ColoredString {
    match level {
        RiskLevel::Low => "LOW".dimmed(),
        RiskLevel::Medium => "MEDIUM".yellow(),
        RiskLevel::High => "HIGH".red(),
        RiskLevel::Block => "BLOCK".red().bold(),
    }
}
