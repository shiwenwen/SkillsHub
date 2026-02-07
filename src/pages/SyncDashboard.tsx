import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
    RefreshCw,
    Check,
    AlertTriangle,
    Link as LinkIcon,
    Copy,
    Plus,
    FolderOpen,
    Pencil,
    ExternalLink,
    Zap,
    DownloadCloud
} from "lucide-react";
import { useTranslation } from "../i18n";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

interface ToolInfo {
    name: string;
    tool_type: string;
    detected: boolean;
    skills_dir: string | null;
    skills_dirs: string[];
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
    globalPaths: string[];
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

    // Modal States
    const [showAddToolModal, setShowAddToolModal] = useState(false);
    const [editingTool, setEditingTool] = useState<CustomToolBackend | null>(null);
    const [newToolName, setNewToolName] = useState("");
    const [newToolGlobalPath, setNewToolGlobalPath] = useState("");
    const [newToolProjectPath, setNewToolProjectPath] = useState("");
    const [isAdding, setIsAdding] = useState(false);

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

    const openAddModal = () => {
        setEditingTool(null);
        setNewToolName("");
        setNewToolGlobalPath("");
        setNewToolProjectPath("");
        setShowAddToolModal(true);
    };

    const openEditModal = (tool: CustomToolBackend) => {
        setEditingTool(tool);
        setNewToolName(tool.name);
        setNewToolGlobalPath(tool.global_path || "");
        setNewToolProjectPath(tool.project_path || "");
        setShowAddToolModal(true);
    };

