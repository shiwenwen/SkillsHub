# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- 修复日间模式下页面顶部导航栏仍然显示为暗色的问题：移除 `index.html` 中硬编码的 `data-theme="skillshub-dark"`，改为内联脚本在页面加载前从 `localStorage` 读取用户主题偏好并立即应用，避免主题闪烁

### Changed
- 已安装页面列表从表格布局改为卡片网格布局，移除横向滚动，内容超出自动换行，操作按钮放置在卡片底部
- 新增插件空状态的独立翻译 key（`noPlugins`），中英文适配

### Added
- 主题切换功能，支持三种模式：
  - **自动模式**：跟随系统偏好自动切换亮色/暗色主题
  - **日间模式**：亮色配色方案
  - **夜间模式**：暗色配色方案
  - 新增 `ThemeProvider` 上下文管理主题状态，支持 `localStorage` 持久化
  - 新增 DaisyUI 双主题配置（`skillshub-light` / `skillshub-dark`）
  - 导航栏新增主题切换下拉菜单（支持自动/亮色/暗色）
  - 设置页面"通用"标签新增主题选择卡片，三按钮切换
  - 自动监听系统偏好 `prefers-color-scheme` 变化（auto 模式下实时响应）
  - 修复玻璃效果（glass-card / glass-panel）在亮色主题下的适配
  - 全部 9 种语言国际化翻译适配

### Fixed
- 修复 CLI 中存在的“假功能/占位实现”问题：
  - `install` 命令已支持本地目录、本地注册源、Git/HTTP 仓库来源的真实安装流程（导入本地 Store 后再执行同步）
  - `update` 命令不再一律输出“已是最新”，改为基于本地来源内容哈希执行真实变更检测，并对远程来源给出明确能力边界提示
  - 注册源管理中 `http/curated` 类型不再返回空 Provider，已接入 `HttpRegistry` 查询实现
  - `parse_skill_md` 移除占位 YAML 解析逻辑，改为可工作的前置信息解析实现

### Fixed
- 修复 Security 页面功能未实现的问题：
  - `scanAllSkills` 改为真实调用后端 `scan_all_skills` + `scan_skill` 执行全量扫描
  - 扫描策略开关（阻止高风险 / 中风险需确认 / 自动通过低风险）改为通过后端 `AppConfig` 持久化并参与扫描结果判定
- 修复设置页面预置工具状态显示问题：
  - 接入后端 `detect_tools` 接口，动态获取工具安装状态
  - 自动更新已检测工具的全局路径（如果检测到的路径与默认不同）
  - 可信来源支持新增与移除，并持久化到后端 `AppConfig`
  - 最近扫描结果改为通过后端命令持久化（`get_security_scan_records` / `save_security_scan_records`），并用于统计卡片展示
  - 安全规则列表改为通过后端命令 `list_security_rules` 提供，移除前端规则硬编码数组
  - 移除安全、安装、更新流程对 `localStorage` 安全配置键的依赖，统一以 Tauri 后端配置为单一数据源
- 修复 SkillDetail 页面未实现与硬编码问题：
  - 顶部“同步”按钮接入后端 `sync_skills`，支持将当前 Skill 同步到已检测工具
  - 顶部“卸载”按钮接入后端 `uninstall_skill`，卸载后返回安装列表
  - 同步状态页“刷新”按钮接入后端同步逻辑，支持按工具单独同步
  - 同步状态工具列表改为从后端 `list_tools` 动态加载，不再使用前端硬编码
  - 安全页改为调用后端 `scan_skill` 显示真实扫描结果与问题明细
  - 后端 `sync_skills` 在成功后会更新 `projected_tools` 持久化状态，前端刷新后同步状态保持一致

### Added
- 安全页面可信来源支持从“已配置仓库”中选择并一键添加：
  - 前端新增仓库下拉与添加按钮，数据来源于后端 `list_registries`
  - 支持与手动添加共存，并沿用后端 `AppConfig` 持久化
  - 新增对应多语言文案键，覆盖全部已支持语言
- 修复设置页面存储位置、使用量、Skills 数量硬编码显示的问题：
  - 后端新增 `get_store_info` 命令，动态获取存储路径和统计信息
  - 前端从后端获取实际存储路径（macOS: `~/Library/Application Support/skillshub/store`，Linux: `~/.local/share/skillshub/store`，Windows: `AppData/Local/skillshub/store`）
  - 存储位置旁的文件夹按钮现在可以打开对应目录
- **Skill 详情弹窗功能：**
  - 新增 `SkillDetailModal` 组件，点击已安装 Skill 卡片可查看详情
  - 显示 SKILL.md 原始内容，支持预览技能说明文档
  - 列出技能目录下的所有资源文件（名称、大小、类型）
  - 显示所有工具的同步状态（已同步/未同步），区分 Link/Copy 策略
  - 支持"打开目录"按钮快速打开技能目录
  - 支持"同步到所有"按钮一键同步到所有检测到的工具
  - 支持单独切换每个工具的同步状态
  - 后端新增 `get_skill_detail`、`sync_single_skill`、`toggle_skill_tool_sync` 命令
  - 全部 9 种语言国际化翻译适配

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
