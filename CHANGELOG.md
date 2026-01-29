# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- 重构同步机制：SkillsHub 作为中央仓库，支持双向同步
  - `scan_all_skills`: 扫描所有工具目录中的 skills
  - `full_sync_skills`: 完整同步（收集 + 分发）
  - `get_hub_status`: 获取 Hub 状态

### Added
- 新增 `ScannedSkill` 和 `HubSyncStatus` 数据模型
- 新增 `SyncEngine::collect_to_hub()`: 从各工具收集 skills 到 Hub
- 新增 `SyncEngine::distribute_from_hub()`: 从 Hub 分发 skills 到所有工具
- 重新设计 Installed 页面，新增三个标签页：Hub 仓库、已扫描、Claude Plugins

## [0.1.0] - 2025-01-29

### Added

- 初始化 SkillsHub 项目仓库
- 新增 Claude 插件管理功能，包括扫描、列出市场和同步插件技能
- 项目文档
