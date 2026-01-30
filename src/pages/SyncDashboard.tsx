import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
    RefreshCw,
    Check,
    AlertTriangle,
    Link as LinkIcon,
    Copy,
    ArrowRight,
    Plus,
    FolderOpen,
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

export default function SyncDashboard() {
    const t = useTranslation();
    const [tools, setTools] = useState<ToolInfo[]>([]);
    const [customTools, setCustomTools] = useState<CustomToolBackend[]>([]);
    const [drifts, setDrifts] = useState<DriftInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    // 添加自定义工具模态框状态
    const [showAddToolModal, setShowAddToolModal] = useState(false);
    const [newToolName, setNewToolName] = useState("");
    const [newToolGlobalPath, setNewToolGlobalPath] = useState("");
    const [newToolProjectPath, setNewToolProjectPath] = useState("");
    const [isAdding, setIsAdding] = useState(false);

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

    // 添加自定义工具
    const addCustomTool = async () => {
        if (!newToolName.trim()) return;
        setIsAdding(true);

        try {
            const result = await invoke<CustomToolBackend>("add_custom_tool", {
                name: newToolName,
                globalPath: newToolGlobalPath.trim() || null,
                projectPath: newToolProjectPath.trim() || null,
            });

            setCustomTools(prev => [...prev, result]);
            setNewToolName("");
            setNewToolGlobalPath("");
            setNewToolProjectPath("");
            setShowAddToolModal(false);
        } catch (error) {
            console.error("Failed to add custom tool:", error);
        } finally {
            setIsAdding(false);
        }
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
                                className={`card ${tool.detected ? "bg-base-200" : "bg-base-200/50"
                                    }`}
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
                                className="card bg-base-200"
                            >
                                <div className="card-body">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold truncate" title={tool.name}>{tool.name}</h3>
                                        <span className="badge badge-primary badge-sm whitespace-nowrap">{t.settings.customTool}</span>
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
                            onClick={() => setShowAddToolModal(true)}
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
                                disabled={!newToolName.trim() || isAdding}
                            >
                                {isAdding ? <span className="loading loading-spinner loading-sm"></span> : t.settings.addTool}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setShowAddToolModal(false)} />
                </div>
            )}
        </div>
    );
}
