# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed
- 移除发现页面中无实际作用的热门标签过滤器（未连接到后端搜索逻辑）
- 移除发现页面中无实际作用的精选 Skills 区块（硬编码且无交互功能）

### Fixed
- 修复中文翻译中 "Skills" 被错误翻译为 "技能" 的问题，Skills 作为专有名词保持不变
- 修复设置页面注册源管理仅显示硬编码假数据的问题，现已连接后端真实数据

### Added
- 实现完整的注册源管理功能：
  - 从后端加载真实注册源列表（默认包含 anthropics、obra、ComposioHQ、vercel-labs）
  - 支持启用/禁用注册源切换
  - 支持添加新的 Git 注册源
  - 支持删除注册源
  - 显示注册源的名称、URL、描述和标签

### Added
- 新增 7 种语言支持：日本語 (ja)、한국어 (ko)、Français (fr)、Deutsch (de)、Español (es)、Português (pt)、Русский (ru)
- 浏览器语言自动检测支持所有 9 种语言
- 新增自定义工具功能：可在设置页面添加自定义 AI 编码工具，支持目录选择和配置持久化
  - `list_custom_tools`: 获取所有自定义工具
  - `add_custom_tool`: 添加新的自定义工具
  - `remove_custom_tool`: 删除自定义工具
- 同步面板支持添加自定义工具：工具卡片区域添加"添加自定义工具"入口
- 集成 `tauri-plugin-dialog` 实现原生目录选择对话框

### Changed
- 更新 README 与技术文档，补充最新特性与支持工具说明
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
