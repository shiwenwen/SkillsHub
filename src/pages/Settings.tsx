import { useState, useEffect, useMemo } from "react";
import {
    Settings as SettingsIcon,
    FolderOpen,
    Globe,
    Shield,
    RefreshCw,
    Plus,
    Trash2,
    Languages,
    ChevronDown,
    ChevronUp,
    Cloud,
    Save,
    Info,
    Server,
    LayoutGrid,
    Search,
    Sun,
    Moon,
    Monitor,
    Palette
} from "lucide-react";
import { useTranslation, useLanguage, type Language } from "../i18n";
import { useTheme, type ThemeMode } from "../theme";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

// 后端自定义工具配置类型
interface CustomToolBackend {
    id: string;
    name: string;
    global_path: string | null;
    project_path: string | null;
}

// 工具配置类型
interface ToolConfig {
    id: string;
    name: string;
    globalPath: string;
    projectPath: string;
    detected: boolean;
    isCustom?: boolean;
    hasGlobalPath?: boolean; // 是否有全局路径
}

// 预置工具列表
const BUILTIN_TOOLS: ToolConfig[] = [
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

// 存储信息
interface StoreInfo {
    path: string;
    size_bytes: number;
    size_display: string;
    skill_count: number;
}

// 云端驱动器信息
interface CloudDriveInfo {
    provider: string;
    path: string;
    display_name: string;
}

// 云端同步配置
interface CloudSyncConfig {
    enabled: boolean;
    provider: string | null;
    sync_folder: string | null;
    auto_sync: boolean;
    last_sync: string | null;
}

// 注册源配置类型
interface RegistryConfig {
    name: string;
    url: string;
    branch: string | null;
    description: string | null;
    enabled: boolean;
    registry_type: string;
    tags: string[];
}

interface AppConfigPayload {
    default_sync_strategy: string;
    auto_sync_on_install: boolean;
    check_updates_on_startup: boolean;
    scan_before_install: boolean;
    scan_before_update: boolean;
    block_high_risk: boolean;
    require_confirm_medium: boolean;
    auto_approve_low: boolean;
    trusted_sources: string[];
    cloud_sync: {
        enabled: boolean;
        provider: string | null;
        sync_folder: string | null;
        auto_sync: boolean;
        last_sync: string | null;
    };
}

interface PersistedCustomTool {
    name: string;
    globalPath: string;
    projectPath: string;
}


interface DetectedToolInfo {
    name: string;
    tool_type: string;
    detected: boolean;
    skills_dir: string | null;
    skills_dirs: string[];
    skill_count: number;
}

const VALID_SYNC_STRATEGIES = new Set(["auto", "link", "copy"]);
const VALID_CLOUD_PROVIDERS = new Set(["ICloud", "GoogleDrive", "OneDrive", "Custom"]);

export default function Settings() {
    const t = useTranslation();
    const { language, setLanguage } = useLanguage();
    const { themeMode, setThemeMode } = useTheme();
    const [activeTab, setActiveTab] = useState("general");

    // Config State
    const [defaultStrategy, setDefaultStrategy] = useState("auto");
    const [tools, setTools] = useState<ToolConfig[]>(BUILTIN_TOOLS);
    const [customTools, setCustomTools] = useState<ToolConfig[]>([]);
    const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
    const [showAddToolModal, setShowAddToolModal] = useState(false);

    // Filter tools state
    const [toolFilter, setToolFilter] = useState("");

    // Detect installed tools on mount
    useEffect(() => {
        const detectTools = async () => {
            try {
                const detectedTools = await invoke<DetectedToolInfo[]>("detect_tools");
                setTools(prevTools => prevTools.map(tool => {
                    const detected = detectedTools.find(d =>
                        d.tool_type.toLowerCase() === tool.id.toLowerCase()
                    );
                    if (detected) {
                        return {
                            ...tool,
                            detected: detected.detected,
                            globalPath: detected.skills_dir || tool.globalPath,
                        };
                    }
                    return tool;
                }));
            } catch (error) {
                console.error("Failed to detect tools:", error);
            }
        };
        detectTools();
    }, []);

    // Tool Form State
    const [newToolName, setNewToolName] = useState("");
    const [newToolGlobalPath, setNewToolGlobalPath] = useState("");
    const [newToolProjectPath, setNewToolProjectPath] = useState("");

    // Status State
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [savedAppConfigSnapshot, setSavedAppConfigSnapshot] = useState("");
    const [savedCustomToolsSnapshot, setSavedCustomToolsSnapshot] = useState<Record<string, PersistedCustomTool>>({});
    const [customToolsLoaded, setCustomToolsLoaded] = useState(false);
    const [initialized, setInitialized] = useState(false);

    // Registry State
    const [registries, setRegistries] = useState<RegistryConfig[]>([]);
    const [showAddRegistryModal, setShowAddRegistryModal] = useState(false);
    const [newRegistryName, setNewRegistryName] = useState("");
    const [newRegistryUrl, setNewRegistryUrl] = useState("");
    const [newRegistryBranch, setNewRegistryBranch] = useState("");
    const [newRegistryDescription, setNewRegistryDescription] = useState("");
    const [isRegistryLoading, setIsRegistryLoading] = useState(false);

    // Settings State
    const [checkUpdatesOnStartup, setCheckUpdatesOnStartup] = useState(true);
    const [autoSyncOnInstall, setAutoSyncOnInstall] = useState(true);

    // Cloud SYnc State
    const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
    const [cloudProvider, setCloudProvider] = useState<string | null>(null);
    const [cloudSyncFolder, setCloudSyncFolder] = useState("~/Documents");
    const [cloudAutoSync, setCloudAutoSync] = useState(false);
    const [cloudLastSync, setCloudLastSync] = useState<string | null>(null);
    const [detectedDrives, setDetectedDrives] = useState<CloudDriveInfo[]>([]);
    const [cloudSyncing, setCloudSyncing] = useState(false);

    // Security State
    const [scanBeforeInstall, setScanBeforeInstall] = useState(true);
    const [scanBeforeUpdate, setScanBeforeUpdate] = useState(true);
    const [blockHighRisk, setBlockHighRisk] = useState(true);
    const [requireConfirmMedium, setRequireConfirmMedium] = useState(true);
    const [autoApproveLow, setAutoApproveLow] = useState(false);
    const [trustedSources, setTrustedSources] = useState<string[]>([]);

    // Storage info
    const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);

    // --- Helpers & Logic ---

    const buildAppConfig = (): AppConfigPayload => {
        return {
            default_sync_strategy: defaultStrategy,
            auto_sync_on_install: autoSyncOnInstall,
            check_updates_on_startup: checkUpdatesOnStartup,
            scan_before_install: scanBeforeInstall,
            scan_before_update: scanBeforeUpdate,
            block_high_risk: blockHighRisk,
            require_confirm_medium: requireConfirmMedium,
            auto_approve_low: autoApproveLow,
            trusted_sources: trustedSources,
            cloud_sync: {
                enabled: cloudSyncEnabled,
                provider: cloudProvider,
                sync_folder: cloudSyncFolder || null,
                auto_sync: cloudAutoSync,
                last_sync: cloudLastSync,
            },
        };
    };

    const saveAppConfig = async (config: AppConfigPayload) => {
        await invoke("save_app_config", { config });
    };

    const saveAllSettings = async () => {
        const config = buildAppConfig();
        await saveAppConfig(config);
        setSavedAppConfigSnapshot(serializeAppConfig(config));
        return config;
    };

    const serializeAppConfig = (config: AppConfigPayload) =>
        JSON.stringify({
            ...config,
            cloud_sync: {
                ...config.cloud_sync,
                last_sync: null,
            },
        });

    const normalizeCustomTool = (tool: ToolConfig): PersistedCustomTool => ({
        name: tool.name.trim(),
        globalPath: tool.globalPath.trim(),
        projectPath: tool.projectPath.trim(),
    });

    const buildCustomToolsSnapshot = (toolList: ToolConfig[]) =>
        Object.fromEntries(toolList.map((tool) => [tool.id, normalizeCustomTool(tool)]));

    const isAbsolutePath = (path: string) => {
        return path.startsWith("/") || path.startsWith("~/") || /^[A-Za-z]:[\\/]/.test(path);
    };

    const hasInvalidPathChars = (path: string) => {
        return path.includes("\0") || path.includes("\n") || path.includes("\r");
    };

    const validateBeforeSave = () => {
        const errors: string[] = [];
        if (!VALID_SYNC_STRATEGIES.has(defaultStrategy)) errors.push(t.settings.invalidSyncStrategy);

        if (cloudSyncEnabled) {
            if (!cloudProvider) errors.push(t.settings.cloudProviderRequired);
            else if (!VALID_CLOUD_PROVIDERS.has(cloudProvider)) errors.push(t.settings.invalidCloudProvider);

            if (!cloudSyncFolder.trim()) errors.push(t.settings.cloudFolderRequired);
        }

        if (cloudSyncFolder.trim() && hasInvalidPathChars(cloudSyncFolder.trim())) {
            errors.push(t.settings.invalidPathChars);
        }

        for (const tool of customTools) {
            const normalized = normalizeCustomTool(tool);
            if (!normalized.name) {
                errors.push(t.settings.invalidCustomToolName);
                continue;
            }
            if (normalized.globalPath && hasInvalidPathChars(normalized.globalPath)) {
                errors.push(`${t.settings.invalidPathChars}: ${tool.name}`);
                continue;
            }
            if (normalized.projectPath && hasInvalidPathChars(normalized.projectPath)) {
                errors.push(`${t.settings.invalidPathChars}: ${tool.name}`);
                continue;
            }
            if (normalized.projectPath && isAbsolutePath(normalized.projectPath)) {
                errors.push(`${t.settings.invalidCustomToolProjectPath}: ${tool.name}`);
            }
        }
        return errors;
    };

    // --- Effects ---

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const config = await invoke<{
                    default_sync_strategy: string;
                    auto_sync_on_install: boolean;
                    check_updates_on_startup: boolean;
                    scan_before_install: boolean;
                    scan_before_update: boolean;
                    block_high_risk: boolean;
                    require_confirm_medium: boolean;
                    auto_approve_low: boolean;
                    trusted_sources: string[];
                    cloud_sync: CloudSyncConfig;
                }>("get_app_config");

                const strategy = config.default_sync_strategy.toLowerCase();
                const syncFolder = config.cloud_sync?.sync_folder || "~/Documents";
                const provider = config.cloud_sync?.provider || null;

                setDefaultStrategy(strategy);
                setAutoSyncOnInstall(config.auto_sync_on_install);
                setCheckUpdatesOnStartup(config.check_updates_on_startup);
                setScanBeforeInstall(config.scan_before_install);
                setScanBeforeUpdate(config.scan_before_update);
                setBlockHighRisk(config.block_high_risk);
                setRequireConfirmMedium(config.require_confirm_medium);
                setAutoApproveLow(config.auto_approve_low);
                setTrustedSources(config.trusted_sources);

                if (config.cloud_sync) {
                    setCloudSyncEnabled(config.cloud_sync.enabled);
                    setCloudProvider(provider);
                    setCloudSyncFolder(syncFolder);
                    setCloudAutoSync(config.cloud_sync.auto_sync);
                    setCloudLastSync(config.cloud_sync.last_sync);
                }

                setSavedAppConfigSnapshot(
                    serializeAppConfig({
                        default_sync_strategy: strategy,
                        auto_sync_on_install: config.auto_sync_on_install,
                        check_updates_on_startup: config.check_updates_on_startup,
                        scan_before_install: config.scan_before_install,
                        scan_before_update: config.scan_before_update,
                        block_high_risk: config.block_high_risk,
                        require_confirm_medium: config.require_confirm_medium,
                        auto_approve_low: config.auto_approve_low,
                        trusted_sources: config.trusted_sources,
                        cloud_sync: {
                            enabled: config.cloud_sync?.enabled ?? false,
                            provider,
                            sync_folder: syncFolder,
                            auto_sync: config.cloud_sync?.auto_sync ?? false,
                            last_sync: config.cloud_sync?.last_sync ?? null,
                        },
                    })
                );
                setInitialized(true);
            } catch (error) {
                console.error("Failed to load config:", error);
                setSavedAppConfigSnapshot(serializeAppConfig(buildAppConfig()));
                setInitialized(true);
            }
        };
        loadConfig();
    }, []);

    useEffect(() => {
        const loadCustomTools = async () => {
            try {
                const savedTools = await invoke<CustomToolBackend[]>("list_custom_tools");
                const converted: ToolConfig[] = savedTools.map(t => ({
                    id: t.id,
                    name: t.name,
                    globalPath: t.global_path || "",
                    projectPath: t.project_path || "",
                    detected: true,
                    isCustom: true,
                    hasGlobalPath: !!t.global_path,
                }));
                setCustomTools(converted);
                setSavedCustomToolsSnapshot(buildCustomToolsSnapshot(converted));
            } catch (error) {
                console.error("Failed to load custom tools:", error);
            } finally {
                setCustomToolsLoaded(true);
            }
        };
        loadCustomTools();
    }, []);

    useEffect(() => {
        const loadStoreInfo = async () => {
            try {
                const info = await invoke<StoreInfo>("get_store_info");
                setStoreInfo(info);
            } catch (error) {
                console.error("Failed to load store info:", error);
            }
        };
        loadStoreInfo();
    }, []);

    useEffect(() => {
        const loadCloudDrives = async () => {
            try {
                const drives = await invoke<CloudDriveInfo[]>("detect_cloud_drives");
                setDetectedDrives(drives);
            } catch (error) {
                console.error("Failed to detect cloud drives:", error);
            }
        };
        loadCloudDrives();
    }, []);

    useEffect(() => {
        loadRegistries();
    }, []);

    // --- Logic Functions ---

    const handleCloudSync = async () => {
        setCloudSyncing(true);
        try {
            await saveAllSettings();
            const result = await invoke<{ pushed: string[]; pulled: string[] }>("cloud_sync_full");
            const config = await invoke<{ cloud_sync: CloudSyncConfig }>("get_app_config");
            setCloudLastSync(config.cloud_sync.last_sync);
            alert(`${t.settings.cloudSyncSuccess}: ${result.pushed.length} ${t.settings.skillsPushed}, ${result.pulled.length} ${t.settings.skillsPulled}`);
        } catch (error) {
            console.error("Cloud sync failed:", error);
            alert(String(error));
        } finally {
            setCloudSyncing(false);
        }
    };

    const handleCloudProviderChange = (provider: string) => {
        setCloudProvider(provider);
        if (provider === "Custom") {
            setCloudSyncFolder("~/Documents");
            return;
        }
        const drive = detectedDrives.find(d => d.provider === provider);
        if (drive) {
            setCloudSyncFolder(drive.path);
        } else {
            setCloudSyncFolder("~/Documents");
        }
    };

    const loadRegistries = async () => {
        try {
            const list = await invoke<RegistryConfig[]>("list_registries");
            setRegistries(list);
        } catch (error) {
            console.error("Failed to load registries:", error);
        }
    };

    const addRegistry = async () => {
        if (!newRegistryName.trim() || !newRegistryUrl.trim()) return;
        setIsRegistryLoading(true);

        try {
            await invoke("add_registry", {
                config: {
                    name: newRegistryName.trim(),
                    url: newRegistryUrl.trim(),
                    branch: newRegistryBranch.trim() || null,
                    description: newRegistryDescription.trim() || null,
                    enabled: true,
                    registry_type: "git",
                    tags: [],
                },
            });
            await loadRegistries();
            setNewRegistryName("");
            setNewRegistryUrl("");
            setNewRegistryBranch("");
            setNewRegistryDescription("");
            setShowAddRegistryModal(false);
        } catch (error) {
            console.error("Failed to add registry:", error);
        } finally {
            setIsRegistryLoading(false);
        }
    };

    const removeRegistry = async (name: string) => {
        try {
            await invoke("remove_registry", { name });
            await loadRegistries();
        } catch (error) {
            console.error("Failed to remove registry:", error);
        }
    };

    const toggleRegistry = async (registry: RegistryConfig) => {
        try {
            await invoke("add_registry", {
                config: {
                    ...registry,
                    enabled: !registry.enabled,
                },
            });
            await loadRegistries();
        } catch (error) {
            console.error("Failed to toggle registry:", error);
        }
    };

    const selectDirectory = async (setter: (path: string) => void) => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: t.settings.selectDirectory || "选择目录",
            });
            if (selected && typeof selected === "string") {
                setter(selected);
            }
        } catch (error) {
            console.error("Failed to select directory:", error);
        }
    };

    const toggleToolExpand = (toolId: string) => {
        setExpandedTools(prev => {
            const newSet = new Set(prev);
            if (newSet.has(toolId)) newSet.delete(toolId);
            else newSet.add(toolId);
            return newSet;
        });
    };

    const updateToolPath = (toolId: string, field: 'globalPath' | 'projectPath', value: string) => {
        setTools(prev => prev.map(tool => tool.id === toolId ? { ...tool, [field]: value } : tool));
        setCustomTools(prev => prev.map(tool => tool.id === toolId ? { ...tool, [field]: value } : tool));
    };

    const changedCustomTools = useMemo(() => {
        return customTools.filter((tool) => {
            const saved = savedCustomToolsSnapshot[tool.id];
            const current = normalizeCustomTool(tool);
            if (!saved) return true;
            return (
                saved.name !== current.name ||
                saved.globalPath !== current.globalPath ||
                saved.projectPath !== current.projectPath
            );
        });
    }, [customTools, savedCustomToolsSnapshot]);

    const appConfigChanged = useMemo(() => {
        if (!initialized || !savedAppConfigSnapshot) return false;
        return serializeAppConfig(buildAppConfig()) !== savedAppConfigSnapshot;
    }, [
        initialized,
        savedAppConfigSnapshot,
        defaultStrategy,
        autoSyncOnInstall,
        checkUpdatesOnStartup,
        scanBeforeInstall,
        scanBeforeUpdate,
        blockHighRisk,
        requireConfirmMedium,
        autoApproveLow,
        trustedSources,
        cloudSyncEnabled,
        cloudProvider,
        cloudSyncFolder,
        cloudAutoSync,
    ]);

    const hasPendingChanges = initialized && customToolsLoaded && (appConfigChanged || changedCustomTools.length > 0);

    const handleSaveButton = async () => {
        if (isSavingSettings) return;
        if (!hasPendingChanges) {
            alert(t.settings.noChangesToSave);
            return;
        }
        const validationErrors = validateBeforeSave();
        if (validationErrors.length > 0) {
            alert(`${t.settings.validationTitle}\n- ${validationErrors.join("\n- ")}`);
            return;
        }

        setIsSavingSettings(true);
        try {
            if (appConfigChanged) {
                const nextConfig = buildAppConfig();
                await saveAppConfig(nextConfig);
                setSavedAppConfigSnapshot(serializeAppConfig(nextConfig));
            }
            if (changedCustomTools.length > 0) {
                await Promise.all(
                    changedCustomTools.map((tool) =>
                        invoke("update_custom_tool", {
                            id: tool.id,
                            name: tool.name.trim(),
                            globalPath: tool.globalPath.trim() || null,
                            projectPath: tool.projectPath.trim() || null,
                        })
                    )
                );
                setSavedCustomToolsSnapshot(buildCustomToolsSnapshot(customTools));
            }
            alert(t.settings.saveSuccess);
        } catch (error) {
            console.error("Failed to save settings via button:", error);
            alert(`${t.settings.saveFailed}: ${String(error)}`);
        } finally {
            setIsSavingSettings(false);
        }
    };

    const addCustomTool = async () => {
        if (!newToolName.trim()) return;
        setIsLoading(true);
        try {
            const result = await invoke<CustomToolBackend>("add_custom_tool", {
                name: newToolName,
                globalPath: newToolGlobalPath.trim() || null,
                projectPath: newToolProjectPath.trim() || null,
            });
            const newTool: ToolConfig = {
                id: result.id,
                name: result.name,
                globalPath: result.global_path || "",
                projectPath: result.project_path || "",
                detected: true,
                isCustom: true,
                hasGlobalPath: !!result.global_path,
            };
            setCustomTools(prev => {
                const next = [...prev, newTool];
                setSavedCustomToolsSnapshot(buildCustomToolsSnapshot(next));
                return next;
            });
            setNewToolName("");
            setNewToolGlobalPath("");
            setNewToolProjectPath("");
            setShowAddToolModal(false);
        } catch (error) {
            console.error("Failed to add custom tool:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteCustomTool = async (toolId: string) => {
        try {
            await invoke("remove_custom_tool", { id: toolId });
            setCustomTools(prev => {
                const next = prev.filter(tool => tool.id !== toolId);
                setSavedCustomToolsSnapshot(buildCustomToolsSnapshot(next));
                return next;
            });
        } catch (error) {
            console.error("Failed to delete custom tool:", error);
        }
    };


    // --- Render Components ---

    const renderToolItem = (tool: ToolConfig) => {
        const isExpanded = expandedTools.has(tool.id);
        const matchesFilter = tool.name.toLowerCase().includes(toolFilter.toLowerCase());
        if (!matchesFilter) return null;

        return (
            <div key={tool.id} className="bg-base-200/50 rounded-xl overflow-hidden border border-base-300/50 transition-all duration-200">
                {/* Tool Header */}
                <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-base-300/30 transition-colors"
                    onClick={() => toggleToolExpand(tool.id)}
                >
                    <div className="flex items-center gap-3">
                        <span className="font-semibold text-base">{tool.name}</span>
                        <div className="flex gap-2">
                            {tool.detected ? (
                                <Badge variant="success" size="sm" className="hidden sm:inline-flex">{t.common.detected || "Detected"}</Badge>
                            ) : (
                                <Badge variant="neutral" size="sm" className="hidden sm:inline-flex">{t.common.notFound || "Not Found"}</Badge>
                            )}
                            {tool.isCustom && <Badge variant="primary" size="sm">{t.settings.customTool}</Badge>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {tool.isCustom && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-error hover:bg-error/10"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteCustomTool(tool.id);
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                    </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-base-300/50 pt-4 bg-base-300/10">
                        {/* Global Path */}
                        {tool.hasGlobalPath !== false && (
                            <div className="form-control">
                                <label className="label py-1">
                                    <span className="label-text text-xs font-medium text-base-content/60 uppercase tracking-wider">
                                        {t.settings.globalPath}
                                    </span>
                                </label>
                                <div className="join w-full">
                                    <input
                                        type="text"
                                        className="input input-bordered input-sm join-item flex-1 font-mono text-xs bg-base-100"
                                        value={tool.globalPath}
                                        onChange={(e) => updateToolPath(tool.id, 'globalPath', e.target.value)}
                                        placeholder={t.settings.noGlobalPath}
                                    />
                                    <button
                                        className="btn btn-ghost btn-sm join-item bg-base-200 border-base-300"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            selectDirectory((path) => updateToolPath(tool.id, 'globalPath', path));
                                        }}
                                    >
                                        <FolderOpen className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Project Path */}
                        <div className="form-control">
                            <label className="label py-1">
                                <span className="label-text text-xs font-medium text-base-content/60 uppercase tracking-wider">
                                    {t.settings.projectPath}
                                </span>
                            </label>
                            <div className="join w-full">
                                <input
                                    type="text"
                                    className="input input-bordered input-sm join-item flex-1 font-mono text-xs bg-base-100"
                                    value={tool.projectPath}
                                    onChange={(e) => updateToolPath(tool.id, 'projectPath', e.target.value)}
                                    placeholder=".tool/skills/"
                                />
                                <button className="btn btn-ghost btn-sm join-item bg-base-200 border-base-300">
                                    <FolderOpen className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const tabs = [
        { id: "general", label: t.settings.general, icon: SettingsIcon },
        { id: "tools", label: t.settings.toolConfiguration, icon: Server },
        { id: "sync", label: t.settings.cloudSync, icon: Cloud },
        { id: "security", label: t.settings.security, icon: Shield },
        { id: "about", label: t.common.about || "About", icon: Info },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                        {t.settings.title}
                    </h1>
                    <p className="text-base-content/60 mt-1">
                        {t.settings.description}
                    </p>
                </div>
                <Button
                    variant="primary"
                    className="shadow-lg shadow-primary/20"
                    onClick={handleSaveButton}
                    disabled={isSavingSettings || !initialized || !customToolsLoaded || !hasPendingChanges}
                    loading={isSavingSettings}
                >
                    {isSavingSettings ? (
                        <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {isSavingSettings ? t.common.loading : t.settings.saveSettings}
                </Button>
            </div>

            {/* Tabs */}
            <div className="tabs tabs-boxed bg-base-200/50 p-1 w-full md:w-auto inline-flex overflow-x-auto">
                {tabs.map((tab) => (
                    <a
                        key={tab.id}
                        className={`tab h-10 px-6 transition-all duration-200 rounded-lg ${activeTab === tab.id ? "bg-primary text-primary-content shadow-md" : "hover:bg-base-300"}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <tab.icon className="w-4 h-4 mr-2" />
                        {tab.label}
                    </a>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in">

                {/* General Tab */}
                {activeTab === "general" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title={t.settings.language} icon={<Languages className="w-5 h-5 text-primary" />}>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">{t.settings.languageDescription}</span>
                                </label>
                                <select
                                    className="select select-bordered w-full"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value as Language)}
                                >
                                    <option value="zh">{t.settings.chinese}</option>
                                    <option value="en">{t.settings.english}</option>
                                    <option value="ja">日本語</option>
                                    <option value="ko">한국어</option>
                                    <option value="fr">Français</option>
                                    <option value="de">Deutsch</option>
                                    <option value="es">Español</option>
                                    <option value="pt">Português</option>
                                    <option value="ru">Русский</option>
                                </select>
                            </div>
                        </Card>

                        <Card title={t.settings.theme} icon={<Palette className="w-5 h-5 text-accent" />}>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">{t.settings.themeDescription}</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        { mode: "auto" as ThemeMode, icon: Monitor, label: t.settings.themeAuto, desc: t.settings.themeAutoDescription },
                                        { mode: "light" as ThemeMode, icon: Sun, label: t.settings.themeLight, desc: t.settings.themeLightDescription },
                                        { mode: "dark" as ThemeMode, icon: Moon, label: t.settings.themeDark, desc: t.settings.themeDarkDescription },
                                    ]).map((opt) => (
                                        <button
                                            key={opt.mode}
                                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                                                themeMode === opt.mode
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-base-300 bg-base-200/50 text-base-content/60 hover:border-base-content/20"
                                            }`}
                                            onClick={() => setThemeMode(opt.mode)}
                                        >
                                            <opt.icon className="w-6 h-6" />
                                            <span className="text-sm font-medium">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </Card>

                        <Card title={t.settings.general} icon={<SettingsIcon className="w-5 h-5 text-secondary" />}>
                            <div className="space-y-4">
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">{t.settings.defaultSyncStrategy}</span>
                                    </label>
                                    <select
                                        className="select select-bordered w-full"
                                        value={defaultStrategy}
                                        onChange={(e) => setDefaultStrategy(e.target.value)}
                                    >
                                        <option value="auto">{t.settings.autoLinkFirst}</option>
                                        <option value="link">{t.settings.alwaysLink}</option>
                                        <option value="copy">{t.settings.alwaysCopy}</option>
                                    </select>
                                </div>
                                <div className="form-control">
                                    <label className="label cursor-pointer justify-start gap-4">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary"
                                            checked={autoSyncOnInstall}
                                            onChange={(e) => setAutoSyncOnInstall(e.target.checked)}
                                        />
                                        <span className="label-text">{t.settings.autoSyncOnInstall}</span>
                                    </label>
                                </div>
                                <div className="form-control">
                                    <label className="label cursor-pointer justify-start gap-4">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary"
                                            checked={checkUpdatesOnStartup}
                                            onChange={(e) => setCheckUpdatesOnStartup(e.target.checked)}
                                        />
                                        <span className="label-text">{t.settings.checkUpdatesOnStartup}</span>
                                    </label>
                                </div>
                            </div>
                        </Card>

                        <Card title={t.settings.storage} icon={<FolderOpen className="w-5 h-5 text-accent" />}>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">{t.settings.localStoreLocation}</span>
                                </label>
                                <div className="join w-full">
                                    <input
                                        type="text"
                                        className="input input-bordered join-item flex-1 font-mono text-sm"
                                        value={storeInfo?.path || t.common.loading}
                                        readOnly
                                    />
                                    <Button
                                        variant="ghost"
                                        className="join-item border-base-300 bg-base-200"
                                        onClick={() => storeInfo?.path && invoke("open_directory", { path: storeInfo.path })}
                                        disabled={!storeInfo?.path}
                                    >
                                        <FolderOpen className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <div className="bg-base-200/50 p-4 rounded-xl text-center">
                                    <div className="text-2xl font-bold">{storeInfo?.size_display || "--"}</div>
                                    <div className="text-xs text-base-content/60 uppercase tracking-wide mt-1">{t.settings.storageUsed}</div>
                                </div>
                                <div className="bg-base-200/50 p-4 rounded-xl text-center">
                                    <div className="text-2xl font-bold">{storeInfo?.skill_count ?? "--"}</div>
                                    <div className="text-xs text-base-content/60 uppercase tracking-wide mt-1">{t.settings.skillsStored}</div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Tools Tab */}
                {activeTab === "tools" && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-base-200/30 p-4 rounded-2xl border border-base-300/30 backdrop-blur-sm">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" />
                                <input
                                    type="text"
                                    className="input input-bordered pl-10 w-full bg-base-100"
                                    placeholder={t.common.search || "Search tools..."}
                                    value={toolFilter}
                                    onChange={(e) => setToolFilter(e.target.value)}
                                />
                            </div>
                            <Button
                                variant="primary"
                                onClick={() => setShowAddToolModal(true)}
                                className="w-full md:w-auto"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {t.settings.addCustomTool}
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {tools.map(renderToolItem)}
                            {customTools.length > 0 && (
                                <>
                                    <div className="divider text-base-content/30 text-sm font-medium">{t.settings.customTools}</div>
                                    {customTools.map(renderToolItem)}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Cloud & Sync Tab */}
                {activeTab === "sync" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Cloud Sync Config */}
                        <Card title={t.settings.cloudSync} icon={<Cloud className="w-5 h-5 text-primary" />}>
                            <div className="form-control mb-6">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        className="toggle toggle-primary toggle-lg"
                                        checked={cloudSyncEnabled}
                                        onChange={(e) => setCloudSyncEnabled(e.target.checked)}
                                    />
                                    <div>
                                        <span className="label-text font-medium block">{t.settings.cloudSync}</span>
                                        <span className="label-text-alt text-base-content/60">{t.settings.cloudSyncDescription}</span>
                                    </div>
                                </label>
                            </div>

                            {cloudSyncEnabled && (
                                <div className="space-y-4 bg-base-200/50 p-4 rounded-xl border border-base-300/50">
                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">{t.settings.cloudProvider}</span>
                                        </label>
                                        <select
                                            className="select select-bordered w-full"
                                            value={cloudProvider || ""}
                                            onChange={(e) => handleCloudProviderChange(e.target.value)}
                                        >
                                            <option value="" disabled>{t.settings.selectProvider}</option>
                                            {detectedDrives.map(d => (
                                                <option key={d.provider} value={d.provider}>{d.display_name}</option>
                                            ))}
                                            <option value="Custom">{t.settings.customFolder}</option>
                                        </select>
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">{t.settings.cloudSyncFolder}</span>
                                        </label>
                                        <div className="flex gap-2 w-full">
                                            <input
                                                type="text"
                                                className="input input-bordered flex-1 font-mono text-sm"
                                                value={cloudSyncFolder}
                                                onChange={(e) => setCloudSyncFolder(e.target.value)}
                                                readOnly={!!detectedDrives.find(d => d.provider === cloudProvider)}
                                            />
                                            {!detectedDrives.find(d => d.provider === cloudProvider) && (
                                                <Button
                                                    variant="ghost"
                                                    className="border-base-300 bg-base-100"
                                                    onClick={() => selectDirectory(setCloudSyncFolder)}
                                                >
                                                    <FolderOpen className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="form-control">
                                        <label className="label cursor-pointer justify-start gap-3">
                                            <input
                                                type="checkbox"
                                                className="toggle toggle-sm toggle-primary"
                                                checked={cloudAutoSync}
                                                onChange={(e) => setCloudAutoSync(e.target.checked)}
                                            />
                                            <span className="label-text">{t.settings.cloudAutoSync}</span>
                                        </label>
                                    </div>

                                    <div className="divider my-2"></div>

                                    <div className="flex items-center justify-between">
                                        <div className="text-xs text-base-content/50">
                                            {cloudLastSync ?
                                                `${t.settings.lastCloudSync}: ${new Date(Number(cloudLastSync) * 1000).toLocaleString()}` :
                                                "No sync history"}
                                        </div>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={handleCloudSync}
                                            disabled={cloudSyncing || !cloudSyncFolder}
                                            loading={cloudSyncing}
                                        >
                                            <RefreshCw className="w-3 h-3 mr-2" />
                                            {t.settings.syncNow}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Registries */}
                        <Card title={t.settings.registries} icon={<Globe className="w-5 h-5 text-secondary" />}>
                            <div className="flex justify-end mb-4">
                                <Button size="sm" variant="outline" onClick={() => setShowAddRegistryModal(true)}>
                                    <Plus className="w-4 h-4 mr-2" /> {t.settings.addRegistry}
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {registries.length === 0 ? (
                                    <div className="text-center py-8 text-base-content/50 bg-base-200/30 rounded-xl border border-dashed border-base-300">
                                        {t.common.loading || "No registries configuration"}
                                    </div>
                                ) : (
                                    registries.map((registry) => (
                                        <div key={registry.name} className="flex items-start gap-4 p-4 bg-base-200/50 rounded-xl border border-base-300/50 hover:border-primary/30 transition-colors">
                                            <input
                                                type="checkbox"
                                                className="toggle toggle-sm toggle-success mt-1"
                                                checked={registry.enabled}
                                                onChange={() => toggleRegistry(registry)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold">{registry.name}</span>
                                                    {registry.tags.map(tag => (
                                                        <Badge key={tag} variant="outline" size="xs">{tag}</Badge>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-base-content/60 font-mono mt-1 break-all select-all">
                                                    {registry.url}
                                                </p>
                                                {registry.description && (
                                                    <p className="text-xs text-base-content/50 mt-2 line-clamp-2">
                                                        {registry.description}
                                                    </p>
                                                )}
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-error" onClick={() => removeRegistry(registry.name)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Security Tab */}
                {activeTab === "security" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title={t.settings.security} icon={<Shield className="w-5 h-5 text-error" />}>
                            <div className="space-y-4">
                                <div className="form-control">
                                    <label className="label cursor-pointer justify-start gap-4 p-3 bg-base-200/30 rounded-lg hover:bg-base-200/50 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary"
                                            checked={scanBeforeInstall}
                                            onChange={(e) => setScanBeforeInstall(e.target.checked)}
                                        />
                                        <div>
                                            <span className="label-text block font-medium">{t.settings.scanBeforeInstall}</span>
                                            <span className="label-text-alt text-base-content/60">Scan code before adding to library</span>
                                        </div>
                                    </label>
                                </div>
                                <div className="form-control">
                                    <label className="label cursor-pointer justify-start gap-4 p-3 bg-base-200/30 rounded-lg hover:bg-base-200/50 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary"
                                            checked={scanBeforeUpdate}
                                            onChange={(e) => setScanBeforeUpdate(e.target.checked)}
                                        />
                                        <div>
                                            <span className="label-text block font-medium">{t.settings.scanBeforeUpdate}</span>
                                            <span className="label-text-alt text-base-content/60">Scan code before updating</span>
                                        </div>
                                    </label>
                                </div>
                                <div className="form-control">
                                    <label className="label cursor-pointer justify-start gap-4 p-3 bg-error/10 rounded-lg hover:bg-error/20 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-error"
                                            checked={blockHighRisk}
                                            onChange={(e) => setBlockHighRisk(e.target.checked)}
                                        />
                                        <div>
                                            <span className="label-text block font-medium text-error">{t.settings.blockHighRisk}</span>
                                            <span className="label-text-alt text-error/60">Automatically block high risk operations</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* About Tab */}
                {activeTab === "about" && (
                    <div className="max-w-2xl mx-auto text-center space-y-8 py-12">
                        <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-primary/30">
                            <LayoutGrid className="w-12 h-12 text-white" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-bold mb-2">SkillsHub</h2>
                            <p className="text-xl text-base-content/60">Unified AI Skills Management</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                            <div className="bg-base-200/50 p-4 rounded-xl">
                                <div className="text-sm text-base-content/50">Version</div>
                                <div className="font-mono font-medium">0.1.0</div>
                            </div>
                            <div className="bg-base-200/50 p-4 rounded-xl">
                                <div className="text-sm text-base-content/50">Build</div>
                                <div className="font-mono font-medium">alpha</div>
                            </div>
                        </div>
                        <div className="text-sm text-base-content/40">
                            © 2026 SkillsHub. All rights reserved.
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {/* Add Custom Tool Modal */}
            {showAddToolModal && (
                <div className="modal modal-open">
                    <div className="modal-box glass-panel">
                        <h3 className="font-bold text-lg mb-6">{t.settings.addCustomTool}</h3>
                        <div className="space-y-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">{t.settings.toolName}</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered"
                                    placeholder={t.settings.toolNamePlaceholder}
                                    value={newToolName}
                                    onChange={(e) => setNewToolName(e.target.value)}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">{t.settings.globalPath}</span>
                                </label>
                                <div className="join w-full">
                                    <input
                                        type="text"
                                        className="input input-bordered font-mono text-sm join-item flex-1"
                                        placeholder="~/.tool/skills/"
                                        value={newToolGlobalPath}
                                        onChange={(e) => setNewToolGlobalPath(e.target.value)}
                                    />
                                    <button
                                        className="btn btn-ghost join-item"
                                        onClick={() => selectDirectory(setNewToolGlobalPath)}
                                        type="button"
                                    >
                                        <FolderOpen className="w-4 h-4" />
                                    </button>
                                </div>
                                <span className="label-text-alt text-base-content/50 mt-1">
                                    {t.settings.globalPathHint}
                                </span>
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">{t.settings.projectPath}</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered font-mono text-sm"
                                    placeholder=".tool/skills/"
                                    value={newToolProjectPath}
                                    onChange={(e) => setNewToolProjectPath(e.target.value)}
                                />
                                <span className="label-text-alt text-base-content/50 mt-1">
                                    {t.settings.projectPathHint}
                                </span>
                            </div>
                        </div>
                        <div className="modal-action">
                            <Button variant="ghost" onClick={() => setShowAddToolModal(false)}>
                                {t.common.cancel}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={addCustomTool}
                                disabled={!newToolName.trim() || isLoading}
                                loading={isLoading}
                            >
                                {t.settings.addTool}
                            </Button>
                        </div>
                    </div>
                    <div className="modal-backdrop bg-base-100/80 backdrop-blur-sm" onClick={() => setShowAddToolModal(false)} />
                </div>
            )}

            {/* Add Registry Modal */}
            {showAddRegistryModal && (
                <div className="modal modal-open">
                    <div className="modal-box glass-panel">
                        <h3 className="font-bold text-lg mb-6">{t.settings.addRegistry}</h3>
                        <div className="space-y-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Name</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered"
                                    placeholder="my-registry"
                                    value={newRegistryName}
                                    onChange={(e) => setNewRegistryName(e.target.value)}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Git URL</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered font-mono text-sm"
                                    placeholder="https://github.com/user/repo"
                                    value={newRegistryUrl}
                                    onChange={(e) => setNewRegistryUrl(e.target.value)}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Branch (Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered font-mono text-sm"
                                    placeholder="main"
                                    value={newRegistryBranch}
                                    onChange={(e) => setNewRegistryBranch(e.target.value)}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Description (Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered"
                                    placeholder="Description..."
                                    value={newRegistryDescription}
                                    onChange={(e) => setNewRegistryDescription(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-action">
                            <Button variant="ghost" onClick={() => setShowAddRegistryModal(false)}>
                                {t.common.cancel}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={addRegistry}
                                disabled={!newRegistryName.trim() || !newRegistryUrl.trim() || isRegistryLoading}
                                loading={isRegistryLoading}
                            >
                                {t.settings.addRegistry}
                            </Button>
                        </div>
                    </div>
                    <div className="modal-backdrop bg-base-100/80 backdrop-blur-sm" onClick={() => setShowAddRegistryModal(false)} />
                </div>
            )}
        </div>
    );
}
