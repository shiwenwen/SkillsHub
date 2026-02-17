// Backend custom tool config type
export interface CustomToolBackend {
    id: string;
    name: string;
    global_path: string | null;
    project_path: string | null;
}

// Tool configuration type
export interface ToolConfig {
    id: string;
    name: string;
    globalPath: string;
    projectPath: string;
    detected: boolean;
    isCustom?: boolean;
    hasGlobalPath?: boolean;
}

// Builtin tools list
export const BUILTIN_TOOLS: ToolConfig[] = [
    { id: "amp", name: "Amp", globalPath: "~/.config/agents/skills/", projectPath: ".agents/skills/", detected: false, hasGlobalPath: true },
    { id: "antigravity", name: "Antigravity", globalPath: "~/.gemini/antigravity/skills/", projectPath: ".agent/skills/", detected: true, hasGlobalPath: true },
    { id: "claude", name: "Claude Code", globalPath: "~/.claude/skills/", projectPath: ".claude/skills/", detected: true, hasGlobalPath: true },
    { id: "codex", name: "Codex", globalPath: "~/.codex/skills/", projectPath: ".codex/skills/", detected: false, hasGlobalPath: true },
    { id: "cursor", name: "Cursor", globalPath: "~/.cursor/skills/", projectPath: ".cursor/skills/", detected: true, hasGlobalPath: true },
    { id: "codebuddy", name: "CodeBuddy", globalPath: "~/.codebuddy/skills/", projectPath: ".codebuddy/skills/", detected: false, hasGlobalPath: true },
    { id: "factory", name: "Droid/Factory", globalPath: "~/.factory/skills/", projectPath: ".factory/skills/", detected: false, hasGlobalPath: true },
    { id: "gemini", name: "Gemini CLI", globalPath: "~/.gemini/skills/", projectPath: ".gemini/skills/", detected: true, hasGlobalPath: true },
    { id: "copilot", name: "GitHub Copilot", globalPath: "~/.copilot/skills/", projectPath: ".github/skills/", detected: false, hasGlobalPath: true },
    { id: "goose", name: "Goose", globalPath: "~/.config/goose/skills/", projectPath: ".goose/skills/", detected: false, hasGlobalPath: true },
    { id: "kilocode", name: "Kilo Code", globalPath: "~/.kilocode/skills/", projectPath: ".kilocode/skills/", detected: false, hasGlobalPath: true },
    { id: "kimi", name: "Kimi CLI", globalPath: "~/.kimi/skills/", projectPath: ".kimi/skills/", detected: false, hasGlobalPath: true },
    { id: "opencode", name: "OpenCode", globalPath: "~/.config/opencode/skills/", projectPath: ".opencode/skills/", detected: false, hasGlobalPath: true },
    { id: "openclaw", name: "OpenClaw", globalPath: "~/.openclaw/workspace/skills/", projectPath: ".openclaw/skills/", detected: false, hasGlobalPath: true },
    { id: "qwen", name: "Qwen Code", globalPath: "~/.qwen/skills/", projectPath: ".qwen/skills/", detected: false, hasGlobalPath: true },
    { id: "roocode", name: "Roo Code", globalPath: "~/.roo/skills/", projectPath: ".roo/skills/", detected: false, hasGlobalPath: true },
    { id: "trae", name: "Trae", globalPath: "", projectPath: ".trae/skills/", detected: false, hasGlobalPath: false },
    { id: "windsurf", name: "Windsurf", globalPath: "~/.codeium/windsurf/skills/", projectPath: ".windsurf/skills/", detected: false, hasGlobalPath: true },
];

// Store info
export interface StoreInfo {
    path: string;
    size_bytes: number;
    size_display: string;
    skill_count: number;
}

// Cloud drive info
export interface CloudDriveInfo {
    provider: string;
    path: string;
    display_name: string;
}

// Cloud sync config
export interface CloudSyncConfig {
    enabled: boolean;
    provider: string | null;
    sync_folder: string | null;
    auto_sync: boolean;
    last_sync: string | null;
}

// Registry config type
export interface RegistryConfig {
    name: string;
    url: string;
    branch: string | null;
    description: string | null;
    enabled: boolean;
    registry_type: string;
    tags: string[];
}

export interface AppConfigPayload {
    default_sync_strategy: string;
    auto_sync_on_install: boolean;
    check_updates_on_startup: boolean;
    scan_before_install: boolean;
    scan_before_update: boolean;
    block_high_risk: boolean;
    require_confirm_medium: boolean;
    auto_approve_low: boolean;
    trusted_sources: string[];
    tool_sync_strategies: Record<string, string>;
    cloud_sync: {
        enabled: boolean;
        provider: string | null;
        sync_folder: string | null;
        auto_sync: boolean;
        last_sync: string | null;
    };
}

export interface PersistedCustomTool {
    name: string;
    globalPath: string;
    projectPath: string;
}

export interface DetectedToolInfo {
    name: string;
    tool_type: string;
    detected: boolean;
    skills_dir: string | null;
    skills_dirs: string[];
    skill_count: number;
}

export const VALID_SYNC_STRATEGIES = new Set(["auto", "link", "copy"]);
export const VALID_CLOUD_PROVIDERS = new Set(["ICloud", "GoogleDrive", "OneDrive", "Custom"]);
