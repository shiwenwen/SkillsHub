//! List command - list installed skills

use colored::Colorize;

use skillshub_core::store::LocalStore;

pub async fn run(detailed: bool) -> anyhow::Result<()> {
    println!("{} Installed Skills:", "📦".cyan());
    println!();

    let store = LocalStore::default_store()?;
    let installed = store.list_installed();

    if installed.is_empty() {
        println!("{}", "No skills installed.".dimmed());
        println!();
        println!(
            "{}",
            "Install skills with: skillshub install <skill>".dimmed()
        );
        return Ok(());
    }

    for record in &installed {
        if detailed {
            println!("  {}", record.skill_id.bold());
            println!("    Version: {}", record.version.version);
            println!("    Hash: {}", &record.version.content_hash[..16]);
            println!("    Installed: {}", record.installed_at);
            println!("    Source: {}", record.source.display().dimmed());
            if !record.projected_tools.is_empty() {
                println!("    Tools: {}", record.projected_tools.join(", "));
            }
            println!(
                "    Scan: {}",
                if record.scan_passed {
                    "✓ Passed".green()
                } else {
                    "✗ Failed".red()
                }
            );
            println!();
        } else {
            println!(
                "  {} {} {}",
                "•".cyan(),
                record.skill_id.bold(),
                format!("v{}", record.version.version).dimmed()
            );
        }
    }

    println!();
    println!("{} {} skills installed", "📊".cyan(), installed.len());

    Ok(())
}
