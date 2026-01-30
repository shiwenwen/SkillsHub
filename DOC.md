# SkillsHub 技术文档

> 本文档记录项目的技术架构、实现细节和开发指南。每次更新都会同步更新此文档。

**最后更新**: 2026-01-30 (重构同步机制: Hub 中央仓库 + 双向同步)

---

## 1. 项目概述

SkillsHub 是一个统一的 Agent Skills 管理与共享平台，支持：
- 多工具同步（支持 17 种 AI 编码工具）
- 安全扫描
- 可视化管理（Tauri 桌面应用）
- CLI 命令行工具
- **多语言界面（中文/英文/日本語/한국어/Français/Deutsch/Español/Português/Русский）**

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | Rust 1.70+ |
| **桌面框架** | Tauri 2.0 |
| **前端** | React 18 + TypeScript |
| **样式** | TailwindCSS 3.4 + DaisyUI 4.12 |
| **构建工具** | Vite 5.4, Cargo |
| **CLI** | clap 4.5 |

---

## 3. 项目结构

```
SkillsHub/
├── Cargo.toml              # Rust 工作空间配置
├── package.json            # 前端依赖
├── tailwind.config.js      # TailwindCSS + DaisyUI 配置
├── vite.config.ts          # Vite 构建配置
│
├── crates/
│   ├── skillshub-core/     # 核心库
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs           # 模块导出
│   │       ├── error.rs         # 错误类型
│   │       ├── store.rs         # 本地存储
│   │       ├── registry.rs      # 注册表
│   │       ├── scanner.rs       # 安全扫描
│   │       ├── sync.rs          # 同步引擎
│   │       ├── plugins.rs       # Claude Plugins 扫描器
│   │       ├── models/          # 数据模型
│   │       │   ├── mod.rs
│   │       │   ├── skill.rs     # Skill, SkillSource, SkillVersion
│   │       │   ├── tool.rs      # ToolType, ToolProfile, SyncStrategy
│   │       │   ├── sync_state.rs # SyncState, DriftInfo
│   │       │   └── scan_report.rs # RiskLevel, ScanReport
│   │       └── adapters/        # 工具适配器 (17种)
│   │           ├── mod.rs       # ToolAdapter trait
│   │           ├── amp.rs       # Amp
│   │           ├── antigravity.rs # Antigravity
│   │           ├── claude.rs    # Claude Code
│   │           ├── codebuddy.rs # CodeBuddy
│   │           ├── codex.rs     # Codex
│   │           ├── copilot.rs   # GitHub Copilot
│   │           ├── cursor.rs    # Cursor
│   │           ├── factory.rs   # Droid/Factory
│   │           ├── gemini.rs    # Gemini CLI
│   │           ├── goose.rs     # Goose
│   │           ├── kilocode.rs  # Kilo Code
│   │           ├── kimi.rs      # Kimi CLI
│   │           ├── opencode.rs  # OpenCode
│   │           ├── qwen.rs      # Qwen Code
│   │           ├── roocode.rs   # Roo Code
│   │           ├── trae.rs      # Trae
│   │           └── windsurf.rs  # Windsurf
│   │
│   └── skillshub-cli/      # CLI 工具
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs          # 入口 + clap 定义
│           └── commands/        # 命令实现
│               ├── mod.rs
│               ├── discover.rs
│               ├── install.rs
│               ├── update.rs
│               ├── uninstall.rs
│               ├── sync.rs
│               ├── scan.rs
│               ├── tools.rs
│               ├── registry.rs
│               ├── list.rs
│               └── info.rs
│
├── src-tauri/              # Tauri 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json     # Tauri 配置
│   ├── build.rs
│   └── src/
│       ├── main.rs         # 入口
│       ├── lib.rs          # Tauri 命令注册
│       └── commands.rs     # Tauri 命令实现
│
└── src/                    # React 前端
    ├── main.tsx            # React 入口
    ├── App.tsx             # 路由配置
    ├── index.css           # 全局样式
    ├── i18n.tsx            # 国际化上下文和 Hooks
    ├── locales/            # 语言文件 (9种语言)
    │   ├── en.ts           # English
    │   ├── zh.ts           # 中文
    │   ├── ja.ts           # 日本語
    │   ├── ko.ts           # 한국어
    │   ├── fr.ts           # Français
    │   ├── de.ts           # Deutsch
    │   ├── es.ts           # Español
    │   ├── pt.ts           # Português
    │   └── ru.ts           # Русский
    ├── components/
    │   └── Layout.tsx      # 布局组件（侧边栏）
    └── pages/
        ├── Installed.tsx   # 已安装技能
        ├── Discover.tsx    # 发现技能
        ├── SkillDetail.tsx # 技能详情
        ├── SyncDashboard.tsx # 同步面板
        ├── Security.tsx    # 安全中心
        └── Settings.tsx    # 设置页面（含语言切换）
```

