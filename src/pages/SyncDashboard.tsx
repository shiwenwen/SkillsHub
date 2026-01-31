import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { open as openPath } from "@tauri-apps/plugin-shell";
import {
    RefreshCw,
    Check,
    AlertTriangle,
    Link as LinkIcon,
    Copy,
    ArrowRight,
    Plus,
    FolderOpen,
    Pencil,
    ExternalLink,
} from "lucide-react";
import { useTranslation } from "../i18n";

interface ToolInfo {
    name: string;
    tool_type: string;
    detected: boolean;
    skills_dir: string | null;
    skill_count: number;
}

interface DriftInfo {
    skill_id: string;
    tool: string;
    drift_type: string;
}

interface CustomToolBackend {
    id: string;
    name: string;
    global_path: string | null;
    project_path: string | null;
}

interface ToolDetail {
    name: string;
    type: "builtin" | "custom";
    globalPath: string | null;
    projectPath: string | null;
    detected?: boolean;
    skillCount?: number;
}

export default function SyncDashboard() {
    const t = useTranslation();
    const [tools, setTools] = useState<ToolInfo[]>([]);
    const [customTools, setCustomTools] = useState<CustomToolBackend[]>([]);
    const [drifts, setDrifts] = useState<DriftInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    // 添加/编辑自定义工具模态框状态
    const [showAddToolModal, setShowAddToolModal] = useState(false);
    const [editingTool, setEditingTool] = useState<CustomToolBackend | null>(null);
    const [newToolName, setNewToolName] = useState("");
    const [newToolGlobalPath, setNewToolGlobalPath] = useState("");
    const [newToolProjectPath, setNewToolProjectPath] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    // 工具详情模态框状态
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTool, setSelectedTool] = useState<ToolDetail | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [toolsResult, driftsResult, customToolsResult] = await Promise.all([
                invoke<ToolInfo[]>("list_tools"),
                invoke<[string, string, string][]>("check_drift"),
                invoke<CustomToolBackend[]>("list_custom_tools"),
            ]);
            setTools(toolsResult);
            setDrifts(
                driftsResult.map(([skill_id, tool, drift_type]) => ({
                    skill_id,
                    tool,
                    drift_type,
                }))
            );
            setCustomTools(customToolsResult);
        } catch (error) {
            console.error("Failed to load data:", error);
        }
        setLoading(false);
    }

    async function syncAll() {
        setSyncing(true);
        try {
            await invoke("sync_skills", { skillIds: [], tools: [] });
            await loadData();
        } catch (error) {
            console.error("Sync failed:", error);
        }
        setSyncing(false);
    }

    // 选择目录
    const selectDirectory = async (setter: (path: string) => void) => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: t.settings.selectDirectory,
            });
            if (selected && typeof selected === "string") {
                setter(selected);
            }
        } catch (error) {
            console.error("Failed to select directory:", error);
        }
    };

    // 打开添加模态框
    const openAddModal = () => {
        setEditingTool(null);
        setNewToolName("");
        setNewToolGlobalPath("");
        setNewToolProjectPath("");
        setShowAddToolModal(true);
    };

    // 打开编辑模态框
    const openEditModal = (tool: CustomToolBackend) => {
        setEditingTool(tool);
        setNewToolName(tool.name);
        setNewToolGlobalPath(tool.global_path || "");
        setNewToolProjectPath(tool.project_path || "");
        setShowAddToolModal(true);
    };

    // 添加或更新自定义工具
    const saveCustomTool = async () => {
        if (!newToolName.trim()) return;
        setIsAdding(true);

        try {
            if (editingTool) {
                // 更新现有工具
                const result = await invoke<CustomToolBackend>("update_custom_tool", {
                    id: editingTool.id,
                    name: newToolName,
                    globalPath: newToolGlobalPath.trim() || null,
                    projectPath: newToolProjectPath.trim() || null,
                });
                setCustomTools(prev => prev.map(t => t.id === result.id ? result : t));
            } else {
                // 添加新工具
                const result = await invoke<CustomToolBackend>("add_custom_tool", {
                    name: newToolName,
                    globalPath: newToolGlobalPath.trim() || null,
                    projectPath: newToolProjectPath.trim() || null,
                });
                setCustomTools(prev => [...prev, result]);
            }

            setNewToolName("");
            setNewToolGlobalPath("");
            setNewToolProjectPath("");
            setShowAddToolModal(false);
            setEditingTool(null);
        } catch (error) {
            console.error("Failed to save custom tool:", error);
        } finally {
            setIsAdding(false);
        }
    };

    // 打开目录
    const openDirectory = async (path: string) => {
        try {
            await openPath(path);
        } catch (error) {
            console.error("Failed to open directory:", error);
        }
    };

    // 查看工具详情
    const viewToolDetail = (tool: ToolInfo | CustomToolBackend, type: "builtin" | "custom") => {
        if (type === "builtin") {
            const builtinTool = tool as ToolInfo;
            setSelectedTool({
                name: builtinTool.name,
                type: "builtin",
                globalPath: builtinTool.skills_dir,
                projectPath: null,
                detected: builtinTool.detected,
                skillCount: builtinTool.skill_count,
            });
        } else {
            const customTool = tool as CustomToolBackend;
            setSelectedTool({
                name: customTool.name,
                type: "custom",
                globalPath: customTool.global_path,
                projectPath: customTool.project_path,
            });
        }
        setShowDetailModal(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{t.syncDashboard.title}</h1>
                    <p className="text-base-content/60 mt-1">
                        {t.syncDashboard.description}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadData}
                        className="btn btn-ghost btn-sm gap-2"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        {t.common.refresh}
                    </button>
                    <button
                        onClick={syncAll}
                        className="btn btn-primary btn-sm gap-2"
                        disabled={syncing}
                    >
                        {syncing ? (
                            <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                            <ArrowRight className="w-4 h-4" />
                        )}
                        {t.syncDashboard.syncAll}
                    </button>
                </div>
            </div>

            {/* Tools Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="card bg-base-200 animate-pulse">
                            <div className="card-body">
                                <div className="h-6 bg-base-300 rounded w-24"></div>
                                <div className="h-4 bg-base-300 rounded w-32 mt-2"></div>
                            </div>
                        </div>
                    ))
                ) : (
                    <>
                        {tools.map((tool) => (
                            <div
                                key={tool.tool_type}
                                className={`card ${tool.detected ? "bg-base-200 cursor-pointer hover:shadow-lg transition-shadow" : "bg-base-200/50"
                                    }`}
                                onClick={() => tool.detected && viewToolDetail(tool, "builtin")}
                            >
                                <div className="card-body">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold truncate" title={tool.name}>{tool.name}</h3>
                                        {tool.detected ? (
                                            <span className="badge badge-success badge-sm whitespace-nowrap">{t.syncDashboard.active}</span>
                                        ) : (
                                            <span className="badge badge-ghost badge-sm whitespace-nowrap">
                                                {t.syncDashboard.notFound}
                                            </span>
                                        )}
                                    </div>
                                    {tool.detected && (
                                        <>
                                            <p className="text-sm text-base-content/60 font-mono truncate" title={tool.skills_dir || ''}>
                                                {tool.skills_dir}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-sm">
                                                    {tool.skill_count} {t.syncDashboard.skillsSynced}
                                                </span>
                                                <div className="flex gap-1">
                                                    <div className="tooltip" data-tip="Symlink">
                                                        <LinkIcon className="w-4 h-4 text-success" />
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* 自定义工具卡片 */}
                        {customTools.map((tool) => (
                            <div
                                key={tool.id}
                                className="card bg-base-200 cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => viewToolDetail(tool, "custom")}
                            >
                                <div className="card-body">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold truncate" title={tool.name}>{tool.name}</h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                className="btn btn-ghost btn-xs btn-circle"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditModal(tool);
                                                }}
                                                title="Edit"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                            <span className="badge badge-primary badge-sm whitespace-nowrap">{t.settings.customTool}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-base-content/60 font-mono truncate" title={tool.global_path || tool.project_path || ''}>
                                        {tool.global_path || tool.project_path || "-"}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* 添加自定义工具卡片 */}
                        <div
                            className="card bg-base-200/50 border-2 border-dashed border-base-300 hover:border-primary cursor-pointer transition-colors"
                            onClick={openAddModal}
                        >
                            <div className="card-body items-center justify-center text-center">
                                <Plus className="w-8 h-8 text-base-content/40" />
                                <span className="text-sm text-base-content/60">{t.settings.addCustomTool}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Drift Detection */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <h3 className="card-title">
                        <AlertTriangle className="w-5 h-5" />
                        {t.syncDashboard.driftDetection}
                    </h3>
                    {drifts.length === 0 ? (
                        <div className="alert alert-success mt-4">
                            <Check className="w-5 h-5" />
                            <span>{t.syncDashboard.allInSync}</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto mt-4">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>{t.security.skill}</th>
                                        <th>{t.syncDashboard.tool}</th>
                                        <th>{t.syncDashboard.issue}</th>
                                        <th>{t.syncDashboard.actions}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drifts.map((drift, i) => (
                                        <tr key={i}>
                                            <td>{drift.skill_id}</td>
                                            <td>{drift.tool}</td>
                                            <td>
                                                <span className="badge badge-warning">
                                                    {drift.drift_type}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="btn btn-ghost btn-xs">{t.syncDashboard.repair}</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Sync Strategy */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <h3 className="card-title">{t.syncDashboard.syncStrategy}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                            <div className="flex items-center gap-3">
                                <LinkIcon className="w-6 h-6 text-primary" />
                                <div>
                                    <h4 className="font-bold">{t.syncDashboard.linkRecommended}</h4>
                                    <p className="text-sm text-base-content/60">
                                        {t.syncDashboard.linkDesc}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 rounded-lg border border-base-300">
                            <div className="flex items-center gap-3">
                                <Copy className="w-6 h-6 text-base-content/60" />
                                <div>
                                    <h4 className="font-bold">{t.syncDashboard.copy}</h4>
                                    <p className="text-sm text-base-content/60">
                                        {t.syncDashboard.copyDesc}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add/Edit Custom Tool Modal */}
            {showAddToolModal && createPortal(
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">
                            {editingTool ? "Edit Custom Tool" : t.settings.addCustomTool}
                        </h3>
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
                                onClick={() => {
                                    setShowAddToolModal(false);
                                    setEditingTool(null);
                                }}
                            >
                                {t.common.cancel}
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={saveCustomTool}
                                disabled={!newToolName.trim() || isAdding}
                            >
                                {isAdding ? <span className="loading loading-spinner loading-sm"></span> : (editingTool ? t.common.save : t.settings.addTool)}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => {
                        setShowAddToolModal(false);
                        setEditingTool(null);
                    }} />
                </div>,
                document.body
            )}

            {/* Tool Detail Modal */}
            {showDetailModal && selectedTool && createPortal(
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">{selectedTool.name}</h3>

                        <div className="space-y-4">
                            {/* 工具类型 */}
                            <div>
                                <label className="label">
                                    <span className="label-text font-semibold">Type</span>
                                </label>
                                <span className={`badge ${selectedTool.type === "custom" ? "badge-primary" : "badge-success"}`}>
                                    {selectedTool.type === "custom" ? t.settings.customTool : "Built-in"}
                                </span>
                            </div>

                            {/* 内置工具的额外信息 */}
                            {selectedTool.type === "builtin" && (
                                <>
                                    <div>
                                        <label className="label">
                                            <span className="label-text font-semibold">Status</span>
                                        </label>
                                        <span className={`badge ${selectedTool.detected ? "badge-success" : "badge-ghost"}`}>
                                            {selectedTool.detected ? t.syncDashboard.active : t.syncDashboard.notFound}
                                        </span>
                                    </div>
                                    {selectedTool.detected && selectedTool.skillCount !== undefined && (
                                        <div>
                                            <label className="label">
                                                <span className="label-text font-semibold">Skills Synced</span>
                                            </label>
                                            <p className="text-base-content">{selectedTool.skillCount}</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* 全局路径 */}
                            {selectedTool.globalPath && (
                                <div>
                                    <label className="label">
                                        <span className="label-text font-semibold">{t.settings.globalPath}</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-base-content/80 font-mono flex-1 break-all">
                                            {selectedTool.globalPath}
                                        </p>
                                        <button
                                            className="btn btn-ghost btn-sm btn-square"
                                            onClick={() => openDirectory(selectedTool.globalPath!)}
                                            title="Open Directory"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 项目路径 */}
                            {selectedTool.projectPath && (
                                <div>
                                    <label className="label">
                                        <span className="label-text font-semibold">{t.settings.projectPath}</span>
                                    </label>
                                    <p className="text-sm text-base-content/80 font-mono break-all">
                                        {selectedTool.projectPath}
                                    </p>
                                    <p className="text-xs text-base-content/50 mt-1">
                                        (Relative path from project root)
                                    </p>
                                </div>
                            )}

                            {/* 如果两个路径都没有 */}
                            {!selectedTool.globalPath && !selectedTool.projectPath && (
                                <div className="alert">
                                    <AlertTriangle className="w-5 h-5" />
                                    <span>No paths configured for this tool</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-action">
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    setShowDetailModal(false);
                                    setSelectedTool(null);
                                }}
                            >
                                {t.common.close}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => {
                        setShowDetailModal(false);
                        setSelectedTool(null);
                    }} />
                </div>,
                document.body
            )}
        </div>
    );
}
