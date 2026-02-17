import { useState, useEffect, useMemo } from "react";
import {
    Settings as SettingsIcon,
    Shield,
    Save,
    Info,
    Server,
    Cloud,
} from "lucide-react";
import { useTranslation, useLanguage } from "../i18n";
import { useTheme } from "../theme";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "../components/ui/Button";

import type {
    CustomToolBackend,
    ToolConfig,
    StoreInfo,
    CloudDriveInfo,
    CloudSyncConfig,
    RegistryConfig,
    AppConfigPayload,
    PersistedCustomTool,
    DetectedToolInfo,
} from "./settings/types";
import { BUILTIN_TOOLS, VALID_SYNC_STRATEGIES, VALID_CLOUD_PROVIDERS } from "./settings/types";

import GeneralTab from "./settings/GeneralTab";
import ToolsTab from "./settings/ToolsTab";
import CloudSyncTab from "./settings/CloudSyncTab";
import SecurityTab from "./settings/SecurityTab";
import AboutTab from "./settings/AboutTab";
import AddToolModal from "./settings/AddToolModal";
import AddRegistryModal from "./settings/AddRegistryModal";

export default function Settings() {
    const t = useTranslation();
    const { language, setLanguage } = useLanguage();
    const { themeMode, setThemeMode } = useTheme();
    const [activeTab, setActiveTab] = useState("general");

    // Config State
    const [defaultStrategy, setDefaultStrategy] = useState("auto");
    const [toolSyncStrategies, setToolSyncStrategies] = useState<Record<string, string>>({});
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

    // Cloud Sync State
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
        const filteredStrategies: Record<string, string> = {};
        for (const [key, value] of Object.entries(toolSyncStrategies)) {
            if (value && value !== "") {
                filteredStrategies[key] = value;
            }
        }

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
            tool_sync_strategies: filteredStrategies,
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
                    tool_sync_strategies: Record<string, string>;
                    cloud_sync: CloudSyncConfig;
                }>("get_app_config");

                const strategy = config.default_sync_strategy.toLowerCase();
                const syncFolder = config.cloud_sync?.sync_folder || "~/Documents";
                const provider = config.cloud_sync?.provider || null;

                setDefaultStrategy(strategy);
                setToolSyncStrategies(config.tool_sync_strategies || {});
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
                        tool_sync_strategies: config.tool_sync_strategies || {},
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
        toolSyncStrategies,
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

    // --- Render ---

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
                {activeTab === "general" && (
                    <GeneralTab
                        language={language}
                        setLanguage={setLanguage}
                        themeMode={themeMode}
                        setThemeMode={setThemeMode}
                        defaultStrategy={defaultStrategy}
                        setDefaultStrategy={setDefaultStrategy}
                        autoSyncOnInstall={autoSyncOnInstall}
                        setAutoSyncOnInstall={setAutoSyncOnInstall}
                        checkUpdatesOnStartup={checkUpdatesOnStartup}
                        setCheckUpdatesOnStartup={setCheckUpdatesOnStartup}
                        storeInfo={storeInfo}
                        t={t}
                    />
                )}

                {activeTab === "tools" && (
                    <ToolsTab
                        tools={tools}
                        customTools={customTools}
                        toolFilter={toolFilter}
                        setToolFilter={setToolFilter}
                        expandedTools={expandedTools}
                        toggleToolExpand={toggleToolExpand}
                        updateToolPath={updateToolPath}
                        toolSyncStrategies={toolSyncStrategies}
                        setToolSyncStrategies={setToolSyncStrategies}
                        deleteCustomTool={deleteCustomTool}
                        setShowAddToolModal={setShowAddToolModal}
                        selectDirectory={selectDirectory}
                        t={t}
                    />
                )}

                {activeTab === "sync" && (
                    <CloudSyncTab
                        cloudSyncEnabled={cloudSyncEnabled}
                        setCloudSyncEnabled={setCloudSyncEnabled}
                        cloudProvider={cloudProvider}
                        handleCloudProviderChange={handleCloudProviderChange}
                        cloudSyncFolder={cloudSyncFolder}
                        setCloudSyncFolder={setCloudSyncFolder}
                        cloudAutoSync={cloudAutoSync}
                        setCloudAutoSync={setCloudAutoSync}
                        cloudLastSync={cloudLastSync}
                        cloudSyncing={cloudSyncing}
                        handleCloudSync={handleCloudSync}
                        detectedDrives={detectedDrives}
                        selectDirectory={selectDirectory}
                        registries={registries}
                        setShowAddRegistryModal={setShowAddRegistryModal}
                        toggleRegistry={toggleRegistry}
                        removeRegistry={removeRegistry}
                        t={t}
                    />
                )}

                {activeTab === "security" && (
                    <SecurityTab
                        scanBeforeInstall={scanBeforeInstall}
                        setScanBeforeInstall={setScanBeforeInstall}
                        scanBeforeUpdate={scanBeforeUpdate}
                        setScanBeforeUpdate={setScanBeforeUpdate}
                        blockHighRisk={blockHighRisk}
                        setBlockHighRisk={setBlockHighRisk}
                        t={t}
                    />
                )}

                {activeTab === "about" && (
                    <AboutTab t={t} />
                )}
            </div>

            {/* Modals */}
            {showAddToolModal && (
                <AddToolModal
                    newToolName={newToolName}
                    setNewToolName={setNewToolName}
                    newToolGlobalPath={newToolGlobalPath}
                    setNewToolGlobalPath={setNewToolGlobalPath}
                    newToolProjectPath={newToolProjectPath}
                    setNewToolProjectPath={setNewToolProjectPath}
                    addCustomTool={addCustomTool}
                    isLoading={isLoading}
                    onClose={() => setShowAddToolModal(false)}
                    selectDirectory={selectDirectory}
                    t={t}
                />
            )}

            {showAddRegistryModal && (
                <AddRegistryModal
                    newRegistryName={newRegistryName}
                    setNewRegistryName={setNewRegistryName}
                    newRegistryUrl={newRegistryUrl}
                    setNewRegistryUrl={setNewRegistryUrl}
                    newRegistryBranch={newRegistryBranch}
                    setNewRegistryBranch={setNewRegistryBranch}
                    newRegistryDescription={newRegistryDescription}
                    setNewRegistryDescription={setNewRegistryDescription}
                    addRegistry={addRegistry}
                    isRegistryLoading={isRegistryLoading}
                    onClose={() => setShowAddRegistryModal(false)}
                    t={t}
                />
            )}
        </div>
    );
}
