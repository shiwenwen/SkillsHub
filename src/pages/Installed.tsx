import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    Package,
    RefreshCw,
    Puzzle,
    Database,
    FolderSync,
    Link2,
    Search,
    Eye
} from "lucide-react";
import { useTranslation, useLanguage } from "../i18n";
import { useUpdateCheck } from "../hooks/useUpdateCheck";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

// Interfaces
interface ScannedSkillInfo {
    id: string;
    path: string;
    tool: string;
    in_hub: boolean;
    is_link: boolean;
}

interface HubStatusInfo {
    skill_id: string;
    hub_path: string;
    synced_to: string[];
    missing_in: string[];
}

interface FullSyncResponse {
    collected_count: number;
    collected_skills: string[];
    distributed_count: number;
    distributed: { skill_id: string; tool: string; success: boolean }[];
}

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
    const { language } = useLanguage();
    const [scannedSkills, setScannedSkills] = useState<ScannedSkillInfo[]>([]);
    const [hubStatus, setHubStatus] = useState<HubStatusInfo[]>([]);
    const [pluginSkills, setPluginSkills] = useState<PluginSkillInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const [activeTab, setActiveTab] = useState<"hub" | "scanned" | "plugins">("hub");
    const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    const {
        isChecking,
        checkUpdates,
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
        showToast("info", t.installed.fullSyncing);
        try {
            const result = await invoke<FullSyncResponse>("full_sync_skills");
            showToast(
                "success",
                t.installed.fullSyncSuccess.replace("{collected}", result.collected_count.toString()).replace("{distributed}", result.distributed_count.toString())
            );
            await loadAll();
        } catch (error) {
            console.error("Full sync failed:", error);
            showToast("error", t.installed.fullSyncFailed.replace("{error}", String(error)));
        }
        setSyncing(false);
    }

    // Group scanned skills
    const groupedScanned = scannedSkills.reduce((acc, skill) => {
        if (!acc[skill.id]) {
            acc[skill.id] = { id: skill.id, tools: [], in_hub: skill.in_hub };
        }
        acc[skill.id].tools.push({ tool: skill.tool, is_link: skill.is_link, path: skill.path });
        return acc;
    }, {} as Record<string, { id: string; tools: { tool: string; is_link: boolean; path: string }[]; in_hub: boolean }>);

    const uniqueScannedSkills = Object.values(groupedScanned);

    // Filter logic
    const filteredHub = hubStatus.filter((s) => s.skill_id.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredScanned = uniqueScannedSkills.filter((s) => s.id.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredPlugins = pluginSkills.filter((s) =>
        s.skill_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.plugin_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className="toast toast-top toast-end z-50">
                    <div className={`alert ${toast.type === "success" ? "alert-success" :
                        toast.type === "error" ? "alert-error" : "alert-info"
                        } shadow-lg rounded-xl`}>
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            {/* Header / Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Database className="w-24 h-24" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-base-content/60">{t.installed.hubStorage}</p>
                        <h2 className="text-3xl font-bold mt-1">{hubStatus.length}</h2>
                        <div className="flex items-center gap-2 mt-2 text-xs text-success">
                            <span className="badge badge-xs badge-success"></span>
                            {t.installed.synced}
                        </div>
                    </div>
                </Card>
                <Card className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Package className="w-24 h-24" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-base-content/60">{t.installed.localScanned}</p>
                        <h2 className="text-3xl font-bold mt-1">{uniqueScannedSkills.length}</h2>
                        <div className="flex items-center gap-2 mt-2 text-xs text-info">
                            <span className="badge badge-xs badge-info"></span>
                            {t.installed.active}
                        </div>
                    </div>
                </Card>
                <Card className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Puzzle className="w-24 h-24" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-base-content/60">{t.installed.plugins}</p>
                        <h2 className="text-3xl font-bold mt-1">{pluginSkills.length}</h2>
                        <div className="flex items-center gap-2 mt-2 text-xs text-accent">
                            <span className="badge badge-xs badge-accent"></span>
                            {t.common.installed}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                {/* Tabs */}
                <div className="flex bg-base-200/50 p-1 rounded-xl">
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "hub" ? "bg-base-100 text-primary shadow-sm" : "text-base-content/60 hover:text-base-content"}`}
                        onClick={() => setActiveTab("hub")}
                    >
                        {t.installed.hubView}
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "scanned" ? "bg-base-100 text-primary shadow-sm" : "text-base-content/60 hover:text-base-content"}`}
                        onClick={() => setActiveTab("scanned")}
                    >
                        {t.installed.scannedView}
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "plugins" ? "bg-base-100 text-primary shadow-sm" : "text-base-content/60 hover:text-base-content"}`}
                        onClick={() => setActiveTab("plugins")}
                    >
                        {t.installed.pluginsView}
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                        <input
                            type="text"
                            placeholder={t.installed.searchPlaceholder || "Search skills..."}
                            className="input input-sm input-bordered rounded-lg pl-9 w-full sm:w-64 bg-base-200/50 focus:bg-base-100 transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleFullSync}
                        isLoading={syncing}
                    >
                        <FolderSync className="w-4 h-4 mr-2" />
                        {t.installed.syncAll}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={checkUpdates}
                        isLoading={isChecking}
                        className="btn-square"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Main Content List */}
            <Card className="min-h-[400px]" noPadding>
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr className="border-b border-base-content/5 text-base-content/50 text-xs uppercase">
                                    <th className="bg-transparent pl-6">{t.installed.skillName}</th>
                                    <th className="bg-transparent">{t.installed.details}</th>
                                    <th className="bg-transparent">{t.installed.status}</th>
                                    <th className="bg-transparent text-right pr-6">{t.installed.actions}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* HUB VIEW */}
                                {activeTab === "hub" && filteredHub.map((skill) => (
                                    <tr
                                        key={skill.skill_id}
                                        className="hover:bg-base-content/5 transition-colors group border-b border-base-content/5 last:border-0 cursor-pointer"
                                        onClick={() => navigate(`/skill/${skill.skill_id}`)}
                                    >
                                        <td className="pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                                                    <Database className="w-4 h-4 text-primary" />
                                                </div>
                                                <span className="font-semibold">{skill.skill_id}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-xs text-base-content/60 font-mono">{skill.hub_path}</div>
                                            <div className="flex gap-1 mt-1">
                                                {skill.synced_to.map(t => <Badge key={t} variant="success" className="opacity-80 text-[10px]">{t}</Badge>)}
                                            </div>
                                        </td>
                                        <td>
                                            {skill.missing_in.length > 0 ? (
                                                <Badge variant="warning">{t.installed.missingIn} {skill.missing_in.length}</Badge>
                                            ) : (
                                                <Badge variant="success">{t.installed.fullySynced}</Badge>
                                            )}
                                        </td>
                                        <td className="text-right pr-6">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="sm" variant="ghost" className="btn-xs" onClick={() => navigate(`/skill/${skill.skill_id}`)}>
                                                    <Eye className="w-3 h-3 mr-1" /> {t.installed.view}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {/* SCANNED VIEW */}
                                {activeTab === "scanned" && filteredScanned.map((skill) => (
                                    <tr key={skill.id} className="hover:bg-base-content/5 transition-colors group border-b border-base-content/5 last:border-0">
                                        <td className="pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-secondary/10 flex items-center justify-center">
                                                    <Package className="w-4 h-4 text-secondary" />
                                                </div>
                                                <span className="font-semibold">{skill.id}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex gap-1 flex-wrap">
                                                {skill.tools.map((t, idx) => (
                                                    <span key={idx} className="badge badge-ghost badge-sm gap-1 text-[10px]">
                                                        {t.is_link && <Link2 className="w-3 h-3" />}
                                                        {t.tool}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            {skill.in_hub ? (
                                                <Badge variant="success">{t.installed.inHub}</Badge>
                                            ) : (
                                                <Badge variant="warning">{t.installed.notInHub}</Badge>
                                            )}
                                        </td>
                                        <td className="text-right pr-6">
                                            {/* Actions placeholder */}
                                        </td>
                                    </tr>
                                ))}

                                {/* PLUGINS VIEW */}
                                {activeTab === "plugins" && filteredPlugins.map((skill) => (
                                    <tr key={skill.id} className="hover:bg-base-content/5 transition-colors group border-b border-base-content/5 last:border-0">
                                        <td className="pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center">
                                                    <Puzzle className="w-4 h-4 text-accent" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{skill.skill_name}</div>
                                                    <div className="text-xs text-base-content/40">{skill.plugin_name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="accent">{skill.marketplace}</Badge>
                                                <span className="text-xs text-base-content/40">v{skill.version}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-xs text-base-content/60">
                                                {new Date(skill.installed_at).toLocaleDateString(language)}
                                            </div>
                                        </td>
                                        <td className="text-right pr-6">
                                            {/* Actions */}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Empty States */}
                        {!loading && activeTab === "hub" && filteredHub.length === 0 && (
                            <div className="p-12 text-center text-base-content/40">
                                <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>{t.installed.noSkillsInHub}</p>
                            </div>
                        )}
                        {!loading && activeTab === "scanned" && filteredScanned.length === 0 && (
                            <div className="p-12 text-center text-base-content/40">
                                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>{t.installed.noScannedSkills}</p>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}
