import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    RefreshCw,
    Check,
    AlertTriangle,
    Link as LinkIcon,
    Copy,
    ArrowRight,
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

export default function SyncDashboard() {
    const t = useTranslation();
    const [tools, setTools] = useState<ToolInfo[]>([]);
    const [drifts, setDrifts] = useState<DriftInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [toolsResult, driftsResult] = await Promise.all([
                invoke<ToolInfo[]>("list_tools"),
                invoke<[string, string, string][]>("check_drift"),
            ]);
            setTools(toolsResult);
            setDrifts(
                driftsResult.map(([skill_id, tool, drift_type]) => ({
                    skill_id,
                    tool,
                    drift_type,
                }))
            );
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
                    tools.map((tool) => (
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
                    ))
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
        </div>
    );
}
