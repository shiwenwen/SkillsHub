//! Info command - show skill details

use colored::Colorize;
use std::fs;

use skillshub_core::store::LocalStore;

pub async fn run(skill: &str) -> anyhow::Result<()> {
    let store = LocalStore::default_store()?;

    if !store.is_installed(skill) {
        return Err(anyhow::anyhow!("Skill '{}' is not installed", skill));
    }

    let record = store.get_record(skill)
        .ok_or_else(|| anyhow::anyhow!("Skill record not found"))?;

    let skill_path = store.skill_path(skill);
    let skill_md_path = skill_path.join("SKILL.md");

    println!("{}", "═".repeat(50).dimmed());
    println!("{} {}", "📦".cyan(), skill.bold());
    println!("{}", "═".repeat(50).dimmed());
    println!();

    // Basic info
    println!("{}", "Details:".bold());
    println!("  Version: {}", record.version.version);
    println!("  Content Hash: {}", record.version.content_hash);
    println!("  Installed: {}", record.installed_at);
    println!("  Source: {}", record.source.display());
    println!("  Local Path: {}", skill_path.display());
    println!(
        "  Security Scan: {}",
        if record.scan_passed {
            "Passed".green()
        } else {
            "Failed".red()
        }
    );
    println!();

    // Projected tools
    if !record.projected_tools.is_empty() {
        println!("{}", "Synced to:".bold());
        for tool in &record.projected_tools {
            println!("  {} {}", "•".cyan(), tool);
        }
        println!();
    }

    // SKILL.md content preview
    if skill_md_path.exists() {
        println!("{}", "SKILL.md Preview:".bold());
        println!("{}", "─".repeat(50).dimmed());
        
        let content = fs::read_to_string(&skill_md_path)?;
        let lines: Vec<&str> = content.lines().take(20).collect();
        
        for line in &lines {
            println!("{}", line);
        }
        
        if content.lines().count() > 20 {
            println!();
            println!("{}", format!("... ({} more lines)", content.lines().count() - 20).dimmed());
        }
        println!("{}", "─".repeat(50).dimmed());
    }

    Ok(())
}
