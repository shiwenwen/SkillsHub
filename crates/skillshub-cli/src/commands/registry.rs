//! Registry command - manage skill registries

use colored::Colorize;
use skillshub_core::registry::{RegistryConfig, RegistryManager, RegistryType};

pub async fn list() -> anyhow::Result<()> {
    println!("{} Configured Registries:", "📦".cyan());
    println!();

    let manager = RegistryManager::new().map_err(|e| anyhow::anyhow!(e.to_string()))?;
    let configs = manager.list();

    if configs.is_empty() {
        println!("{}", "No registries configured.".dimmed());
        println!();
        println!(
            "{}",
            "Add one with: skillshub registry add <name> <url>".dimmed()
        );
        return Ok(());
    }

    for reg in &configs {
        let status = if reg.enabled {
            "●".green()
        } else {
            "○".dimmed()
        };
        let type_str = format!("{:?}", reg.registry_type).to_lowercase();
        println!(
            "  {} {} ({}) - {}",
            status,
            reg.name.bold(),
            type_str.blue(),
            reg.url.dimmed()
        );
        if let Some(desc) = &reg.description {
            println!("      {}", desc.italic().dimmed());
        }
    }

    println!();
    println!("{} {} registries configured", "📊".cyan(), configs.len());

    Ok(())
}

pub async fn add(name: &str, url: &str) -> anyhow::Result<()> {
    println!("{} Adding registry: {}", "➕".green(), name.bold());

    let mut manager = RegistryManager::new().map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let config = RegistryConfig {
        name: name.to_string(),
        url: url.to_string(),
        branch: None, // CLI add doesn't support branch yet, maybe add --branch flag later
        description: None,
        enabled: true,
        registry_type: RegistryType::Git, // Default to Git for now as per requirement
        tags: Vec::new(),
    };

    manager
        .add(config)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    println!("{} Registry '{}' added successfully!", "✓".green(), name);

    Ok(())
}

pub async fn remove(name: &str) -> anyhow::Result<()> {
    println!("{} Removing registry: {}", "➖".red(), name.bold());

    let mut manager = RegistryManager::new().map_err(|e| anyhow::anyhow!(e.to_string()))?;
    manager
        .remove(name)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    println!("{} Registry '{}' removed successfully!", "✓".green(), name);

    Ok(())
}