---

## 4. 核心模块说明

### 4.1 数据模型 (`models/`)

**Skill** - 技能包实体
```rust
struct Skill {
    id: String,
    name: String,
    version: SkillVersion,
    source: SkillSource,      // Git | Registry | Http | Local
    skill_md_path: PathBuf,
    resources: Vec<PathBuf>,
}
```

**ToolType** - 支持的工具 (17种)
```rust
enum ToolType {
    Amp,          // ~/.config/agents/skills/
    Antigravity,  // ~/.gemini/antigravity/skills/
    Claude,       // ~/.claude/skills/
    Codex,        // ~/.codex/skills/
    Cursor,       // ~/.cursor/skills/
    CodeBuddy,    // ~/.codebuddy/skills/
    Factory,      // ~/.factory/skills/
    Gemini,       // ~/.gemini/skills/
    Copilot,      // ~/.copilot/skills/
    Goose,        // ~/.config/goose/skills/
    KiloCode,     // ~/.kilocode/skills/
    Kimi,         // ~/.kimi/skills/
    OpenCode,     // ~/.config/opencode/skills/
    Qwen,         // ~/.qwen/skills/
    RooCode,      // ~/.roo/skills/
    Trae,         // (仅项目级别)
    Windsurf,     // ~/.codeium/windsurf/skills/
    Custom,       // 自定义工具
}
```

**ToolProfile** - 工具配置
```rust
struct ToolProfile {
    tool_type: ToolType,
    enabled: bool,
    custom_global_path: Option<PathBuf>,   // 自定义全局路径
    custom_project_path: Option<String>,   // 自定义项目路径
    sync_strategy: SyncStrategy,
    detected: bool,
    custom_name: Option<String>,           // 自定义工具名称
}
```

**SyncStrategy** - 同步策略
```rust
enum SyncStrategy {
    Auto,  // 自动选择 (link-first)
    Link,  // 符号链接
    Copy,  // 文件复制
}
```

**RiskLevel** - 风险等级
```rust
enum RiskLevel {
    Low,    // 信息
    Medium, // 警告
    High,   // 需确认
    Block,  // 阻断
}
```

### 4.2 本地存储 (`store.rs`)

```rust
impl LocalStore {
    fn new(config: StoreConfig) -> Result<Self>;
    fn is_installed(&self, skill_id: &str) -> bool;
    fn import_skill(&mut self, skill: &Skill, source_path: &Path) -> Result<InstallRecord>;
    fn remove_skill(&mut self, skill_id: &str) -> Result<()>;
    fn calculate_hash(&self, skill_id: &str) -> Result<String>;
}
```

存储位置: `~/.local/share/skillshub/store/`

### 4.3 同步引擎 (`sync.rs`)

```rust
impl SyncEngine {
    fn register_adapter(&mut self, adapter: Box<dyn ToolAdapter>);
    fn detect_tools(&self) -> Vec<ToolProfile>;
    fn sync_skill(&mut self, skill_id: &str, tool: ToolType, strategy: SyncStrategy) -> Result<()>;
    fn unsync_skill(&mut self, skill_id: &str, tool: ToolType) -> Result<()>;
    fn check_drift(&self) -> Vec<(String, ToolType, DriftInfo)>;
}
```

同步策略:
1. 尝试创建符号链接
2. 失败则复制文件
3. 更新 SyncState

### 4.4 安全扫描 (`scanner.rs`)

内置规则:

