//! Sync command - synchronize skills to tools

use colored::Colorize;

use skillshub_core::adapters::create_default_adapters;
use skillshub_core::models::{SyncStrategy, ToolType};
use skillshub_core::store::LocalStore;
use skillshub_core::sync::SyncEngine;

pub async fn run(skill: Option<&str>, tools: Option<&str>, reconcile: bool) -> anyhow::Result<()> {
    println!("{} Syncing skills...", "🔄".cyan());
    println!();

    let store = LocalStore::default_store()?;
    let mut engine = SyncEngine::new(store);

    for adapter in create_default_adapters() {
        engine.register_adapter(adapter);
    }

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
        vec![
            ToolType::Claude,
            ToolType::Cursor,
            ToolType::Gemini,
            ToolType::OpenCode,
        ]
    };

    if reconcile {
        println!("{}", "Checking for drift...".dimmed());
        let drifts = engine.check_drift();

        if drifts.is_empty() {
            println!("  {} No drift detected", "✓".green());
        } else {
            println!("  {} Found {} drift issues:", "⚠️".yellow(), drifts.len());
            for (skill_id, tool, drift) in &drifts {
                println!(
                    "    {} {} in {}: {}",
                    "•".yellow(),
                    skill_id,
                    tool.display_name(),
                    drift.drift_type
                );
            }
            println!();
            println!("{}", "Repairing drifts...".dimmed());

            for (skill_id, tool, _) in drifts {
                match engine.sync_skill(&skill_id, tool, SyncStrategy::Auto) {
                    Ok(_) => println!(
                        "  {} Repaired {} in {}",
                        "✓".green(),
                        skill_id,
                        tool.display_name()
                    ),
                    Err(e) => println!("  {} Failed {}: {}", "✗".red(), skill_id, e),
                }
            }
        }
    }

    // Get skills to sync
    let installed: Vec<_> = engine
        .store()
        .list_installed()
        .into_iter()
        .cloned()
        .collect();
    let skills_to_sync = if let Some(skill_id) = skill {
        installed
            .into_iter()
            .filter(|r| r.skill_id == skill_id)
            .collect()
    } else {
        installed
    };

    if skills_to_sync.is_empty() {
        println!("{}", "No skills to sync.".dimmed());
        return Ok(());
    }

    println!();
    println!(
        "{} Syncing {} skills to {} tools...",
        "📦".green(),
        skills_to_sync.len(),
        target_tools.len()
    );

    for record in skills_to_sync {
        for tool in &target_tools {
            match engine.sync_skill(&record.skill_id, *tool, SyncStrategy::Auto) {
                Ok(_) => {
                    println!(
                        "  {} {} → {}",
                        "✓".green(),
                        record.skill_id,
                        tool.display_name()
                    );
                }
                Err(e) => {
                    println!(
                        "  {} {} → {} ({})",
                        "✗".red(),
                        record.skill_id,
                        tool.display_name(),
                        e
                    );
                }
            }
        }
    }

    println!();
    println!("{} Sync complete!", "✓".green());

    Ok(())
}
