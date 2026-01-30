import { useState, useEffect } from "react";
import {
    Settings as SettingsIcon,
    FolderOpen,
    Globe,
    Shield,
    RefreshCw,
    Plus,
    Trash2,
    Check,
    Languages,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { useTranslation, useLanguage, type Language } from "../i18n";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

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
    { id: "qwen", name: "Qwen Code", globalPath: "~/.qwen/skills/", projectPath: ".qwen/skills/", detected: false, hasGlobalPath: true },
    { id: "roocode", name: "Roo Code", globalPath: "~/.roo/skills/", projectPath: ".roo/skills/", detected: false, hasGlobalPath: true },
    { id: "trae", name: "Trae", globalPath: "", projectPath: ".trae/skills/", detected: false, hasGlobalPath: false },
    { id: "windsurf", name: "Windsurf", globalPath: "~/.codeium/windsurf/skills/", projectPath: ".windsurf/skills/", detected: false, hasGlobalPath: true },
];

export default function Settings() {
    const t = useTranslation();
    const { language, setLanguage } = useLanguage();
    const [defaultStrategy, setDefaultStrategy] = useState("auto");
    const [tools, setTools] = useState<ToolConfig[]>(BUILTIN_TOOLS);
    const [customTools, setCustomTools] = useState<ToolConfig[]>([]);
    const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
    const [showAddToolModal, setShowAddToolModal] = useState(false);
    const [newToolName, setNewToolName] = useState("");
    const [newToolGlobalPath, setNewToolGlobalPath] = useState("");
    const [newToolProjectPath, setNewToolProjectPath] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // 加载已保存的自定义工具
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
            } catch (error) {
                console.error("Failed to load custom tools:", error);
            }
        };
        loadCustomTools();
    }, []);

    // 选择目录
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

    // 切换工具展开状态
    const toggleToolExpand = (toolId: string) => {
        setExpandedTools(prev => {
            const newSet = new Set(prev);
            if (newSet.has(toolId)) {
                newSet.delete(toolId);
            } else {
                newSet.add(toolId);
            }
            return newSet;
        });
    };

    // 更新工具路径
    const updateToolPath = (toolId: string, field: 'globalPath' | 'projectPath', value: string) => {
        setTools(prev => prev.map(tool =>
            tool.id === toolId ? { ...tool, [field]: value } : tool
        ));
        setCustomTools(prev => prev.map(tool =>
            tool.id === toolId ? { ...tool, [field]: value } : tool
        ));
    };

    // 添加自定义工具
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

            setCustomTools(prev => [...prev, newTool]);
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

    // 删除自定义工具
    const deleteCustomTool = async (toolId: string) => {
        try {
            await invoke("remove_custom_tool", { id: toolId });
            setCustomTools(prev => prev.filter(tool => tool.id !== toolId));
        } catch (error) {
            console.error("Failed to delete custom tool:", error);
        }
    };

    // 渲染工具配置项
    const renderToolItem = (tool: ToolConfig) => {
        const isExpanded = expandedTools.has(tool.id);

        return (
            <div key={tool.id} className="bg-base-300 rounded-lg overflow-hidden">
                {/* 工具标题行 */}
                <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-base-100/50"
                    onClick={() => toggleToolExpand(tool.id)}
                >
                    <div className="flex items-center gap-3">
                        <span className="font-medium">{tool.name}</span>
                        {tool.detected ? (
                            <span className="badge badge-success badge-sm">{t.common.detected}</span>
                        ) : (
                            <span className="badge badge-ghost badge-sm">{t.common.notFound}</span>
                        )}
                        {tool.isCustom && (
                            <span className="badge badge-primary badge-sm">{t.settings.customTool}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {tool.isCustom && (
                            <button
                                className="btn btn-ghost btn-sm text-error"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteCustomTool(tool.id);
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                        {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                    </div>
                </div>

                {/* 展开的路径配置 */}
                {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-base-100">
                        {/* 全局路径 */}
                        {tool.hasGlobalPath !== false && (
                            <div className="form-control">
                                <label className="label py-1">
                                    <span className="label-text text-sm text-base-content/70">
                                        {t.settings.globalPath}
                                    </span>
                                </label>
                                <div className="join w-full">
                                    <input
                                        type="text"
                                        className="input input-bordered input-sm join-item flex-1 font-mono text-xs"
                                        value={tool.globalPath}
                                        onChange={(e) => updateToolPath(tool.id, 'globalPath', e.target.value)}
                                        placeholder={t.settings.noGlobalPath}
                                    />
                                    <button
                                        className="btn btn-ghost btn-sm join-item"
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

                        {/* 项目路径 */}
                        <div className="form-control">
                            <label className="label py-1">
                                <span className="label-text text-sm text-base-content/70">
                                    {t.settings.projectPath}
                                </span>
                            </label>
                            <div className="join w-full">
                                <input
                                    type="text"
                                    className="input input-bordered input-sm join-item flex-1 font-mono text-xs"
                                    value={tool.projectPath}
                                    onChange={(e) => updateToolPath(tool.id, 'projectPath', e.target.value)}
                                    placeholder=".tool/skills/"
                                />
                                <button className="btn btn-ghost btn-sm join-item">
                                    <FolderOpen className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">{t.settings.title}</h1>
                <p className="text-base-content/60 mt-1">
                    {t.settings.description}
                </p>
            </div>

            {/* Language Settings */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <h3 className="card-title">
                        <Languages className="w-5 h-5" />
                        {t.settings.language}
                    </h3>
                    <div className="form-control mt-4">
                        <label className="label">
                            <span className="label-text">{t.settings.languageDescription}</span>
                        </label>
                        <select
                            className="select select-bordered w-full max-w-xs"
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
                </div>
            </div>

            {/* General Settings */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <h3 className="card-title">
                        <SettingsIcon className="w-5 h-5" />
                        {t.settings.general}
                    </h3>
                    <div className="form-control mt-4">
                        <label className="label">
                            <span className="label-text">{t.settings.defaultSyncStrategy}</span>
                        </label>
                        <select
                            className="select select-bordered w-full max-w-xs"
                            value={defaultStrategy}
                            onChange={(e) => setDefaultStrategy(e.target.value)}
                        >
                            <option value="auto">{t.settings.autoLinkFirst}</option>
                            <option value="link">{t.settings.alwaysLink}</option>
                            <option value="copy">{t.settings.alwaysCopy}</option>
                        </select>
                    </div>
                    <div className="form-control mt-4">
                        <label className="label cursor-pointer">
                            <span className="label-text">{t.settings.autoSyncOnInstall}</span>
                            <input type="checkbox" className="toggle toggle-primary" defaultChecked />
                        </label>
                    </div>
                    <div className="form-control">
                        <label className="label cursor-pointer">
                            <span className="label-text">{t.settings.checkUpdatesOnStartup}</span>
                            <input type="checkbox" className="toggle toggle-primary" defaultChecked />
                        </label>
                    </div>
                </div>
            </div>

            {/* Store Location */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <h3 className="card-title">
                        <FolderOpen className="w-5 h-5" />
                        {t.settings.storage}
                    </h3>
                    <div className="form-control mt-4">
                        <label className="label">
                            <span className="label-text">{t.settings.localStoreLocation}</span>
                        </label>
                        <div className="join w-full">
                            <input
                                type="text"
                                className="input input-bordered join-item flex-1 font-mono text-sm"
                                value="~/.local/share/skillshub/store"
                                readOnly
                            />
                            <button className="btn btn-ghost join-item">
                                <FolderOpen className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="stats bg-base-300 mt-4">
                        <div className="stat">
                            <div className="stat-title">{t.settings.storageUsed}</div>
                            <div className="stat-value text-lg">24 MB</div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">{t.settings.skillsStored}</div>
                            <div className="stat-value text-lg">12</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Registries */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <div className="flex items-center justify-between">
                        <h3 className="card-title">
                            <Globe className="w-5 h-5" />
                            {t.settings.registries}
                        </h3>
                        <button className="btn btn-primary btn-sm gap-2">
                            <Plus className="w-4 h-4" />
                            {t.settings.addRegistry}
                        </button>
                    </div>
                    <div className="space-y-3 mt-4">
                        {[
                            { name: "Official", url: "https://registry.skillshub.io", enabled: true },
                            { name: "Community", url: "https://community.skillshub.io", enabled: true },
                            { name: "Local", url: "~/.skillshub/local-registry", enabled: true },
                        ].map((registry) => (
                            <div
                                key={registry.name}
                                className="flex items-center justify-between p-4 bg-base-300 rounded-lg"
                            >
                                <div className="flex items-center gap-4">
                                    <input
                                        type="checkbox"
                                        className="toggle toggle-sm toggle-success"
                                        defaultChecked={registry.enabled}
                                    />
                                    <div>
                                        <p className="font-medium">{registry.name}</p>
                                        <p className="text-sm text-base-content/60 font-mono">
                                            {registry.url}
                                        </p>
                                    </div>
                                </div>
                                <button className="btn btn-ghost btn-sm text-error">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tool Paths */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <div className="flex items-center justify-between">
                        <h3 className="card-title">
                            <RefreshCw className="w-5 h-5" />
                            {t.settings.toolConfiguration}
                        </h3>
                        <button
                            className="btn btn-primary btn-sm gap-2"
                            onClick={() => setShowAddToolModal(true)}
                        >
                            <Plus className="w-4 h-4" />
                            {t.settings.addCustomTool}
                        </button>
                    </div>

                    <p className="text-sm text-base-content/60 mt-2">
                        {t.settings.toolConfigDescription}
                    </p>

                    <div className="space-y-2 mt-4">
                        {/* 内置工具 */}
                        {tools.map(renderToolItem)}

                        {/* 自定义工具 */}
                        {customTools.length > 0 && (
                            <>
                                <div className="divider text-sm text-base-content/50">
                                    {t.settings.customTools}
                                </div>
                                {customTools.map(renderToolItem)}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Security Settings */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <h3 className="card-title">
                        <Shield className="w-5 h-5" />
                        {t.settings.security}
                    </h3>
                    <div className="form-control mt-4">
                        <label className="label cursor-pointer">
                            <span className="label-text">{t.settings.scanBeforeInstall}</span>
                            <input type="checkbox" className="toggle toggle-primary" defaultChecked />
                        </label>
                    </div>
                    <div className="form-control">
                        <label className="label cursor-pointer">
                            <span className="label-text">{t.settings.scanBeforeUpdate}</span>
                            <input type="checkbox" className="toggle toggle-primary" defaultChecked />
                        </label>
                    </div>
                    <div className="form-control">
                        <label className="label cursor-pointer">
                            <span className="label-text">{t.settings.blockHighRisk}</span>
                            <input type="checkbox" className="toggle toggle-error" defaultChecked />
                        </label>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button className="btn btn-primary gap-2">
                    <Check className="w-4 h-4" />
                    {t.settings.saveSettings}
                </button>
            </div>

            {/* Add Custom Tool Modal */}
            {showAddToolModal && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">{t.settings.addCustomTool}</h3>
                        <div className="py-4 space-y-4">
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
                                <label className="label">
                                    <span className="label-text-alt text-base-content/50">
                                        {t.settings.globalPathHint}
                                    </span>
                                </label>
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
                                <label className="label">
                                    <span className="label-text-alt text-base-content/50">
                                        {t.settings.projectPathHint}
                                    </span>
                                </label>
                            </div>
                        </div>
                        <div className="modal-action">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowAddToolModal(false)}
                            >
                                {t.common.cancel}
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={addCustomTool}
                                disabled={!newToolName.trim() || isLoading}
                            >
                                {isLoading ? <span className="loading loading-spinner loading-sm"></span> : t.settings.addTool}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setShowAddToolModal(false)} />
                </div>
            )}
        </div>
    );
}
