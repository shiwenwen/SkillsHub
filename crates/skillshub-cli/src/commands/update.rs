//! Update command - update installed skills

use colored::Colorize;
use skillshub_core::models::SkillSource;
use skillshub_core::registry::calculate_dir_hash;
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
        installed
            .into_iter()
            .filter(|r| r.skill_id == target)
            .collect()
    };

    if skills_to_update.is_empty() {
        println!("{}", format!("Skill '{}' not found.", target).yellow());
        return Ok(());
    }

    for record in skills_to_update {
        println!("  {} Checking {}...", "•".cyan(), record.skill_id);

        match &record.source {
            SkillSource::Local { path } => {
                if !path.exists() {
                    println!("    {} Source path missing", "!".yellow());
                    continue;
                }

                let current_hash = calculate_dir_hash(&path.to_path_buf())?;
                if current_hash != record.version.content_hash
                    && !record.version.content_hash.is_empty()
                {
                    println!(
                        "    {} Source has changed, run reinstall to apply updates",
                        "↑".yellow()
                    );
                } else {
                    println!("    {} Already up to date", "✓".green());
                }
            }
            SkillSource::Git { .. } | SkillSource::Registry { .. } | SkillSource::Http { .. } => {
                println!(
                    "    {} Remote update check is not available yet, skip",
                    "!".yellow()
                );
            }
        }
    }

    println!();
    println!("{} Update check complete!", "✓".green());

    Ok(())
}
