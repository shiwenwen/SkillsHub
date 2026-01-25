//! Uninstall command - remove a skill

use colored::Colorize;
use dialoguer::Confirm;

use skillshub_core::adapters::create_default_adapters;
use skillshub_core::models::ToolType;
use skillshub_core::store::LocalStore;
use skillshub_core::sync::SyncEngine;

pub async fn run(skill: &str, tools: Option<&str>) -> anyhow::Result<()> {
    println!("{} Uninstalling skill: {}", "🗑️".red(), skill.bold());
    println!();

    // Parse target tools
    let target_tools: Option<Vec<ToolType>> = tools.map(|tools_str| {
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
    });

    let store = LocalStore::default_store()?;
    
    if !store.is_installed(skill) {
        println!("{}", format!("Skill '{}' is not installed.", skill).yellow());
        return Ok(());
    }

    // Confirm uninstall
    let confirm_msg = if target_tools.is_some() {
        format!("Remove '{}' from selected tools?", skill)
    } else {
        format!("Completely uninstall '{}'?", skill)
    };

    if !Confirm::new().with_prompt(confirm_msg).interact()? {
        println!("{}", "Cancelled.".dimmed());
        return Ok(());
    }

    let mut engine = SyncEngine::new(store);
    for adapter in create_default_adapters() {
        engine.register_adapter(adapter);
    }

    if let Some(tools) = target_tools {
        // Remove from specific tools only
        for tool in tools {
            match engine.unsync_skill(skill, tool) {
                Ok(_) => println!("  {} Removed from {}", "✓".green(), tool.display_name()),
                Err(e) => println!("  {} Failed for {}: {}", "✗".red(), tool.display_name(), e),
            }
        }
    } else {
        // Complete uninstall
        let all_tools = vec![
            ToolType::Claude,
            ToolType::Cursor,
            ToolType::Gemini,
            ToolType::OpenCode,
        ];

        for tool in all_tools {
            let _ = engine.unsync_skill(skill, tool);
        }

        engine.store_mut().remove_skill(skill)?;
        println!("  {} Removed from local store", "✓".green());
    }

    println!();
    println!("{} Skill uninstalled successfully!", "✓".green());

    Ok(())
}