| ID | 名称 | 风险 | 检测内容 |
|----|------|------|----------|
| CMD001 | 破坏性命令 | HIGH | `rm -rf`, `del /s` 等 |
| CMD002 | 权限提升 | HIGH | `sudo`, `chmod 777` |
| NET001 | 数据外泄 | HIGH | `curl -d`, `nc -e` |
| CRED001 | 凭据访问 | HIGH | `.ssh/`, `API_KEY` |
| EVAL001 | 动态执行 | MEDIUM | `eval()`, `exec()` |
| PATH001 | 系统路径 | MEDIUM | `/etc/passwd` |
| FILE001 | 二进制文件 | BLOCK | `.exe`, `.dll` |
| FILE002 | Shell 脚本 | MEDIUM | `.sh`, `.bash` |

### 4.5 工具适配器 (`adapters/`)

```rust
trait ToolAdapter: Send + Sync {
    fn tool_type(&self) -> ToolType;
    fn detect(&self) -> bool;
    fn skills_dir(&self) -> Result<PathBuf>;
    fn supports_symlinks(&self) -> bool { true }
}
```

### 4.6 工具路径配置

完整的工具路径配置表：

| 工具名称 | 全局路径 | 项目路径 |
|---------|---------|---------|
| Amp | `~/.config/agents/skills/` | `.agents/skills/` |
| Antigravity | `~/.gemini/antigravity/skills/` | `.agent/skills/` |
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| Codex | `~/.codex/skills/` | `.codex/skills/` |
| Cursor | `~/.cursor/skills/` | `.cursor/skills/` |
| CodeBuddy | `~/.codebuddy/skills/` | `.codebuddy/skills/` |
| Droid/Factory | `~/.factory/skills/` | `.factory/skills/` |
| Gemini CLI | `~/.gemini/skills/` | `.gemini/skills/` |
| GitHub Copilot | `~/.copilot/skills/` | `.github/skills/` |
| Goose | `~/.config/goose/skills/` | `.goose/skills/` |
| Kilo Code | `~/.kilocode/skills/` | `.kilocode/skills/` |
| Kimi CLI | `~/.kimi/skills/` | `.kimi/skills/` |
| OpenCode | `~/.config/opencode/skills/` | `.opencode/skills/` |
| Qwen Code | `~/.qwen/skills/` | `.qwen/skills/` |
| Roo Code | `~/.roo/skills/` | `.roo/skills/` |
| Trae | *(无全局路径)* | `.trae/skills/` |
| Windsurf | `~/.codeium/windsurf/skills/` | `.windsurf/skills/` |

> **注意**: 用户可以在设置页面自定义这些路径，也可以添加自定义工具。

---

## 5. CLI 命令

```bash
skillshub discover [query]           # 搜索技能
skillshub install <skill> [--tools]  # 安装技能
skillshub update [skill|all]         # 更新技能
skillshub uninstall <skill>          # 卸载技能
skillshub sync [--reconcile]         # 同步到工具
skillshub scan <skill|path>          # 安全扫描
skillshub tools list|detect|status   # 工具管理
skillshub registry list|add|remove   # 注册表管理
skillshub list [-d]                  # 列出已安装
skillshub info <skill>               # 技能详情
```

---

## 6. Tauri 命令

前端通过 `invoke` 调用后端:

```typescript
// 技能管理
invoke<SkillInfo[]>("list_installed_skills")
invoke<SkillInfo>("get_skill_info", { skillId })
invoke("install_skill", { skillPath, tools })
invoke("uninstall_skill", { skillId })

// 同步
invoke<SyncResult[]>("sync_skills", { skillIds, tools })
invoke<[string, string, string][]>("check_drift")

// 扫描
invoke<ScanResult>("scan_skill", { skillId })

// 工具
invoke<ToolInfo[]>("list_tools")
invoke<ToolInfo[]>("detect_tools")

// Claude Plugins (新增)
invoke<PluginSkillInfo[]>("scan_claude_plugins")
invoke<MarketplaceInfo[]>("list_claude_marketplaces")
invoke<SyncResult[]>("sync_plugin_skill", { skillPath, skillId, tools })
```

---

## 7. 前端页面

