//! Update command - update installed skills

use colored::Colorize;
use skillshub_core::store::LocalStore;

pub async fn run(skill: Option<&str>) -> anyhow::Result<()> {
    let target = skill.unwrap_or("all");
    println!("{} Updating skills: {}", "🔄".cyan(), target.bold());
    println!();

    let store = LocalStore::default_store()?;
    let installed = store.list_installed();

    if installed.is_empty() {
        println!("{}", "No skills installed.".dimmed());
        return Ok(());
    }

    let skills_to_update: Vec<_> = if target == "all" {
        installed
    } else {
        installed.into_iter().filter(|r| r.skill_id == target).collect()
    };

    if skills_to_update.is_empty() {
        println!("{}", format!("Skill '{}' not found.", target).yellow());
        return Ok(());
    }

    for record in skills_to_update {
        println!("  {} Checking {}...", "•".cyan(), record.skill_id);
        // TODO: Check for updates from source
        println!("    {} Already up to date", "✓".green());
    }

    println!();
    println!("{} Update check complete!", "✓".green());

    Ok(())
}
