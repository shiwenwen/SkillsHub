//! Install command - install a skill

use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use std::path::PathBuf;

use skillshub_core::adapters::create_default_adapters;
use skillshub_core::models::{SyncStrategy, ToolType};
use skillshub_core::scanner::SecurityScanner;
use skillshub_core::store::LocalStore;
use skillshub_core::sync::SyncEngine;

pub async fn run(
    skill: &str,
    tools: Option<&str>,
    sync_strategy: &str,
    skip_scan: bool,
) -> anyhow::Result<()> {
    println!("{} Installing skill: {}", "📦".green(), skill.bold());
    println!();

    // Parse sync strategy
    let strategy = match sync_strategy {
        "link" => SyncStrategy::Link,
        "copy" => SyncStrategy::Copy,
        _ => SyncStrategy::Auto,
    };

    // Parse target tools
    let target_tools: Vec<ToolType> = if let Some(tools_str) = tools {
        tools_str
            .split(',')
            .filter_map(|t| match t.trim().to_lowercase().as_str() {
                "claude" => Some(ToolType::Claude),
                "cursor" => Some(ToolType::Cursor),
                "gemini" => Some(ToolType::Gemini),
                "opencode" => Some(ToolType::OpenCode),
                _ => None,
            })
            .collect()
    } else {
        vec![ToolType::Claude, ToolType::Cursor, ToolType::Gemini, ToolType::OpenCode]
    };

    // Create progress bar
    let pb = ProgressBar::new(100);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{bar:40.cyan/blue}] {pos}% {msg}")
            .unwrap()
            .progress_chars("█▓░"),
    );

    // Step 1: Resolve skill source
    pb.set_message("Resolving skill source...");
    pb.set_position(10);

    let skill_path = if skill.starts_with("http") || skill.starts_with("git@") {
        // TODO: Fetch from remote
        println!("{}", "Remote sources coming soon!".yellow());
        return Ok(());
    } else if PathBuf::from(skill).exists() {
        PathBuf::from(skill)
    } else {
        // Look in local registry
        let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("Cannot find home directory"))?;
        let local_path = home.join(".skillshub").join("local-registry").join(skill);
        if local_path.exists() {
            local_path
        } else {
            return Err(anyhow::anyhow!("Skill not found: {}", skill));
        }
    };

    // Step 2: Security scan
    pb.set_position(30);
    if !skip_scan {
        pb.set_message("Running security scan...");
        let scanner = SecurityScanner::new();
        let report = scanner.scan(skill, &skill_path)?;
        
        if !report.passed {
            pb.finish_with_message("Scan failed!");
            println!();
            println!("{} Security scan blocked installation:", "⚠️".red());
            for finding in &report.findings {
                println!(
                    "  {} [{}] {}",
                    "•".red(),
                    finding.risk_level.to_string().red(),
                    finding.description
                );
            }
            return Err(anyhow::anyhow!("Security policy violation"));
        }
        
        if report.summary.high > 0 || report.summary.medium > 0 {
            println!();
            println!("{} Security warnings:", "⚠️".yellow());
            for finding in report.findings.iter().filter(|f| {
                matches!(
                    f.risk_level,
                    skillshub_core::models::RiskLevel::High
                        | skillshub_core::models::RiskLevel::Medium
                )
            }) {
                println!(
                    "  {} [{}] {}",
                    "•".yellow(),
                    finding.risk_level.to_string().yellow(),
                    finding.description
                );
            }
            println!();
        }
    }

    // Step 3: Import to local store
    pb.set_position(50);
    pb.set_message("Importing to local store...");

    let store = LocalStore::default_store()?;
    let skill_id = skill_path
        .file_name()
        .and_then(|n: &std::ffi::OsStr| n.to_str())
        .unwrap_or(skill)
        .to_string();

    // Step 4: Sync to tools
    pb.set_position(70);
    pb.set_message("Syncing to tools...");

    let mut engine = SyncEngine::new(store);
    for adapter in create_default_adapters() {
        engine.register_adapter(adapter);
    }

    // Detect available tools
    let available_tools = engine.detect_tools();
    let tools_to_sync: Vec<ToolType> = target_tools
        .into_iter()
        .filter(|t| available_tools.iter().any(|p| p.tool_type == *t && p.detected))
        .collect();

    pb.set_position(90);
    for tool in &tools_to_sync {
        pb.set_message(format!("Syncing to {}...", tool.display_name()));
        match engine.sync_skill(&skill_id, *tool, strategy) {
            Ok(_) => {
                println!("  {} Synced to {}", "✓".green(), tool.display_name());
            }
            Err(e) => {
                println!("  {} Failed to sync to {}: {}", "✗".red(), tool.display_name(), e);
            }
        }
    }

    pb.set_position(100);
    pb.finish_with_message("Done!");

    println!();
    println!(
        "{} Skill {} installed successfully!",
        "✓".green(),
        skill_id.bold()
    );

    Ok(())
}
