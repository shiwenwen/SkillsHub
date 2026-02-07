import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
    ArrowLeft,
    Package,
    Shield,
    RefreshCw,
    Trash2,
    FolderOpen,
    FileText,
    Folder,
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

interface ToolInfo {
    name: string;
    tool_type: string;
    detected: boolean;
}

interface SyncResult {
    skill_id: string;
    tool: string;
    success: boolean;
    error: string | null;
}

interface SecurityFinding {
    rule_name: string;
    risk_level: string;
    description: string;
    file: string;
    line: number | null;
    recommendation: string;
}

interface SecurityScanResult {
    skill_id: string;
    passed: boolean;
    overall_risk: string;
    findings: SecurityFinding[];
}

interface SkillDetailInfo {
    id: string;
    name: string;
    skill_path: string;
    skill_md_content: string | null;
    files: SkillFileInfo[];
    synced_tools: SyncedToolInfo[];
}

interface SkillFileInfo {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
}

interface SyncedToolInfo {
    tool_name: string;
    tool_type: string;
    is_synced: boolean;
    is_link: boolean;
    path: string | null;
}

function getRiskBadgeClass(risk: string): string {
    const normalized = risk.trim().toUpperCase();
    if (normalized === "BLOCK" || normalized === "HIGH") {
        return "badge-error";
    }
    if (normalized === "MEDIUM") {
        return "badge-warning";
    }
    return "badge-info";
}

