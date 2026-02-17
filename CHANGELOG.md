# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Per-tool Sync Strategy**: Each tool can now have its own sync strategy (Auto/Link/Copy) that overrides the global default, configurable in Settings > Tool Configuration

### Changed

- **OpenClaw Adapter**: Removed node_modules installation path from skills scanning and syncing directories, now only scans workspace directory (`~/.openclaw/workspace/skills/`)
- **Settings Page Refactor**: Split the monolithic Settings page (~1490 lines) into 8 focused sub-components for improved maintainability (`types.ts`, `GeneralTab`, `ToolsTab`, `CloudSyncTab`, `SecurityTab`, `AboutTab`, `AddToolModal`, `AddRegistryModal`)
- **i18n Full Coverage**: Replaced 40+ hardcoded UI strings across 7 pages/components with proper translation keys; added translations for all 9 supported languages (zh, en, ja, ko, fr, de, es, pt, ru). Extended coverage to SecurityTab, CloudSyncTab, AddRegistryModal, Discover, Installed, SkillDetail, and SyncDashboard with additional keys for descriptions, error messages, and modal labels

### Fixed

- **Plugin Content Hash**: Plugin skills now correctly calculate `content_hash` using directory hashing instead of leaving it empty, enabling proper update detection for plugin-sourced skills
- **Git Registry Source URL**: Git registry search results now carry the correct repository URL and branch directly from the scanning closure, eliminating a redundant post-processing fixup step
- **Update Source Registry Tracking**: Update checker now reports which registry a skill update was found in via `get_skill_with_source`, improving update transparency

## [1.0.2] - 2026-02-16

### Changed

- **Release**: Bumped project version to `1.0.2`

## [1.0.1] - 2026-02-15

### Added

- **CI/CD**: GitHub Actions workflow for cross-platform build and auto-publish to GitHub Releases
  - Supports macOS (ARM64 + x64), Windows (x64), Linux (x64)
  - Tag-triggered release (`v*` format)
  - Uses `tauri-apps/tauri-action` for Tauri build and artifact upload

### Fixed

- **CI/CD**: Fixed GitHub Actions release workflow runner/action configuration
  - Replaced unsupported runner label `macos-13-us-default` usage with supported `macos-14` (ARM64 lane)
  - Replaced unavailable `dtolnay/rust-action/setup` action with `dtolnay/rust-toolchain@stable`

## [1.0.0] - 2025-02-09

### Added

- **Desktop Application (Tauri)**
  - Full-featured desktop GUI built with React 18, TypeScript, Tailwind CSS, and DaisyUI
  - Six core pages: Installed Skills, Discover, Skill Detail, Sync Dashboard, Security Center, Settings
  - Installed page with card grid layout, search filtering, and three tabs (Hub, Scanned, Claude Plugins)
  - Discover page with multi-registry search, infinite scroll, and one-click install
  - Skill detail modal with SKILL.md preview, resource file listing, per-tool sync status, and batch sync
  - Sync Dashboard with drift detection, one-click repair, and per-tool sync controls
  - Security Center with full scan, risk-level policy configuration, and trusted source management
  - Settings page with tool detection, registry management, cloud sync configuration, custom tool management, storage info display, and redesigned About tab
  - Native directory selection via `tauri-plugin-dialog`
  - System directory opening via `tauri-plugin-shell`

- **Theme System**
  - Three modes: Auto (follows system preference), Light, Dark
  - `ThemeProvider` context with `localStorage` persistence
  - DaisyUI dual themes (`skillshub-light` / `skillshub-dark`)
  - Real-time system `prefers-color-scheme` change detection in Auto mode
  - Glass effects (glass-card / glass-panel) adapted for both themes
  - Theme switcher in navbar dropdown and Settings page

- **Internationalization (i18n)**
  - 9 languages: English, 中文, 日本語, 한국어, Français, Deutsch, Español, Português, Русский
  - Custom React Context-based i18n system with `useTranslation()` and `useLanguage()` hooks
  - Browser language auto-detection with `localStorage` persistence
  - 300+ translation keys covering all pages and features

- **CLI Tool (`skillshub-cli`)**
  - `skillshub tools detect` — detect installed AI coding tools
  - `skillshub discover <query>` — search Skills from registries
  - `skillshub install <skill>` — install Skills from local directory, Git/HTTP repository, or registry
  - `skillshub update <skill>` — update Skills with real content-hash change detection
  - `skillshub sync` — sync Skills to all detected tools
  - `skillshub list` — list installed Skills
  - `skillshub scan <skill>` — security scan a Skill
  - `skillshub registry add/remove/list` — manage registries (Git, HTTP, ClawHub)

