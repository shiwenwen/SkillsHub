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
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* HUB VIEW */}
                        {activeTab === "hub" && filteredHub.map((skill) => (
                            <Card
                                key={skill.skill_id}
                                className="flex flex-col hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => navigate(`/skill/${skill.skill_id}`)}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Database className="w-5 h-5 text-primary" />
                                    </div>
                                    <span className="font-semibold break-all">{skill.skill_id}</span>
                                </div>
                                <div className="text-xs text-base-content/60 font-mono break-all mb-2">{skill.hub_path}</div>
                                <div className="flex gap-1 flex-wrap mb-3">
                                    {skill.synced_to.map(st => <Badge key={st} variant="success" className="opacity-80 text-[10px]">{st}</Badge>)}
                                </div>
                                <div className="mb-3">
                                    {skill.missing_in.length > 0 ? (
                                        <Badge variant="warning">{t.installed.missingIn} {skill.missing_in.length}</Badge>
                                    ) : (
                                        <Badge variant="success">{t.installed.fullySynced}</Badge>
                                    )}
                                </div>
                                <div className="mt-auto pt-3 border-t border-base-content/5 flex justify-end">
                                    <Button size="sm" variant="ghost" className="btn-xs" onClick={(e) => { e.stopPropagation(); navigate(`/skill/${skill.skill_id}`); }}>
                                        <Eye className="w-3 h-3 mr-1" /> {t.installed.view}
                                    </Button>
                                </div>
                            </Card>
                        ))}

                        {/* SCANNED VIEW */}
                        {activeTab === "scanned" && filteredScanned.map((skill) => (
                            <Card key={skill.id} className="flex flex-col">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                                        <Package className="w-5 h-5 text-secondary" />
                                    </div>
                                    <span className="font-semibold break-all">{skill.id}</span>
                                </div>
                                <div className="flex gap-1 flex-wrap mb-3">
                                    {skill.tools.map((toolItem, idx) => (
                                        <span key={idx} className="badge badge-ghost badge-sm gap-1 text-[10px]">
                                            {toolItem.is_link && <Link2 className="w-3 h-3" />}
                                            {toolItem.tool}
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-auto pt-3 border-t border-base-content/5 flex justify-between items-center">
                                    {skill.in_hub ? (
                                        <Badge variant="success">{t.installed.inHub}</Badge>
                                    ) : (
                                        <Badge variant="warning">{t.installed.notInHub}</Badge>
                                    )}
                                </div>
                            </Card>
                        ))}

                        {/* PLUGINS VIEW */}
                        {activeTab === "plugins" && filteredPlugins.map((skill) => (
                            <Card key={skill.id} className="flex flex-col">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                                        <Puzzle className="w-5 h-5 text-accent" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-semibold break-all">{skill.skill_name}</div>
                                        <div className="text-xs text-base-content/40 break-all">{skill.plugin_name}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap mb-3">
                                    <Badge variant="accent">{skill.marketplace}</Badge>
                                    <span className="text-xs text-base-content/40">v{skill.version}</span>
                                </div>
                                <div className="mt-auto pt-3 border-t border-base-content/5 flex justify-between items-center">
                                    <div className="text-xs text-base-content/60">
                                        {new Date(skill.installed_at).toLocaleDateString(language)}
                                    </div>
                                </div>
                            </Card>
                        ))}

                        {/* Empty States */}
                        {activeTab === "hub" && filteredHub.length === 0 && (
                            <div className="col-span-full p-12 text-center text-base-content/40">
                                <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>{t.installed.noSkillsInHub}</p>
                            </div>
                        )}
                        {activeTab === "scanned" && filteredScanned.length === 0 && (
                            <div className="col-span-full p-12 text-center text-base-content/40">
                                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>{t.installed.noScannedSkills}</p>
                            </div>
                        )}
                        {activeTab === "plugins" && filteredPlugins.length === 0 && (
                            <div className="col-span-full p-12 text-center text-base-content/40">
                                <Puzzle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>{t.installed.noPlugins}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
