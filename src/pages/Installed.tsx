import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { Package, RefreshCw, Puzzle, Database, FolderSync, Link2, ArrowUpCircle, Check, Search } from "lucide-react";
import { useTranslation } from "../i18n";
import { useUpdateCheck } from "../hooks/useUpdateCheck";

// 扫描到的 skill 信息
interface ScannedSkillInfo {
    id: string;
    path: string;
    tool: string;
    in_hub: boolean;
    is_link: boolean;
}

// Hub 状态信息
interface HubStatusInfo {
    skill_id: string;
    hub_path: string;
    synced_to: string[];
    missing_in: string[];
}

// 完整同步响应
interface FullSyncResponse {
    collected_count: number;
    collected_skills: string[];
    distributed_count: number;
    distributed: { skill_id: string; tool: string; success: boolean }[];
}

// Claude Plugin Skill
interface PluginSkillInfo {
    id: string;
    plugin_name: string;
    marketplace: string;
    skill_name: string;
    skill_path: string;
    version: string;
    commit_sha: string | null;
    installed_at: string;
}

export default function Installed() {
    const t = useTranslation();
    const [scannedSkills, setScannedSkills] = useState<ScannedSkillInfo[]>([]);
    const [hubStatus, setHubStatus] = useState<HubStatusInfo[]>([]);
    const [pluginSkills, setPluginSkills] = useState<PluginSkillInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState<"hub" | "scanned" | "plugins">("hub");
    const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    // 更新检查
    const {
        availableUpdates,
        isChecking,
        checkUpdates,
        updateSkill,
        isUpdating,
    } = useUpdateCheck();

    const showToast = (type: "success" | "error" | "info", message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        loadAll();
    }, []);

    async function loadAll() {
        setLoading(true);
        try {
            const [scanned, status, plugins] = await Promise.all([
                invoke<ScannedSkillInfo[]>("scan_all_skills"),
                invoke<HubStatusInfo[]>("get_hub_status"),
                invoke<PluginSkillInfo[]>("scan_claude_plugins"),
            ]);
            setScannedSkills(scanned);
            setHubStatus(status);
            setPluginSkills(plugins);
        } catch (error) {
            console.error("Failed to load:", error);
            showToast("error", `加载失败: ${error}`);
        }
        setLoading(false);
    }

    async function handleFullSync() {
        setSyncing(true);
        showToast("info", "正在执行完整同步...");
        try {
            const result = await invoke<FullSyncResponse>("full_sync_skills");
            showToast(
                "success",
                `✓ 同步完成: 收集 ${result.collected_count} 个, 分发 ${result.distributed_count} 次`
            );
            await loadAll();
        } catch (error) {
            console.error("Full sync failed:", error);
            showToast("error", `同步失败: ${error}`);
        }
        setSyncing(false);
    }

    // 按 skill ID 分组扫描结果
    const groupedScanned = scannedSkills.reduce((acc, skill) => {
        if (!acc[skill.id]) {
            acc[skill.id] = { id: skill.id, tools: [], in_hub: skill.in_hub };
        }
        acc[skill.id].tools.push({ tool: skill.tool, is_link: skill.is_link, path: skill.path });
        return acc;
    }, {} as Record<string, { id: string; tools: { tool: string; is_link: boolean; path: string }[]; in_hub: boolean }>);

    const uniqueScannedSkills = Object.values(groupedScanned);

    return (
        <>
            <div className="space-y-6">
                {/* Toast */}
                {toast && (
                    <div className="toast toast-top toast-end z-50">
                        <div className={`alert ${toast.type === "success" ? "alert-success" :
                            toast.type === "error" ? "alert-error" : "alert-info"
                            }`}>
                            <span>{toast.message}</span>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{t.installed.title}</h1>
                        <p className="text-base-content/60 mt-1">
                            管理 SkillsHub 中央仓库和各工具的 Skills
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={checkUpdates}
                            disabled={isChecking}
                            className="btn btn-outline btn-sm gap-2"
                        >
                            <ArrowUpCircle className={`w-4 h-4 ${isChecking ? "animate-pulse" : ""}`} />
                            {isChecking ? t.installed.checkingUpdates || "检查中..." : t.installed.checkUpdates || "检查更新"}
                            {availableUpdates.length > 0 && (
                                <span className="badge badge-error badge-sm">{availableUpdates.length}</span>
                            )}
                        </button>
                        <button
                            onClick={loadAll}
                            disabled={loading}
                            className="btn btn-ghost btn-sm gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                            {t.common.refresh}
                        </button>
                        <button
                            onClick={handleFullSync}
                            disabled={syncing}
                            className="btn btn-primary btn-sm gap-2"
                        >
                            <FolderSync className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                            {syncing ? t.installed.syncing || "同步中..." : t.installed.fullSync || "完整同步"}
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="form-control">
                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
                        <input
                            type="text"
                            placeholder={t.installed.searchPlaceholder || "搜索 Skills..."}
                            className="input input-bordered w-full pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="stats shadow bg-base-200 w-full">
                    <div className="stat">
                        <div className="stat-figure text-primary">
                            <Database className="w-8 h-8" />
                        </div>
                        <div className="stat-title">Hub 中的 Skills</div>
                        <div className="stat-value text-primary">{hubStatus.length}</div>
                    </div>
                    <div className="stat">
                        <div className="stat-figure text-secondary">
                            <Package className="w-8 h-8" />
                        </div>
                        <div className="stat-title">扫描到的 Skills</div>
                        <div className="stat-value text-secondary">{uniqueScannedSkills.length}</div>
                    </div>
                    <div className="stat">
                        <div className="stat-figure text-accent">
                            <Puzzle className="w-8 h-8" />
                        </div>
                        <div className="stat-title">Claude Plugins</div>
                        <div className="stat-value text-accent">{pluginSkills.length}</div>
                    </div>
                </div>

                {/* 可用更新提示 */}
                {availableUpdates.length > 0 && (
                    <div className="alert alert-info shadow-lg">
                        <ArrowUpCircle className="w-6 h-6" />
                        <div className="flex-1">
                            <h3 className="font-bold">{t.installed.updatesAvailable || "有可用更新"}</h3>
                            <p className="text-sm">
                                {availableUpdates.length} {t.installed.skillsCanUpdate || "个 Skills 可以更新"}
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {availableUpdates.slice(0, 3).map((u) => (
                                <button
                                    key={u.skill_id}
                                    onClick={() => updateSkill(u.skill_id)}
                                    disabled={isUpdating === u.skill_id}
                                    className="btn btn-sm btn-primary"
                                >
                                    {isUpdating === u.skill_id ? (
                                        <span className="loading loading-spinner loading-xs"></span>
                                    ) : (
                                        <Check className="w-3 h-3" />
                                    )}
                                    {u.skill_id}
                                </button>
                            ))}
                            {availableUpdates.length > 3 && (
                                <span className="badge badge-outline">+{availableUpdates.length - 3}</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="tabs tabs-boxed bg-base-200 p-1">
                    <button
                        className={`tab ${activeTab === "hub" ? "tab-active" : ""}`}
                        onClick={() => setActiveTab("hub")}
                    >
                        <Database className="w-4 h-4 mr-2" />
                        Hub 仓库 ({hubStatus.length})
                    </button>
                    <button
                        className={`tab ${activeTab === "scanned" ? "tab-active" : ""}`}
                        onClick={() => setActiveTab("scanned")}
                    >
                        <Package className="w-4 h-4 mr-2" />
                        已扫描 ({uniqueScannedSkills.length})
                    </button>
                    <button
                        className={`tab ${activeTab === "plugins" ? "tab-active" : ""}`}
                        onClick={() => setActiveTab("plugins")}
                    >
                        <Puzzle className="w-4 h-4 mr-2" />
                        Claude Plugins ({pluginSkills.length})
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                ) : (
                    <>
                        {/* Hub Tab */}
                        {activeTab === "hub" && (
                            <>
                                {hubStatus.length === 0 ? (
                                    <div className="card bg-base-200">
                                        <div className="card-body items-center text-center py-12">
                                            <Database className="w-16 h-16 text-base-content/30" />
                                            <h2 className="card-title mt-4">Hub 仓库为空</h2>
                                            <p className="text-base-content/60">
                                                点击"完整同步"从各工具收集 Skills 到 Hub
                                            </p>
                                            <button onClick={handleFullSync} className="btn btn-primary mt-4">
                                                <FolderSync className="w-4 h-4 mr-2" />
                                                完整同步
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {hubStatus
                                            .filter((skill) =>
                                                skill.skill_id.toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .map((skill) => (
                                                <div key={skill.skill_id} className="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer" onClick={() => navigate(`/skill/${skill.skill_id}`)}>
                                                    <div className="card-body">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                                                <Database className="w-6 h-6 text-primary" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="font-bold truncate">{skill.skill_id}</h3>
                                                                <p className="text-xs text-base-content/50 truncate">{skill.hub_path}</p>
                                                            </div>
                                                        </div>

                                                        <div className="mt-3">
                                                            <p className="text-xs text-base-content/60 mb-1">已同步到:</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {skill.synced_to.map((tool) => (
                                                                    <span key={tool} className="badge badge-success badge-sm">{tool}</span>
                                                                ))}
                                                                {skill.synced_to.length === 0 && (
                                                                    <span className="text-xs text-base-content/40">无</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {skill.missing_in.length > 0 && (
                                                            <div className="mt-2">
                                                                <p className="text-xs text-base-content/60 mb-1">缺失于:</p>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {skill.missing_in.map((tool) => (
                                                                        <span key={tool} className="badge badge-warning badge-sm badge-outline">{tool}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Scanned Tab */}
                        {activeTab === "scanned" && (
                            <>
                                {uniqueScannedSkills.length === 0 ? (
                                    <div className="card bg-base-200">
                                        <div className="card-body items-center text-center py-12">
                                            <Package className="w-16 h-16 text-base-content/30" />
                                            <h2 className="card-title mt-4">未扫描到任何 Skills</h2>
                                            <p className="text-base-content/60">
                                                各工具的 skills 目录为空
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {uniqueScannedSkills
                                            .filter((skill) =>
                                                skill.id.toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .map((skill) => (
                                                <div key={skill.id} className="card bg-base-200 hover:bg-base-300 transition-colors">
                                                    <div className="card-body">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center">
                                                                <Package className="w-6 h-6 text-secondary" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="font-bold truncate">{skill.id}</h3>
                                                                <p className="text-xs text-base-content/50">
                                                                    {skill.in_hub ? (
                                                                        <span className="text-success">✓ 在 Hub 中</span>
                                                                    ) : (
                                                                        <span className="text-warning">⚠ 不在 Hub 中</span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="mt-3">
                                                            <p className="text-xs text-base-content/60 mb-1">存在于:</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {skill.tools.map((t, idx) => (
                                                                    <span key={idx} className="badge badge-outline badge-sm gap-1">
                                                                        {t.is_link && <Link2 className="w-3 h-3" />}
                                                                        {t.tool}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Plugins Tab */}
                        {activeTab === "plugins" && (
                            <>
                                {pluginSkills.length === 0 ? (
                                    <div className="card bg-base-200">
                                        <div className="card-body items-center text-center py-12">
                                            <Puzzle className="w-16 h-16 text-base-content/30" />
                                            <h2 className="card-title mt-4">无 Claude Plugins</h2>
                                            <p className="text-base-content/60">
                                                在 Claude Code 中安装 plugins 后会显示在这里
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {pluginSkills
                                            .filter((skill) =>
                                                skill.skill_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                skill.plugin_name.toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .map((skill) => (
                                                <div key={skill.id} className="card bg-base-200 hover:bg-base-300 transition-colors">
                                                    <div className="card-body">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
                                                                <Puzzle className="w-6 h-6 text-accent" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="font-bold truncate">{skill.skill_name}</h3>
                                                                <p className="text-sm text-base-content/60 truncate">{skill.plugin_name}</p>
                                                            </div>
                                                        </div>

                                                        <div className="text-xs text-base-content/50 mt-2 truncate">
                                                            {skill.skill_path}
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 mt-3">
                                                            <span className="badge badge-accent badge-sm">{skill.marketplace}</span>
                                                            <span className="badge badge-outline badge-sm">v{skill.version.substring(0, 7)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