| 页面 | 路由 | 功能 |
|------|------|------|
| Installed | `/` | 已安装技能列表，统计信息 |
| Discover | `/discover` | 搜索、标签筛选、安装 |
| SkillDetail | `/skill/:id` | 技能详情、同步状态、安全报告 |
| SyncDashboard | `/sync` | 工具状态、漂移检测、同步操作 |
| Security | `/security` | 扫描规则、策略配置、扫描历史 |
| Settings | `/settings` | 存储、注册表、**17种工具路径配置**、自定义工具、语言切换 |

---

## 8. 多语言支持 (i18n)

### 8.1 架构

使用 React Context + 自定义 Hook 实现轻量级国际化方案：

```
src/
├── i18n.tsx          # LanguageProvider, useLanguage, useTranslation
└── locales/
    ├── en.ts         # English
    ├── zh.ts         # 中文
    ├── ja.ts         # 日本語
    ├── ko.ts         # 한국어
    ├── fr.ts         # Français
    ├── de.ts         # Deutsch
    ├── es.ts         # Español
    ├── pt.ts         # Português
    └── ru.ts         # Русский
```

### 8.2 使用方式

**在组件中使用翻译：**

```tsx
import { useTranslation } from "../i18n";

function MyComponent() {
    const t = useTranslation();
    return <h1>{t.settings.title}</h1>;
}
```

**切换语言：**

```tsx
import { useLanguage } from "../i18n";

function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();
    return (
        <select value={language} onChange={e => setLanguage(e.target.value)}>
            <option value="zh">中文</option>
            <option value="en">English</option>
        </select>
    );
}
```

### 8.3 翻译规则

- **Skills** 作为专有名词，在所有语言中保持不变，不进行翻译

### 8.4 添加新翻译

1. 在 `locales/en.ts` 添加新的翻译键值
2. 在所有其他语言文件中添加对应翻译（zh, ja, ko, fr, de, es, pt, ru）
3. 在组件中使用 `t.xxx.yyy` 访问

```typescript
// locales/en.ts
export const en = {
    myFeature: {
        title: "My Feature",
        description: "Feature description",
    },
    // ...
};
```

### 8.5 特性

- **9 种语言支持**：English、中文、日本語、한국어、Français、Deutsch、Español、Português、Русский
- **自动检测**：根据 `navigator.language` 自动选择语言
- **持久化**：语言偏好存储在 `localStorage`
- **实时切换**：切换语言后界面立即更新

---

## 9. 开发指南

### 9.1 环境准备

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js 依赖
npm install
```

### 9.2 开发模式

```bash
# 运行桌面应用
npm run tauri dev

# 仅运行前端
npm run dev

# 构建 CLI
cargo build --package skillshub-cli
```

### 9.3 构建发布

```bash
# 构建桌面应用
npm run tauri build

# 构建 CLI (优化)
cargo build --release --package skillshub-cli
```

### 9.4 添加新工具适配器

1. 在 `crates/skillshub-core/src/adapters/` 创建新文件
2. 实现 `ToolAdapter` trait
3. 在 `mod.rs` 中导出
4. 在 `create_default_adapters()` 中注册

```rust
// 新适配器示例
pub struct MyToolAdapter { ... }

impl ToolAdapter for MyToolAdapter {
    fn tool_type(&self) -> ToolType { ToolType::Custom }
    fn detect(&self) -> bool { ... }
    fn skills_dir(&self) -> Result<PathBuf> { ... }
}
```

### 9.5 添加安全扫描规则

在 `scanner.rs` 的 `default_rules()` 中添加:

```rust
ScanRule {
    id: "XXX001".to_string(),
    name: "Rule Name".to_string(),
    risk_level: RiskLevel::Medium,
    pattern: Regex::new(r"pattern").unwrap(),
    file_patterns: vec!["*.md".to_string()],
    recommendation: "Suggestion".to_string(),
}
```

---

## 10. 配置文件

### Cargo.toml (工作空间)

```toml
[workspace]
members = ["crates/skillshub-core", "crates/skillshub-cli", "src-tauri"]

[workspace.dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.0", features = ["full"] }
clap = { version = "4.5", features = ["derive"] }
tauri = "2.2"
```

### tailwind.config.js

```javascript
plugins: [require("daisyui")],
daisyui: {
  themes: [{
    skillshub: {
      "primary": "#6366f1",
      "secondary": "#8b5cf6",
      "base-100": "#0f172a",
      // ...
    }
  }]
}
```

