import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
    ArrowLeft,
    Package,
    Shield,
    RefreshCw,
    Trash2,
    Clock,
    GitBranch,
    Check,
} from "lucide-react";
import { useTranslation } from "../i18n";

interface SkillInfo {
    id: string;
    name: string;
    version: string;
    description: string;
    source: string;
    installed_at: string;
    scan_passed: boolean;
    synced_tools: string[];
}

export default function SkillDetail() {
    const t = useTranslation();
    const { id } = useParams<{ id: string }>();
    const [skill, setSkill] = useState<SkillInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        if (id) {
            loadSkillInfo();
        }
    }, [id]);

    async function loadSkillInfo() {
        setLoading(true);
        try {
            const result = await invoke<SkillInfo>("get_skill_info", { skillId: id });
            setSkill(result);
        } catch (error) {
            console.error("Failed to load skill:", error);
        }
        setLoading(false);
    }

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    if (!skill) {
        return (
            <div className="card bg-base-200">
                <div className="card-body items-center text-center">
                    <h2 className="card-title">{t.skillDetail.skillNotFound}</h2>
                    <Link to="/" className="btn btn-primary mt-4">
                        {t.skillDetail.back}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Back Button */}
            <Link to="/" className="btn btn-ghost btn-sm gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t.skillDetail.back}
            </Link>

            {/* Header */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                                <Package className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">{skill.name}</h1>
                                <p className="text-base-content/60">{t.skillDetail.version} {skill.version}</p>
                                <div className="flex gap-2 mt-2">
                                    {skill.scan_passed ? (
                                        <span className="badge badge-success gap-1">
                                            <Shield className="w-3 h-3" /> {t.skillDetail.secure}
                                        </span>
                                    ) : (
                                        <span className="badge badge-error gap-1">
                                            <Shield className="w-3 h-3" /> {t.skillDetail.issuesFound}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm gap-2">
                                <RefreshCw className="w-4 h-4" />
                                {t.common.sync}
                            </button>
                            <button className="btn btn-error btn-sm gap-2">
                                <Trash2 className="w-4 h-4" />
                                {t.common.uninstall}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div role="tablist" className="tabs tabs-boxed bg-base-200 p-1">
                <button
                    role="tab"
                    className={`tab ${activeTab === "overview" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("overview")}
                >
                    {t.skillDetail.overview}
                </button>
                <button
                    role="tab"
                    className={`tab ${activeTab === "security" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("security")}
                >
                    {t.skillDetail.security}
                </button>
                <button
                    role="tab"
                    className={`tab ${activeTab === "sync" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("sync")}
                >
                    {t.skillDetail.syncStatus}
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card bg-base-200">
                        <div className="card-body">
                            <h3 className="card-title">{t.skillDetail.details}</h3>
                            <div className="space-y-4 mt-4">
                                <div className="flex items-center gap-3">
                                    <GitBranch className="w-5 h-5 text-base-content/60" />
                                    <div>
                                        <p className="text-sm text-base-content/60">{t.skillDetail.source}</p>
                                        <p className="font-mono text-sm">{skill.source}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-base-content/60" />
                                    <div>
                                        <p className="text-sm text-base-content/60">{t.skillDetail.installed}</p>
                                        <p>{new Date(parseInt(skill.installed_at) * 1000).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card bg-base-200">
                        <div className="card-body">
                            <h3 className="card-title">{t.skillDetail.syncedTools}</h3>
                            {skill.synced_tools.length > 0 ? (
                                <div className="space-y-2 mt-4">
                                    {skill.synced_tools.map((tool) => (
                                        <div
                                            key={tool}
                                            className="flex items-center justify-between p-3 bg-base-300 rounded-lg"
                                        >
                                            <span>{tool}</span>
                                            <Check className="w-4 h-4 text-success" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-base-content/60 mt-4">
                                    {t.skillDetail.notSyncedToAny}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "security" && (
                <div className="card bg-base-200">
                    <div className="card-body">
                        <h3 className="card-title">{t.skillDetail.securityScanResults}</h3>
                        <div className="alert alert-success mt-4">
                            <Shield className="w-5 h-5" />
                            <span>{t.skillDetail.passedAllChecks}</span>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "sync" && (
                <div className="card bg-base-200">
                    <div className="card-body">
                        <h3 className="card-title">{t.skillDetail.syncStatus}</h3>
                        <div className="overflow-x-auto mt-4">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>{t.skillDetail.tool}</th>
                                        <th>{t.skillDetail.status}</th>
                                        <th>{t.skillDetail.strategy}</th>
                                        <th>{t.skillDetail.actions}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {["Claude", "Cursor", "Gemini", "OpenCode"].map((tool) => (
                                        <tr key={tool}>
                                            <td>{tool}</td>
                                            <td>
                                                {skill.synced_tools.includes(tool.toLowerCase()) ? (
                                                    <span className="badge badge-success">{t.skillDetail.synced}</span>
                                                ) : (
                                                    <span className="badge badge-ghost">{t.skillDetail.notSynced}</span>
                                                )}
                                            </td>
                                            <td>{t.skillDetail.autoLink}</td>
                                            <td>
                                                <button className="btn btn-ghost btn-xs">
                                                    <RefreshCw className="w-3 h-3" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
