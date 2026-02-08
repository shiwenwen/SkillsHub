//! Install command - install a skill

use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use std::path::PathBuf;

use skillshub_core::adapters::create_default_adapters;
use skillshub_core::models::{SkillSource, SyncStrategy, ToolType};
use skillshub_core::registry::{GitRegistry, LocalRegistry, RegistryProvider};
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

    let strategy = match sync_strategy {
        "link" => SyncStrategy::Link,
        "copy" => SyncStrategy::Copy,
        _ => SyncStrategy::Auto,
    };

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

    let pb = ProgressBar::new(100);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{bar:40.cyan/blue}] {pos}% {msg}")
            .unwrap()
            .progress_chars("█▓░"),
    );

    pb.set_message("Resolving skill source...");
    pb.set_position(10);

    let mut store = LocalStore::default_store()?;

    // Resolve/install source into local store and return installed skill_id.
    let skill_id = if skill.starts_with("http://")
        || skill.starts_with("https://")
        || skill.starts_with("git@")
        || skill.ends_with(".git")
    {
        let registry = GitRegistry::new("remote", skill, None);
        let remote_skill_id = skill
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or("skill")
            .trim_end_matches(".git")
            .to_string();

        let meta = registry.get_skill(&remote_skill_id).await?;
        let temp_dir = std::env::temp_dir().join(format!("skillshub-install-{}", remote_skill_id));
        let source_path = registry.fetch(&remote_skill_id, &temp_dir).await?;

        store.import_skill(&meta, &source_path).await?;
        meta.id
    } else if PathBuf::from(skill).exists() {
        let source_path = PathBuf::from(skill);
        let skill_id = source_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("local-skill")
            .to_string();

        let pseudo_skill = skillshub_core::models::Skill {
            id: skill_id.clone(),
            name: skill_id.clone(),
            description: String::new(),
            author: None,
            tags: Vec::new(),
            compatible_tools: Vec::new(),
            version: skillshub_core::models::SkillVersion::new("0.0.0", String::new()),
            source: SkillSource::Local {
                path: source_path.clone(),
            },
            skill_md_path: source_path.join("SKILL.md"),
            resources: Vec::new(),
            metadata: std::collections::HashMap::new(),
        };

        store.import_skill(&pseudo_skill, &source_path).await?;
        skill_id
    } else {
        let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("Cannot find home directory"))?;
        let local_registry = home.join(".skillshub").join("local-registry");
        let registry = LocalRegistry::new("local", local_registry);
        let meta = registry.get_skill(skill).await?;
        let source_path = registry.fetch(skill, PathBuf::new().as_path()).await?;
        store.import_skill(&meta, &source_path).await?;
        meta.id
    };

    pb.set_position(30);
    if !skip_scan {
        pb.set_message("Running security scan...");
        let scanner = SecurityScanner::new();
        let report = scanner.scan(&skill_id, &store.skill_path(&skill_id))?;

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
    }

    pb.set_position(70);
    pb.set_message("Syncing to tools...");

    let mut engine = SyncEngine::new(store);
    for adapter in create_default_adapters() {
        engine.register_adapter(adapter);
    }

    let available_tools = engine.detect_tools();
    let tools_to_sync: Vec<ToolType> = target_tools
        .into_iter()
        .filter(|t| {
            available_tools
                .iter()
                .any(|p| p.tool_type == *t && p.detected)
        })
        .collect();

    pb.set_position(90);
    for tool in &tools_to_sync {
        pb.set_message(format!("Syncing to {}...", tool.display_name()));
        match engine.sync_skill(&skill_id, *tool, strategy) {
            Ok(_) => {
                println!("  {} Synced to {}", "✓".green(), tool.display_name());
            }
            Err(e) => {
                println!(
                    "  {} Failed to sync to {}: {}",
                    "✗".red(),
                    tool.display_name(),
                    e
                );
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
