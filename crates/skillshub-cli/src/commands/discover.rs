//! Discover command - search for skills

use colored::Colorize;
use skillshub_core::registry::{AggregatedRegistry, LocalRegistry, SkillQuery};

pub async fn run(query: Option<String>, tags: Vec<String>, limit: usize) -> anyhow::Result<()> {
    println!("{}", "🔍 Searching for skills...".yellow());
    println!();

    let mut registry = AggregatedRegistry::new();
    
    // Add default registries
    if let Some(home) = dirs::home_dir() {
        let local_skills = home.join(".skillshub").join("local-registry");
        if local_skills.exists() {
            registry.add_registry(Box::new(LocalRegistry::new("local", local_skills)));
        }
    }

    let skill_query = SkillQuery {
        query,
        tags,
        limit: Some(limit),
        ..Default::default()
    };

    let results = registry.search(&skill_query).await?;

    if results.is_empty() {
        println!("{}", "No skills found matching your query.".dimmed());
        return Ok(());
    }

    println!("{} {} found:\n", "📦".green(), format!("{} skills", results.len()).bold());

    for skill in results.iter().take(limit) {
        println!(
            "  {} {} {}",
            "•".cyan(),
            skill.name.bold(),
            format!("({})", skill.id).dimmed()
        );
        if !skill.description.is_empty() {
            println!("    {}", skill.description.dimmed());
        }
        if !skill.tags.is_empty() {
            println!("    Tags: {}", skill.tags.join(", ").cyan());
        }
        println!();
    }

    Ok(())
}