    const saveCustomTool = async () => {
        if (!newToolName.trim()) return;
        setIsAdding(true);

        try {
            if (editingTool) {
                const result = await invoke<CustomToolBackend>("update_custom_tool", {
                    id: editingTool.id,
                    name: newToolName,
                    globalPath: newToolGlobalPath.trim() || null,
                    projectPath: newToolProjectPath.trim() || null,
                });
                setCustomTools(prev => prev.map(t => t.id === result.id ? result : t));
            } else {
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

    const openDirectory = async (path: string) => {
        try {
            await invoke("open_directory", { path });
        } catch (error) {
            console.error("Failed to open directory:", error);
        }
    };

    const viewToolDetail = (tool: ToolInfo | CustomToolBackend, type: "builtin" | "custom") => {
        if (type === "builtin") {
            const builtinTool = tool as ToolInfo;
            setSelectedTool({
                name: builtinTool.name,
                type: "builtin",
                globalPath: builtinTool.skills_dir,
                globalPaths: builtinTool.skills_dirs || [],
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
                globalPaths: customTool.global_path ? [customTool.global_path] : [],
                projectPath: customTool.project_path,
            });
        }
        setShowDetailModal(true);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                        {t.syncDashboard.title}
                    </h1>
                    <p className="text-base-content/60 mt-1">
                        {t.syncDashboard.description}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={loadData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        {t.common.refresh}
                    </Button>
                    <Button variant="primary" onClick={syncAll} disabled={syncing} loading={syncing} className="shadow-lg shadow-primary/20">
                        <Zap className="w-4 h-4 mr-2" />
                        {t.syncDashboard.syncAll}
                    </Button>
                </div>
            </div>

            {/* Tools Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="glass-card p-6 animate-pulse h-32">
                            <div className="h-6 bg-base-300 rounded w-24 mb-3"></div>
                            <div className="h-4 bg-base-300 rounded w-16"></div>
                        </div>
                    ))
                ) : (
                    <>
                        {/* Built-in Tools */}
                        {tools.map((tool) => (
                            <Card
                                key={tool.tool_type}
                                className={`cursor-pointer transition-all duration-200 group relative overflow-hidden ${tool.detected
                                    ? "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 border-primary/20 bg-primary/5"
                                    : "hover:border-base-content/20 opacity-70 hover:opacity-100"
                                    }`}
                                onClick={() => tool.detected && viewToolDetail(tool, "builtin")}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 rounded-lg ${tool.detected ? "bg-primary/10 text-primary" : "bg-base-200 text-base-content/40"}`}>
                                        <FolderOpen className="w-5 h-5" />
                                    </div>
                                    <Badge variant={tool.detected ? "success" : "neutral"} size="sm">
                                        {tool.detected ? t.syncDashboard.active : t.syncDashboard.notFound}
                                    </Badge>
                                </div>

                                <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{tool.name}</h3>

                                {tool.detected ? (
                                    <>
                                        <div className="text-xs text-base-content/50 font-mono truncate mb-3">
                                            {tool.skills_dir || 'Path not found'}
                                        </div>
                                        <div className="flex items-center justify-between text-sm pt-2 border-t border-base-200/50">
                                            <span className="font-medium">
                                                {tool.skill_count} <span className="text-base-content/50 font-normal">{t.syncDashboard.skillsSynced}</span>
                                            </span>
                                            <LinkIcon className="w-4 h-4 text-primary/50" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-xs text-base-content/40 mt-2">
                                        Not detected in standard locations
                                    </div>
                                )}
                            </Card>
                        ))}

                        {/* Custom Tools */}
                        {customTools.map((tool) => (
                            <Card
                                key={tool.id}
                                className="cursor-pointer transition-all duration-200 hover:border-secondary/50 hover:shadow-lg hover:shadow-secondary/5 border-secondary/20 bg-secondary/5 group relative"
                                onClick={() => viewToolDetail(tool, "custom")}
                            >
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        className="h-6 w-6 p-0 rounded-full bg-base-100/50 hover:bg-base-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal(tool);
                                        }}
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </Button>
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                                        <FolderOpen className="w-5 h-5" />
                                    </div>
                                    <Badge variant="secondary" size="sm">{t.settings.customTool}</Badge>
                                </div>

                                <h3 className="font-bold text-lg mb-1 group-hover:text-secondary transition-colors">{tool.name}</h3>
                                <div className="text-xs text-base-content/50 font-mono truncate mb-2">
                                    {tool.global_path || tool.project_path || "-"}
                                </div>
                            </Card>
                        ))}

                        {/* Add Tool Card */}
                        <div
                            className="glass-card flex flex-col items-center justify-center p-6 border-dashed border-2 border-base-300 hover:border-primary hover:bg-base-200/30 cursor-pointer transition-all duration-200 min-h-[160px] group"
                            onClick={openAddModal}
                        >
                            <div className="w-12 h-12 rounded-full bg-base-200 group-hover:bg-primary/10 flex items-center justify-center mb-3 transition-colors">
                                <Plus className="w-6 h-6 text-base-content/40 group-hover:text-primary transition-colors" />
                            </div>
                            <span className="font-medium text-base-content/60 group-hover:text-primary transition-colors">
                                {t.settings.addCustomTool}
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Drift Detection */}
            <Card title={t.syncDashboard.driftDetection} icon={<AlertTriangle className="w-5 h-5 text-warning" />}>
                {drifts.length === 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-success/10 text-success rounded-xl border border-success/20">
                        <Check className="w-5 h-5" />
                        <span className="font-medium">{t.syncDashboard.allInSync}</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr className="text-base-content/60 border-b border-base-200/50">
                                    <th>{t.security.skill}</th>
                                    <th>{t.syncDashboard.tool}</th>
                                    <th>{t.syncDashboard.issue}</th>
                                    <th>{t.syncDashboard.actions}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {drifts.map((drift, i) => (
                                    <tr key={i} className="hover:bg-base-200/30 transition-colors border-b border-base-200/30 last:border-0">
                                        <td className="font-medium">{drift.skill_id}</td>
                                        <td>{drift.tool}</td>
                                        <td>
                                            <Badge variant="warning" size="sm">
                                                {drift.drift_type}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Button variant="ghost" size="xs">{t.syncDashboard.repair}</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Sync Strategy Info */}
            <Card title={t.syncDashboard.syncStrategy} icon={<DownloadCloud className="w-5 h-5 text-info" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 flex items-start gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <LinkIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-primary mb-1">{t.syncDashboard.linkRecommended}</h4>
                            <p className="text-sm text-base-content/70 leading-relaxed">
                                {t.syncDashboard.linkDesc}
                            </p>
                        </div>
                    </div>
                    <div className="p-5 rounded-xl border border-base-300 bg-base-200/30 flex items-start gap-4">
                        <div className="p-2 bg-base-200 rounded-lg text-base-content/60">
                            <Copy className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-base-content mb-1">{t.syncDashboard.copy}</h4>
                            <p className="text-sm text-base-content/60 leading-relaxed">
                                {t.syncDashboard.copyDesc}
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Modals */}
            {/* Add/Edit Custom Tool Modal */}
            {showAddToolModal && createPortal(
                <div className="modal modal-open">
                    <div className="modal-box glass-panel max-w-lg">
                        <h3 className="font-bold text-lg mb-6">
                            {editingTool ? t.settings.customTool || "Edit Custom Tool" : t.settings.addCustomTool}
                        </h3>
                        <div className="space-y-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">{t.settings.toolName}</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered w-full"
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
                                    className="input input-bordered font-mono text-sm w-full"
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
                            <Button variant="ghost" onClick={() => {
                                setShowAddToolModal(false);
                                setEditingTool(null);
                            }}>
                                {t.common.cancel}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={saveCustomTool}
                                disabled={!newToolName.trim() || isAdding}
                                loading={isAdding}
                            >
                                {editingTool ? t.common.save : t.settings.addTool}
                            </Button>
                        </div>
                    </div>
                    <div className="modal-backdrop bg-base-100/80 backdrop-blur-sm" onClick={() => {
                        setShowAddToolModal(false);
                        setEditingTool(null);
                    }} />
                </div>,
                document.body
            )}

            {/* Tool Detail Modal */}
            {showDetailModal && selectedTool && createPortal(
                <div className="modal modal-open">
                    <div className="modal-box glass-panel">
                        <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
                            {selectedTool.name}
                            <Badge variant={selectedTool.type === "custom" ? "primary" : "success"}>
                                {selectedTool.type === "custom" ? t.settings.customTool : "Built-in"}
                            </Badge>
                        </h3>

                        <div className="space-y-6">
                            {/* Built-in Status */}
                            {selectedTool.type === "builtin" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-base-200/50 p-3 rounded-xl border border-base-300/50">
                                        <div className="text-xs text-base-content/50 uppercase font-bold mb-1">Status</div>
                                        <Badge variant={selectedTool.detected ? "success" : "neutral"} size="sm">
                                            {selectedTool.detected ? t.syncDashboard.active : t.syncDashboard.notFound}
                                        </Badge>
                                    </div>
                                    {selectedTool.detected && selectedTool.skillCount !== undefined && (
                                        <div className="bg-base-200/50 p-3 rounded-xl border border-base-300/50">
                                            <div className="text-xs text-base-content/50 uppercase font-bold mb-1">Synced Skills</div>
                                            <div className="text-lg font-bold">{selectedTool.skillCount}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Global Config */}
                            {selectedTool.globalPaths && selectedTool.globalPaths.length > 0 && (
                                <div>
                                    <h4 className="font-bold mb-2 flex items-center justify-between">
                                        {t.settings.globalPath}
                                        {selectedTool.globalPaths.length > 1 && (
                                            <Badge variant="ghost" size="xs">{selectedTool.globalPaths.length} paths</Badge>
                                        )}
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedTool.globalPaths.map((path, index) => (
                                            <div key={index} className="flex items-center gap-2 bg-base-200/50 rounded-lg p-3 border border-base-300/50">
                                                <code className="text-xs text-base-content/80 font-mono flex-1 break-all select-all">
                                                    {path}
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="xs"
                                                    className="btn-square h-8 w-8"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openDirectory(path);
                                                    }}
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Project Path Config */}
                            {selectedTool.projectPath && (
                                <div>
                                    <h4 className="font-bold mb-2">{t.settings.projectPath}</h4>
                                    <div className="bg-base-200/50 rounded-lg p-3 border border-base-300/50">
                                        <code className="text-xs text-base-content/80 font-mono break-all select-all block">
                                            {selectedTool.projectPath}
                                        </code>
                                        <p className="text-xs text-base-content/40 mt-2">
                                            (Relative from project root)
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* No config warning */}
                            {!selectedTool.globalPath && !selectedTool.projectPath && (
                                <div className="alert alert-warning shadow-sm">
                                    <AlertTriangle className="w-5 h-5" />
                                    <span>No paths configured for this tool</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-action">
                            <Button variant="primary" onClick={() => {
                                setShowDetailModal(false);
                                setSelectedTool(null);
                            }}>
                                {t.common.close}
                            </Button>
                        </div>
                    </div>
                    <div className="modal-backdrop bg-base-100/80 backdrop-blur-sm" onClick={() => {
                        setShowDetailModal(false);
                        setSelectedTool(null);
                    }} />
                </div>,
                document.body
            )}
        </div>
    );
}