- **Core Library (`skillshub-core`)**
  - **19 Built-in Tool Adapters**: Amp, Antigravity, Claude Code, CodeBuddy, Codex, Cursor, Droid/Factory, Gemini CLI, GitHub Copilot, Goose, Kilo Code, Kimi CLI, OpenClaw, OpenCode, Qwen Code, Roo Code, Trae, Windsurf, plus Custom Tools
  - **Sync Engine**: Hub-centric architecture with `collect_to_hub()` and `distribute_from_hub()`, supporting Link (symlink) and Copy strategies
  - **Security Scanner**: 8 rules (CMD001, CMD002, NET001, CRED001, EVAL001, PATH001, FILE001, FILE002) covering destructive commands, privilege escalation, data exfiltration, credential access, dynamic code execution, system path access, binary executables, and shell scripts
  - **Registry System**: Multi-registry support (Git, HTTP/Curated, ClawHub) with aggregated search
  - **Local Store**: Central Skills storage with metadata and hash tracking
  - **Plugin System**: Claude plugin scanning, marketplace listing, and plugin-to-skill sync
  - **Cloud Sync**: iCloud Drive, Google Drive, OneDrive integration with auto-detection, push/pull/full sync, and custom folder configuration
  - **Drift Detection**: Automatic sync inconsistency detection with one-click repair
  - **Update Checker**: Local content-hash comparison for installed Skills
  - **Custom Tools**: User-defined AI coding tools with configurable global/project paths
  - **Configuration Management**: Persistent `AppConfig` with Tauri backend as single source of truth

- **Tauri Backend** (60+ commands)
  - Skills: `list_installed_skills`, `get_skill_info`, `get_skill_detail`, `install_skill`, `uninstall_skill`, `update_skill`, `check_skill_updates`
  - Sync: `sync_skills`, `sync_single_skill`, `toggle_skill_tool_sync`, `check_drift`, `full_sync_skills`
  - Security: `scan_skill`, `scan_all_skills`, `list_security_rules`, `get_security_scan_records`, `save_security_scan_records`
  - Tools: `list_tools`, `detect_tools`, `list_custom_tools`, `add_custom_tool`, `update_custom_tool`, `remove_custom_tool`
  - Registry: `search_skills`, `list_registries`, `add_registry`, `remove_registry`
  - Plugins: `scan_claude_plugins`, `list_claude_marketplaces`, `sync_plugin_skill`
  - Cloud Sync: `detect_cloud_drives`, `cloud_sync_push`, `cloud_sync_pull`, `cloud_sync_full`
  - Config: `get_app_config`, `save_app_config`, `get_store_info`
  - Utility: `open_directory`

- **Skills Install & Update Workflow**
  - Install from local directory, Git/HTTP repository, or registry with auto-sync to all tools
  - Pre-install/pre-update security scanning with configurable risk-level policies
  - High-risk Skill blocking (configurable)
  - Content-hash based update detection

- **Registry Management**
  - Default registries: anthropics, obra, ComposioHQ, vercel-labs
  - Add/remove/enable/disable registries from Settings UI
  - Git and HTTP/Curated registry providers
  - ClawHub registry integration

- **OpenClaw Tool Support**
  - OpenClaw adapter with dynamic NPM global install path detection
  - Multi-path scanning: workspace directory (`~/.openclaw/workspace/skills/`) and NPM install directory
  - Custom global path configuration
  - Project-level Skills directory (`.openclaw/skills/`)

- **Security & Trust**
  - Scan policies: block high-risk, confirm medium-risk, auto-pass low-risk (persistent)
  - Trusted source management with one-click add from configured registries
  - Scan records persistence via Tauri backend
  - Security rules sourced from backend (no frontend hardcoding)

- **Settings Enhancements**
  - Dynamic tool detection status with real-time path updates
  - Storage location, usage, and Skills count from backend `get_store_info`
  - Open storage directory button
  - Save validation: cloud provider selection, empty sync directory, invalid path characters, relative project path enforcement
  - Single "Save Settings" button replacing auto-save behavior
  - About tab redesigned with dark gradient card style, author/open-source info cards, tech stack tags, and update button

### Changed

- Installed page layout: table → card grid (no horizontal scroll, auto-wrap, action buttons at card bottom)
- Sync mechanism refactored: SkillsHub as central hub with bidirectional sync
- Settings page configuration: unified Tauri backend as single data source (removed `localStorage` dependency for security/install/update configs)
- Discover page: removed non-functional trending tag filters and hardcoded featured Skills section

### Fixed

- Dark mode navbar displaying in dark color during light mode (removed hardcoded `data-theme` in `index.html`, replaced with inline script for flash-free theme loading)
- Backfilled missing `installed` group fields in `de/es/fr/ja/ko/pt/ru` locale files, fixing `Translations` type mismatch causing `tsc` build failure
- CLI `install` command: real installation flow for local directory, local registry, and Git/HTTP sources
- CLI `update` command: real content-hash change detection instead of always reporting "up to date"
- CLI registry: HTTP/Curated type now uses `HttpRegistry` provider instead of returning empty
- `parse_skill_md`: replaced placeholder YAML parsing with working front-matter parser
- Security page: real backend scan integration replacing frontend mock data
- Skill detail page: sync/uninstall buttons connected to backend, dynamic tool list, real scan results
- Settings page: tool status from `detect_tools`, registry management with real data, storage info from backend
- Chinese translation: "Skills" kept as proper noun (not translated to "技能")
- Default sync strategy setting now properly applied in sync engine
- Cloud sync config save timing issue (config persisted before sync execution)
- Cloud sync path tilde (`~`) expansion to user home directory
- Save button validation preventing invalid configurations

## [0.1.0] - 2025-01-29

### Added

- Initial SkillsHub project repository
- Claude plugin management: scanning, marketplace listing, and plugin skill sync
- Project documentation