export default function SkillDetail() {
    const t = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [skill, setSkill] = useState<SkillInfo | null>(null);
    const [skillDetail, setSkillDetail] = useState<SkillDetailInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [toolsLoading, setToolsLoading] = useState(true);
    const [syncingAll, setSyncingAll] = useState(false);
    const [refreshingTool, setRefreshingTool] = useState<string | null>(null);
    const [uninstalling, setUninstalling] = useState(false);
    const [tools, setTools] = useState<ToolInfo[]>([]);
    const [scanLoading, setScanLoading] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<SecurityScanResult | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("readme");

    useEffect(() => {
        if (id) {
            setScanResult(null);
            setScanError(null);
            void Promise.all([loadSkillInfo(), loadConfiguredTools()]);
        }
    }, [id]);

    useEffect(() => {
        if (activeTab === "security" && !scanResult && !scanLoading && id) {
            void runSecurityScan();
        }
    }, [activeTab, scanResult, scanLoading, id]);

    const configuredTools = useMemo(() => {
        return tools.filter((tool) => tool.detected);
    }, [tools]);

    function errorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    async function loadSkillInfo() {
        if (!id) {
            return;
        }
        setLoading(true);
        try {
            const [skillResult, detailResult] = await Promise.all([
                invoke<SkillInfo>("get_skill_info", { skillId: id }),
                invoke<SkillDetailInfo>("get_skill_detail", { skillId: id }).catch(() => null),
            ]);
            setSkill(skillResult);
            setSkillDetail(detailResult);
        } catch (error) {
            console.error("Failed to load skill:", error);
        }
        setLoading(false);
    }

    function formatBytes(bytes: number): string {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }

    async function handleOpenDirectory() {
        if (skillDetail?.skill_path) {
            try {
                await invoke("open_directory", { path: skillDetail.skill_path });
            } catch (error) {
                console.error("Failed to open directory:", error);
            }
        }
    }

    async function loadConfiguredTools() {
        setToolsLoading(true);
        try {
            const result = await invoke<ToolInfo[]>("list_tools");
            setTools(result.filter((tool) => tool.detected));
        } catch (error) {
            console.error("Failed to load tools:", error);
            setTools([]);
        }
        setToolsLoading(false);
    }

    async function runSecurityScan() {
        if (!id) {
            return;
        }
        setScanLoading(true);
        setScanError(null);
        try {
            const result = await invoke<SecurityScanResult>("scan_skill", { skillId: id });
            setScanResult(result);
            setSkill((prev) => {
                if (!prev) {
                    return prev;
                }
                return {
                    ...prev,
                    scan_passed: result.passed,
                };
            });
        } catch (error) {
            console.error("Failed to run security scan:", error);
            setScanError(errorMessage(error));
        }
        setScanLoading(false);
    }

    async function handleSyncTools(toolTypes: string[]) {
        if (!id || toolTypes.length === 0) {
            return;
        }

        setActionError(null);
        try {
            const results = await invoke<SyncResult[]>("sync_skills", {
                skillIds: [id],
                tools: toolTypes,
            });
            const failed = results.filter((item) => !item.success);
            if (failed.length > 0) {
                setActionError(failed.map((item) => `${item.tool}: ${item.error ?? "failed"}`).join("; "));
            }
            await loadSkillInfo();
        } catch (error) {
            console.error("Failed to sync skill:", error);
            setActionError(errorMessage(error));
        }
    }

    async function handleSyncAll() {
        if (configuredTools.length === 0) {
            return;
        }
        setSyncingAll(true);
        try {
            await handleSyncTools(configuredTools.map((tool) => tool.tool_type));
        } finally {
            setSyncingAll(false);
        }
    }

    async function handleRefreshTool(toolType: string) {
        setRefreshingTool(toolType);
        try {
            await handleSyncTools([toolType]);
        } finally {
            setRefreshingTool(null);
        }
    }

    async function handleUninstall() {
        if (!id) {
            return;
        }

        setUninstalling(true);
        setActionError(null);
        try {
            await invoke("uninstall_skill", { skillId: id });
            navigate("/");
        } catch (error) {
            console.error("Failed to uninstall skill:", error);
            setActionError(errorMessage(error));
        }
        setUninstalling(false);
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
                            <button
                                className="btn btn-ghost btn-sm gap-2"
                                onClick={() => void handleOpenDirectory()}
                                disabled={!skillDetail?.skill_path}
                            >
                                <FolderOpen className="w-4 h-4" />
                                {t.settings.openDirectory}
                            </button>
                            <button
                                className="btn btn-ghost btn-sm gap-2"
                                onClick={() => void handleSyncAll()}
                                disabled={syncingAll || uninstalling || toolsLoading || configuredTools.length === 0}
                            >
                                <RefreshCw className={`w-4 h-4 ${syncingAll ? "animate-spin" : ""}`} />
                                {syncingAll ? t.settings.syncing : t.common.sync}
                            </button>
                            <button
                                className="btn btn-error btn-sm gap-2"
                                onClick={() => void handleUninstall()}
                                disabled={uninstalling || syncingAll}
                            >
                                {uninstalling ? (
                                    <span className="loading loading-spinner loading-xs"></span>
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                {t.common.uninstall}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {actionError && (
                <div className="alert alert-error">
                    <span>{actionError}</span>
                </div>
            )}

            {/* Tabs */}
            <div role="tablist" className="tabs tabs-boxed bg-base-200 p-1">
                <button
                    role="tab"
                    className={`tab ${activeTab === "readme" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("readme")}
                >
                    {t.skillDetail.readme}
                </button>
                <button
                    role="tab"
                    className={`tab ${activeTab === "files" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("files")}
                >
                    {t.skillDetail.files}
                </button>
                <button
                    role="tab"
                    className={`tab ${activeTab === "sync" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("sync")}
                >
                    {t.skillDetail.syncStatus}
                </button>
                <button
                    role="tab"
                    className={`tab ${activeTab === "security" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("security")}
                >
                    {t.skillDetail.security}
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === "readme" && (
                <div className="card bg-base-200">
                    <div className="card-body">
                        <h3 className="card-title">{t.skillDetail.readme}</h3>
                        {skillDetail?.skill_md_content ? (
                            <pre className="mt-4 p-4 bg-base-300 rounded-lg overflow-auto text-sm whitespace-pre-wrap font-mono max-h-[500px]">
                                {skillDetail.skill_md_content}
                            </pre>
                        ) : (
                            <p className="text-base-content/60 mt-4">
                                {t.skillDetail.noReadme}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "files" && (
                <div className="card bg-base-200">
                    <div className="card-body">
                        <h3 className="card-title">{t.skillDetail.files}</h3>
                        {skillDetail?.files && skillDetail.files.length > 0 ? (
                            <div className="overflow-x-auto mt-4">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>{t.common.name}</th>
                                            <th>{t.common.size}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {skillDetail.files.map((file) => (
                                            <tr key={file.path}>
                                                <td className="flex items-center gap-2">
                                                    {file.is_dir ? (
                                                        <Folder className="w-4 h-4 text-warning" />
                                                    ) : (
                                                        <FileText className="w-4 h-4 text-base-content/60" />
                                                    )}
                                                    <span className="font-mono text-sm">{file.name}</span>
                                                </td>
                                                <td className="text-base-content/60">
                                                    {file.is_dir ? "-" : formatBytes(file.size)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-base-content/60 mt-4">
                                {t.common.noData}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "sync" && (
                <div className="card bg-base-200">
                    <div className="card-body">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="card-title">{t.skillDetail.securityScanResults}</h3>
                            <button
                                className="btn btn-ghost btn-sm gap-2"
                                onClick={() => void runSecurityScan()}
                                disabled={scanLoading}
                            >
                                <RefreshCw className={`w-4 h-4 ${scanLoading ? "animate-spin" : ""}`} />
                                {t.common.refresh}
                            </button>
                        </div>

                        {scanLoading && (
                            <div className="flex justify-center py-8">
                                <span className="loading loading-spinner loading-md text-primary"></span>
                            </div>
                        )}

                        {!scanLoading && scanError && (
                            <div className="alert alert-error mt-4">
                                <span>{scanError}</span>
                            </div>
                        )}

                        {!scanLoading && !scanError && scanResult && (
                            <>
                                <div
                                    className={`alert mt-4 ${scanResult.passed && scanResult.findings.length === 0
                                        ? "alert-success"
                                        : "alert-warning"
                                        }`}
                                >
                                    <Shield className="w-5 h-5" />
                                    <span>
                                        {scanResult.findings.length === 0
                                            ? t.skillDetail.passedAllChecks
                                            : `${scanResult.overall_risk} · ${t.security.findings}: ${scanResult.findings.length}`}
                                    </span>
                                </div>

                                {scanResult.findings.length > 0 && (
                                    <div className="space-y-3 mt-4">
                                        {scanResult.findings.map((finding, index) => (
                                            <div
                                                key={`${finding.rule_name}-${finding.file}-${finding.line ?? index}`}
                                                className="p-4 rounded-lg bg-base-300"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold">{finding.rule_name}</p>
                                                        <p className="text-sm text-base-content/70 mt-1">
                                                            {finding.description}
                                                        </p>
                                                    </div>
                                                    <span className={`badge ${getRiskBadgeClass(finding.risk_level)}`}>
                                                        {finding.risk_level}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-mono text-base-content/70 mt-2">
                                                    {finding.file}
                                                    {finding.line ? `:${finding.line}` : ""}
                                                </p>
                                                <p className="text-sm text-base-content/70 mt-1">
                                                    {finding.recommendation}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
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
                                    {toolsLoading && (
                                        <tr>
                                            <td colSpan={4} className="text-center py-8">
                                                <span className="loading loading-spinner loading-md text-primary"></span>
                                            </td>
                                        </tr>
                                    )}

                                    {!toolsLoading && (!skillDetail?.synced_tools || skillDetail.synced_tools.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="text-center text-base-content/60 py-8">
                                                {t.skillDetail.notSyncedToAny}
                                            </td>
                                        </tr>
                                    )}

                                    {!toolsLoading && skillDetail?.synced_tools &&
                                        skillDetail.synced_tools.map((tool) => (
                                            <tr key={tool.tool_type}>
                                                <td>{tool.tool_name}</td>
                                                <td>
                                                    {tool.is_synced ? (
                                                        <span className="badge badge-success">{t.skillDetail.synced}</span>
                                                    ) : (
                                                        <span className="badge badge-ghost">{t.skillDetail.notSynced}</span>
                                                    )}
                                                </td>
                                                <td>{tool.is_link ? t.skillDetail.autoLink : "Copy"}</td>
                                                <td>
                                                    <button
                                                        className="btn btn-ghost btn-xs"
                                                        onClick={() => void handleRefreshTool(tool.tool_type)}
                                                        disabled={
                                                            refreshingTool === tool.tool_type ||
                                                            syncingAll ||
                                                            uninstalling
                                                        }
                                                    >
                                                        <RefreshCw
                                                            className={`w-3 h-3 ${refreshingTool === tool.tool_type
                                                                ? "animate-spin"
                                                                : ""
                                                                }`}
                                                        />
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
