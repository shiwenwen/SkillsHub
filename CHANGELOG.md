# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 云端同步功能（iCloud Drive / Google Drive / OneDrive）：
  - 新增 `CloudSyncProvider` 和 `CloudSyncConfig` 配置模型
  - 新增 `cloud_sync` 核心模块，支持自动检测系统已安装的云存储驱动器
  - 支持将本地 Skills 推送到云端、从云端拉取 Skills、双向同步
  - 设置页面新增"云端同步"配置卡片：启用/禁用、选择提供商、配置同步文件夹、自动同步开关
  - 新增 Tauri 命令：`detect_cloud_drives`、`cloud_sync_push`、`cloud_sync_pull`、`cloud_sync_full`
  - 支持自定义文件夹路径作为同步目标
  - 全部 9 种语言国际化翻译适配
- 新增内置工具 OpenClaw 支持：
  - 添加 OpenClaw 适配器，支持动态检测 OpenClaw 安装路径（NPM 全局安装）
  - 用户可通过设置页面配置自定义 OpenClaw 全局路径
  - 支持项目级 Skills 目录 (`.openclaw/skills/`)
  - **新增多路径扫描支持**：同时扫描工作空间目录 (`~/.openclaw/workspace/skills/`) 和 NPM 安装目录 (如 `~/.nvm/.../node_modules/openclaw/skills/`)
- Skills 更新检查功能：
  - 新增 `check_skill_updates` 后端命令，对比本地与远程版本
  - 改进 `update_skill` 命令，支持从注册源获取并更新 skill
  - 新增 `useUpdateCheck` React Hook，管理更新检查状态
  - 已安装页面新增"检查更新"按钮和更新提示横幅
  - 设置页面"启动时检查更新"开关现已可用且持久化
- Skills 安装功能：
  - 改进 `install_skill` 后端命令，从注册源获取并安装 skill
  - 发现页面安装按钮现已可用，支持一键安装
  - 安装时自动同步：安装完成后根据设置自动同步到所有工具
  - 设置页面"安装时自动同步"开关现已可用且持久化
- 安全扫描设置：
  - 设置页面"安装前扫描"开关现已可用且持久化
  - 设置页面"更新前扫描"开关现已可用且持久化
  - 设置页面"阻止高风险"开关现已可用且持久化
  - 安装和更新流程集成安全检查，高风险 Skills 可被自动阻止

### Removed
- 移除发现页面中无实际作用的热门标签过滤器（未连接到后端搜索逻辑）
- 移除发现页面中无实际作用的精选 Skills 区块（硬编码且无交互功能）

### Fixed
- 修复中文翻译中 "Skills" 被错误翻译为 "技能" 的问题，Skills 作为专有名词保持不变
- 修复设置页面注册源管理仅显示硬编码假数据的问题，现已连接后端真实数据
- 修复"默认同步策略"设置不生效的问题：
  - 后端新增配置管理模块，支持持久化用户设置到配置文件
  - 修改同步引擎 `distribute_from_hub` 和 `full_sync` 方法支持策略参数
  - 添加 `get_app_config` 和 `save_app_config` Tauri 命令
- 修复云端同步配置保存时序问题，确保配置在执行同步前已持久化
- 修复云端同步路径中的波浪号（~）未正确展开为用户主目录的问题
- 修复设置页面“保存设置”按钮无实际行为的问题：
  - 移除设置项变更即自动保存，改为仅通过“保存设置”按钮提交
  - 点击保存时仅提交发生变化的配置项（应用配置与已编辑的自定义工具）
  - 新增保存前校验，拦截非法配置（如未选择云提供商、空同步目录、非法路径字符、项目路径非相对路径）
  - 前端设置页面改为从后端加载和保存配置
  - 技能同步操作现在会遵循用户设置的默认策略（Auto/Link/Copy）

### Added
- 实现完整的注册源管理功能：
  - 从后端加载真实注册源列表（默认包含 anthropics、obra、ComposioHQ、vercel-labs）
  - 支持启用/禁用注册源切换
  - 支持添加新的 Git 注册源
  - 支持删除注册源
  - 显示注册源的名称、URL、描述和标签
- 优化发现 Skills 面板：
  - 进入页面时自动加载所有注册源中的 Skills
  - 支持滚动加载（无限滚动），逐步加载更多内容

### Added
- 新增 7 种语言支持：日本語 (ja)、한국어 (ko)、Français (fr)、Deutsch (de)、Español (es)、Português (pt)、Русский (ru)
- 浏览器语言自动检测支持所有 9 种语言
- 新增自定义工具功能：可在设置页面添加自定义 AI 编码工具，支持目录选择和配置持久化
  - `list_custom_tools`: 获取所有自定义工具
  - `add_custom_tool`: 添加新的自定义工具
  - `update_custom_tool`: 更新自定义工具配置
  - `remove_custom_tool`: 删除自定义工具
- 自定义工具编辑功能：在同步面板的工具卡片右上角添加编辑按钮，支持修改工具名称和路径
- 同步面板支持添加自定义工具：工具卡片区域添加"添加自定义工具"入口
- 工具详情查看功能：点击工具卡片可查看详细信息
  - 显示工具类型（内置/自定义）、状态、同步 Skills 数量
  - 显示全局路径和项目路径
  - 支持点击打开全局路径对应的目录
- 集成 `tauri-plugin-dialog` 实现原生目录选择对话框
- 集成 `tauri-plugin-shell` 实现打开系统目录功能
- 全局路径字段支持通过文件夹图标选择目录（项目路径保持为相对路径输入）

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
