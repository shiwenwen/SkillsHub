# SkillsHub

<div align="center">

![SkillsHub Logo](https://img.shields.io/badge/SkillsHub-Agent%20Skills%20Manager-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWdvbiBwb2ludHM9IjEyIDIgMiA3IDEyIDEyIDIyIDcgMTIgMiI+PC9wb2x5Z29uPjxwb2x5bGluZSBwb2ludHM9IjIgMTcgMTIgMjIgMjIgMTciPjwvcG9seWxpbmU+PHBvbHlsaW5lIHBvaW50cz0iMiAxMiAxMiAxNyAyMiAxMiI+PC9wb2x5bGluZT48L3N2Zz4=)

**统一的 Agent Skills 管理与共享平台**

[![Rust](https://img.shields.io/badge/Rust-1.70+-orange?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?style=flat-square&logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[English](#english) | [中文](#中文)

</div>

---

## 中文

### 简介

SkillsHub 是一个统一的 Agent Skills 管理平台，让您可以用同一套 skills 同时服务多个 Agent 工具（Claude Code、Cursor、Gemini CLI、OpenCode 等）。

### ✨ 核心特性

- 🎯 **统一管理** - 一处安装，多工具同步
- 🔗 **Link-first 同步** - 符号链接优先，节省空间，实时更新
- 🛡️ **安全扫描** - 安装前自动检测危险命令、凭据访问、数据外泄风险
- 🖥️ **可视化界面** - Tauri 桌面应用，美观易用
- ⌨️ **CLI 支持** - 完整的命令行工具，适合自动化和脚本化
- 🔄 **漂移检测** - 自动检测不一致并修复
- 🧩 **Claude Plugins 支持** - 扫描、同步 Claude 插件技能
- 🧰 **自定义工具** - 支持添加自定义 AI 编码工具与路径
- 🌍 **多语言界面** - 内置 9 种语言（中/英/日/韩/法/德/西/葡/俄）

### 🏗️ 架构

```
┌─────────────────────────────────────────────────────────────┐
│                         SkillsHub                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Tauri UI   │  │    CLI      │  │     Core Library    │ │
│  │  (React +   │  │  (clap)     │  │  ┌───────────────┐  │ │
│  │  DaisyUI)   │  │             │  │  │   Registry    │  │ │
│  └──────┬──────┘  └──────┬──────┘  │  ├───────────────┤  │ │
│         │                │         │  │  Local Store  │  │ │
│         └────────┬───────┘         │  ├───────────────┤  │ │
│                  │                 │  │    Scanner    │  │ │
│                  ▼                 │  ├───────────────┤  │ │
│         ┌────────────────┐         │  │  Sync Engine  │  │ │
│         │   Rust Core    │◄────────┤  └───────────────┘  │ │
│         └────────────────┘         └─────────────────────┘ │
│                  │                                          │
│    ┌─────────────┼─────────────┬─────────────┐             │
│    ▼             ▼             ▼             ▼             │
│ ┌──────┐    ┌──────┐    ┌──────────┐    ┌──────────┐      │
│ │Claude│    │Cursor│    │ Gemini   │    │ OpenCode │      │
│ │ Code │    │      │    │   CLI    │    │          │      │
│ └──────┘    └──────┘    └──────────┘    └──────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 📦 安装

#### 前置要求

- [Rust](https://rustup.rs/) 1.70+
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 或 npm

#### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/skillshub/skillshub.git
cd skillshub

# 安装前端依赖
npm install

# 构建 CLI
cargo build --release --package skillshub-cli

# 运行桌面应用 (开发模式)
npm run tauri dev

# 构建桌面应用
npm run tauri build
```

### 🚀 快速开始

#### CLI 使用

```bash
# 检测已安装的工具
skillshub tools detect

# 搜索技能
skillshub discover "code review"

# 安装技能
skillshub install my-skill --tools claude,cursor

# 同步到所有工具
skillshub sync

# 查看已安装的技能
skillshub list

# 安全扫描
skillshub scan my-skill
```

#### 桌面应用

1. 启动应用后，进入 **Installed** 页面查看已安装的技能
2. 使用 **Discover** 页面搜索和安装新技能
3. 在 **Sync Dashboard** 查看同步状态和漂移检测
4. 通过 **Security Center** 管理安全扫描规则
5. 在 **Settings** 中配置工具路径和同步策略

### 📁 项目结构

```
SkillsHub/
├── crates/
│   ├── skillshub-core/     # 核心库
│   │   ├── src/
│   │   │   ├── models/     # 数据模型
│   │   │   ├── adapters/   # 工具适配器
│   │   │   ├── store.rs    # 本地存储
│   │   │   ├── registry.rs # 注册表
│   │   │   ├── scanner.rs  # 安全扫描
│   │   │   └── sync.rs     # 同步引擎
│   │   └── Cargo.toml
│   └── skillshub-cli/      # CLI 工具
│       ├── src/
│       │   ├── main.rs
│       │   └── commands/   # 命令实现
│       └── Cargo.toml
├── src-tauri/              # Tauri 后端
│   ├── src/
│   │   ├── lib.rs
│   │   └── commands.rs     # Tauri 命令
│   └── tauri.conf.json
├── src/                    # React 前端
│   ├── components/
│   ├── pages/
│   └── App.tsx
├── Cargo.toml              # Rust 工作空间
├── package.json
├── tailwind.config.js
└── README.md
```

### 🔧 支持的工具

| 工具 | 技能目录 | 状态 |
|------|----------|------|
| Amp | `~/.config/agents/skills` | ✅ 支持 |
| Antigravity | `~/.gemini/antigravity/skills` | ✅ 支持 |
| Claude Code | `~/.claude/skills` | ✅ 支持 |
| Codex | `~/.codex/skills` | ✅ 支持 |
| CodeBuddy | `~/.codebuddy/skills` | ✅ 支持 |
| Cursor | `~/.cursor/skills` | ✅ 支持 |
| Droid/Factory | `~/.factory/skills` | ✅ 支持 |
| Gemini CLI | `~/.gemini/skills` | ✅ 支持 |
| GitHub Copilot | `~/.copilot/skills` | ✅ 支持 |
| Goose | `~/.config/goose/skills` | ✅ 支持 |
| Kilo Code | `~/.kilocode/skills` | ✅ 支持 |
| Kimi CLI | `~/.kimi/skills` | ✅ 支持 |
| OpenCode | `~/.config/opencode/skills` | ✅ 支持 |
| Qwen Code | `~/.qwen/skills` | ✅ 支持 |
| Roo Code | `~/.roo/skills` | ✅ 支持 |
| Trae | `.trae/skills` | ✅ 支持 |
| Windsurf | `~/.codeium/windsurf/skills` | ✅ 支持 |
| 自定义工具 | 用户自定义 | ✅ 支持 |

### 🛡️ 安全扫描规则

| 规则 ID | 名称 | 风险等级 |
|---------|------|----------|
| CMD001 | 破坏性命令 (rm -rf 等) | HIGH |
| CMD002 | 权限提升 (sudo 等) | HIGH |
| NET001 | 数据外泄 | HIGH |
| CRED001 | 凭据访问 | HIGH |
| EVAL001 | 动态代码执行 | MEDIUM |
| PATH001 | 系统路径访问 | MEDIUM |
| FILE001 | 二进制可执行文件 | BLOCK |
| FILE002 | Shell 脚本 | MEDIUM |

### 🔄 同步策略

- **Link (推荐)**: 使用符号链接，所有工具共享同一份源文件
  - ✅ 即时更新
  - ✅ 节省空间
  - ✅ 易于回滚
  
- **Copy**: 复制完整文件到各工具目录
  - ✅ 更好的兼容性
  - ✅ 隔离性强
  - ⚠️ 占用更多空间

### 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与。

### 📄 许可证

[MIT License](LICENSE)

---

## English

### Introduction

SkillsHub is a unified Agent Skills management platform that allows you to use the same set of skills across multiple Agent tools (Claude Code, Cursor, Gemini CLI, OpenCode, etc.).

### ✨ Key Features

- 🎯 **Unified Management** - Install once, sync to multiple tools
- 🔗 **Link-first Sync** - Symlinks first, saving space with instant updates
- 🛡️ **Security Scanning** - Auto-detect dangerous commands, credential access, data exfiltration
- 🖥️ **Visual Interface** - Beautiful Tauri desktop application
- ⌨️ **CLI Support** - Full command-line tool for automation
- 🔄 **Drift Detection** - Automatically detect and repair inconsistencies
- 🧩 **Claude Plugins Support** - Scan and sync Claude plugin skills
- 🧰 **Custom Tools** - Add custom AI coding tools and paths
- 🌍 **Multilingual UI** - Built-in 9 languages

### 🚀 Quick Start

```bash
# Detect installed tools
skillshub tools detect

# Search for skills
skillshub discover "code review"

# Install a skill
skillshub install my-skill --tools claude,cursor

# Sync to all tools
skillshub sync

# List installed skills
skillshub list

# Scan a skill for security risks
skillshub scan my-skill
```

### 🔧 Supported Tools

Amp, Antigravity, Claude Code, Codex, CodeBuddy, Cursor, Droid/Factory, Gemini CLI, GitHub Copilot, Goose, Kilo Code, Kimi CLI, OpenCode, Qwen Code, Roo Code, Trae, Windsurf, plus custom tools.

### 📄 License

[MIT License](LICENSE)
