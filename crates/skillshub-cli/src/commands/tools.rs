//! Tools command - manage Agent tools

use colored::Colorize;

use skillshub_core::adapters::create_default_adapters;
use skillshub_core::models::ToolType;

pub async fn list() -> anyhow::Result<()> {
    println!("{} Known Agent Tools:", "🔧".cyan());
    println!();

    let tools = [
        (ToolType::Claude, "Claude Code", "~/.claude/skills"),
        (ToolType::Cline, "Cline", "~/.cline/skills"),
        (ToolType::Cursor, "Cursor IDE", "~/.cursor/skills"),
        (ToolType::Gemini, "Gemini CLI", "~/.gemini/skills"),
        (ToolType::Kiro, "Kiro", "~/.kiro/skills"),
        (ToolType::OpenCode, "OpenCode", "~/.opencode/skills"),
        (ToolType::Codex, "Codex CLI", "~/.codex/skills"),
    ];

    for (_, name, path) in tools {
        println!("  {} {} - {}", "•".cyan(), name.bold(), path.dimmed());
    }

    println!();
    println!(
        "{}",
        "Run 'skillshub tools detect' to check which are installed.".dimmed()
    );

    Ok(())
}

pub async fn detect() -> anyhow::Result<()> {
    println!("{} Detecting installed tools...", "🔍".cyan());
    println!();

    let adapters = create_default_adapters();
    let mut found = 0;

    for adapter in &adapters {
        let detected = adapter.detect();
        let status = if detected {
            found += 1;
            "✓ Installed".green()
        } else {
            "✗ Not found".dimmed()
        };

        let skills_dir = adapter
            .skills_dir()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| "N/A".to_string());

        println!(
            "  {} {} {}",
            status,
            adapter.tool_type().display_name().bold(),
            format!("({})", skills_dir).dimmed()
        );
    }

    println!();
    println!("{} Found {} tools", "📊".cyan(), found);

    Ok(())
}

pub async fn status() -> anyhow::Result<()> {
    println!("{} Tool Status:", "📊".cyan());
    println!();

    let adapters = create_default_adapters();

    for adapter in &adapters {
        if !adapter.detect() {
            continue;
        }

        let tool_type = adapter.tool_type();
        let tool_name = tool_type.display_name();
        let skills_dir = adapter.skills_dir()?;

        // Count skills in directory
        let skill_count = if skills_dir.exists() {
            std::fs::read_dir(&skills_dir)?
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .count()
        } else {
            0
        };

        println!("  {}", tool_name.bold());
        println!("    Skills directory: {}", skills_dir.display());
        println!("    Skills installed: {}", skill_count);
        println!(
            "    Symlinks supported: {}",
            if adapter.supports_symlinks() {
                "Yes".green()
            } else {
                "No".yellow()
            }
        );
        println!();
    }

    Ok(())
}
