//! SkillsHub CLI - Command line interface for Agent Skills management

mod commands;

use clap::{Parser, Subcommand};
use colored::Colorize;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use commands::*;

/// SkillsHub - Unified Agent Skills Management Platform
#[derive(Parser)]
#[command(name = "skillshub")]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
struct Cli {
    /// Enable verbose output
    #[arg(short, long, global = true)]
    verbose: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Discover skills from registries
    Discover {
        /// Search query
        query: Option<String>,
        /// Filter by tags
        #[arg(short, long)]
        tags: Vec<String>,
        /// Limit results
        #[arg(short, long, default_value = "20")]
        limit: usize,
    },

    /// Install a skill
    Install {
        /// Skill ID or source URL
        skill: String,
        /// Target tools (comma-separated)
        #[arg(short, long)]
        tools: Option<String>,
        /// Sync strategy (auto/link/copy)
        #[arg(short, long, default_value = "auto")]
        sync: String,
        /// Skip security scan
        #[arg(long)]
        skip_scan: bool,
    },

    /// Update installed skills
    Update {
        /// Specific skill to update (or 'all')
        skill: Option<String>,
    },

    /// Uninstall a skill
    Uninstall {
        /// Skill ID to uninstall
        skill: String,
        /// Only remove from specific tools
        #[arg(short, long)]
        tools: Option<String>,
    },

    /// Sync skills to tools
    Sync {
        /// Specific skill to sync
        skill: Option<String>,
        /// Target tools
        #[arg(short, long)]
        tools: Option<String>,
        /// Check and repair drift
        #[arg(long)]
        reconcile: bool,
    },

    /// Scan a skill for security issues
    Scan {
        /// Skill ID or path to scan
        target: String,
        /// Scan policy (default/strict)
        #[arg(short, long, default_value = "default")]
        policy: String,
    },

    /// List and manage tools
    Tools {
        #[command(subcommand)]
        action: ToolsAction,
    },

    /// Manage registries
    Registry {
        #[command(subcommand)]
        action: RegistryAction,
    },

    /// List installed skills
    List {
        /// Show detailed information
        #[arg(short, long)]
        detailed: bool,
    },

    /// Show skill details
    Info {
        /// Skill ID
        skill: String,
    },
}

#[derive(Subcommand)]
enum ToolsAction {
    /// List all known tools
    List,
    /// Detect installed tools
    Detect,
    /// Show tool status
    Status,
}

#[derive(Subcommand)]
enum RegistryAction {
    /// List configured registries
    List,
    /// Add a registry
    Add {
        /// Registry name
        name: String,
        /// Registry URL or path
        url: String,
    },
    /// Remove a registry
    Remove {
        /// Registry name
        name: String,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    // Setup logging
    let log_level = if cli.verbose { "debug" } else { "info" };
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::new(log_level))
        .init();

    // Print banner
    println!("{}", "╔═══════════════════════════════════════════╗".cyan());
    println!(
        "{}",
        "║      SkillsHub - Agent Skills Manager      ║".cyan()
    );
    println!("{}", "╚═══════════════════════════════════════════╝".cyan());
    println!();

    // Execute command
    match cli.command {
        Commands::Discover { query, tags, limit } => {
            discover::run(query, tags, limit).await?;
        }
        Commands::Install {
            skill,
            tools,
            sync,
            skip_scan,
        } => {
            install::run(&skill, tools.as_deref(), &sync, skip_scan).await?;
        }
        Commands::Update { skill } => {
            update::run(skill.as_deref()).await?;
        }
        Commands::Uninstall { skill, tools } => {
            uninstall::run(&skill, tools.as_deref()).await?;
        }
        Commands::Sync {
            skill,
            tools,
            reconcile,
        } => {
            sync::run(skill.as_deref(), tools.as_deref(), reconcile).await?;
        }
        Commands::Scan { target, policy } => {
            scan::run(&target, &policy).await?;
        }
        Commands::Tools { action } => match action {
            ToolsAction::List => tools::list().await?,
            ToolsAction::Detect => tools::detect().await?,
            ToolsAction::Status => tools::status().await?,
        },
        Commands::Registry { action } => match action {
            RegistryAction::List => registry::list().await?,
            RegistryAction::Add { name, url } => registry::add(&name, &url).await?,
            RegistryAction::Remove { name } => registry::remove(&name).await?,
        },
        Commands::List { detailed } => {
            list::run(detailed).await?;
        }
        Commands::Info { skill } => {
            info::run(&skill).await?;
        }
    }

    Ok(())
}
