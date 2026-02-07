import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
    ArrowLeft,
    Package,
    RefreshCw,
    Trash2,
    FileCode,
    ShieldCheck,
    ShieldAlert,
    ExternalLink,
    FolderOpen,
    AlertTriangle,
    FileText,
    Folder,
    Check
} from "lucide-react";
import { useTranslation } from "../i18n";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

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

function getRiskBadgeVariant(risk: string): "neutral" | "primary" | "secondary" | "accent" | "ghost" | "link" | "outline" | "error" | "warning" | "success" | "info" {
    const normalized = risk.trim().toUpperCase();
    if (normalized === "BLOCK" || normalized === "HIGH") {
        return "error";
    }
    if (normalized === "MEDIUM") {
        return "warning";
    }
    return "info";
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
        if (!id) return;
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
        if (!id) return;
        setScanLoading(true);
        setScanError(null);
        try {
            const result = await invoke<SecurityScanResult>("scan_skill", { skillId: id });
            setScanResult(result);
            setSkill((prev) => {
                if (!prev) return prev;
                return { ...prev, scan_passed: result.passed };
            });
        } catch (error) {
            console.error("Failed to run security scan:", error);
            setScanError(errorMessage(error));
        }
        setScanLoading(false);
    }

    async function handleSyncTools(toolTypes: string[]) {
        if (!id || toolTypes.length === 0) return;

        setActionError(null);
        try {
            const results = await invoke<SyncResult[]>("sync_skills", {
                skillIds: [id],
                tools: toolTypes,
            });
            const failed = results.filter((item) => !item.success);
            if (failed.length > 0) {
                setActionError(failed.map((item) => `${item.tool}: ${item.error ?? "failed"} `).join("; "));
            }
            await loadSkillInfo();
        } catch (error) {
            console.error("Failed to sync skill:", error);
            setActionError(errorMessage(error));
        }
    }

    async function handleSyncAll() {
        if (configuredTools.length === 0) return;
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
        if (!id) return;
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
            <div className="flex justify-center items-center py-20">
                <div className="flex flex-col items-center gap-4">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                    <span className="text-base-content/50">Loading skill details...</span>
                </div>
            </div>
        );
    }

    if (!skill) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Package className="w-16 h-16 text-base-content/20 mb-4" />
                <h2 className="text-2xl font-bold mb-2">{t.skillDetail.skillNotFound}</h2>
                <p className="text-base-content/60 mb-6">The skill you are looking for could not be found.</p>
                <Link to="/">
                    <Button variant="primary">{t.skillDetail.back}</Button>
                </Link>
            </div>
        );
    }

    const tabs = [
        { id: "readme", label: t.skillDetail.readme, icon: FileText },
        { id: "files", label: t.skillDetail.files, icon: Folder },
        { id: "sync", label: t.skillDetail.syncStatus, icon: RefreshCw },
        { id: "security", label: t.skillDetail.security, icon: ShieldCheck },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            {/* Back Button */}
            <Link to="/" className="inline-block">
                <Button variant="ghost" size="sm" className="gap-2 pl-2">
                    <ArrowLeft className="w-4 h-4" />
                    {t.skillDetail.back}
                </Button>
            </Link>

            {/* Header */}
            <div className="glass-card p-8">
                <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                    <div className="flex items-start gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary/80 flex items-center justify-center shadow-lg shadow-primary/20 text-white shrink-0">
                            <Package className="w-10 h-10" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{skill.name}</h1>
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <Badge variant="neutral" className="font-mono">{skill.version}</Badge>
                                <span className="text-base-content/30">•</span>
                                <div className="flex items-center gap-2 text-sm text-base-content/60">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span className="truncate max-w-[200px]">{skill.source}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {skill.scan_passed ? (
                                    <Badge variant="success" className="gap-1.5 pl-1.5">
                                        <ShieldCheck className="w-3.5 h-3.5" /> {t.skillDetail.secure}
                                    </Badge>
                                ) : (
                                    <Badge variant="error" className="gap-1.5 pl-1.5">
                                        <ShieldAlert className="w-3.5 h-3.5" /> {t.skillDetail.issuesFound}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <Button
                            variant="ghost"
                            onClick={() => void handleOpenDirectory()}
                            disabled={!skillDetail?.skill_path}
                            title={t.settings.openDirectory}
                        >
                            <FolderOpen className="w-4 h-4 mr-2" />
                            {t.settings.openDirectory}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => void handleSyncAll()}
                            disabled={syncingAll || uninstalling || toolsLoading || configuredTools.length === 0}
                            loading={syncingAll}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {syncingAll ? t.settings.syncing : t.common.sync}
                        </Button>
                        <Button
                            variant="danger"
                            variantType="outline"
                            onClick={() => void handleUninstall()}
                            disabled={uninstalling || syncingAll}
                            loading={uninstalling}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t.common.uninstall}
                        </Button>
                    </div>
                </div>
            </div>

            {actionError && (
                <div className="alert alert-error shadow-sm rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{actionError}</span>
                </div>
            )}

            {/* Tabs */}
            <div className="tabs tabs-boxed bg-base-200/50 p-1 w-full md:w-auto inline-flex overflow-x-auto">
                {tabs.map((tab) => (
                    <a
                        key={tab.id}
                        className={`tab h - 10 px - 6 transition - all duration - 200 rounded - lg ${activeTab === tab.id ? "bg-primary text-primary-content shadow-md" : "hover:bg-base-300"} `}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <tab.icon className="w-4 h-4 mr-2" />
                        {tab.label}
                    </a>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
                {activeTab === "readme" && (
                    <Card title={t.skillDetail.readme} icon={<FileText className="w-5 h-5 text-primary" />}>
                        {skillDetail?.skill_md_content ? (
                            <div className="mockup-code bg-base-300 text-base-content/80 before:hidden">
                                <pre className="px-6 py-4 whitespace-pre-wrap font-mono text-sm leading-relaxed max-h-[600px] overflow-auto custom-scrollbar">
                                    {skillDetail.skill_md_content}
                                </pre>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-base-content/40 bg-base-200/30 rounded-xl border border-dashed border-base-300">
                                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>{t.skillDetail.noReadme}</p>
                            </div>
                        )}
                    </Card>
                )}

                {activeTab === "files" && (
                    <Card title={t.skillDetail.files} icon={<Folder className="w-5 h-5 text-secondary" />}>
                        {skillDetail?.files && skillDetail.files.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="table w-full">
                                    <thead>
                                        <tr className="text-base-content/60 border-b border-base-200/50">
                                            <th>{t.common.name}</th>
                                            <th>{t.common.size}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {skillDetail.files.map((file) => (
                                            <tr key={file.path} className="hover:bg-base-200/30 transition-colors border-b border-base-200/30 last:border-0">
                                                <td className="flex items-center gap-3 py-3">
                                                    {file.is_dir ? (
                                                        <Folder className="w-5 h-5 text-warning fill-warning/20" />
                                                    ) : (
                                                        <FileCode className="w-5 h-5 text-base-content/40" />
                                                    )}
                                                    <span className="font-mono text-sm">{file.name}</span>
                                                </td>
                                                <td className="text-base-content/60 font-mono text-xs">
                                                    {file.is_dir ? "-" : formatBytes(file.size)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-base-content/40">
                                <Folder className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>{t.common.noData}</p>
                            </div>
                        )}
                    </Card>
                )}

                {activeTab === "sync" && (
                    <Card
                        title={t.skillDetail.syncStatus}
                        icon={<RefreshCw className="w-5 h-5 text-info" />}
                        actions={
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void runSecurityScan()}
                                disabled={scanLoading}
                            >
                                <RefreshCw className={`w - 3.5 h - 3.5 mr - 2 ${scanLoading ? "animate-spin" : ""} `} />
                                {t.common.refresh}
                            </Button>
                        }
                    >
                        {/* Security Scan Summary inside Sync Tab for better context */}
                        {!scanLoading && !scanError && scanResult && (
                            <div className={`mb - 6 p - 4 rounded - xl border ${scanResult.passed && scanResult.findings.length === 0 ? "bg-success/5 border-success/20 text-success" : "bg-warning/5 border-warning/20 text-warning"} `}>
                                <div className="flex items-center gap-3">
                                    {scanResult.passed ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                                    <span className="font-medium">
                                        {scanResult.findings.length === 0
                                            ? t.skillDetail.passedAllChecks
                                            : `${scanResult.overall_risk} · ${t.security.findings}: ${scanResult.findings.length} `}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="table w-full">
                                <thead>
                                    <tr className="text-base-content/60 border-b border-base-200/50">
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
                                            <tr key={tool.tool_type} className="hover:bg-base-200/30 transition-colors border-b border-base-200/30 last:border-0">
                                                <td className="font-medium">{tool.tool_name}</td>
                                                <td>
                                                    {tool.is_synced ? (
                                                        <Badge variant="success" size="sm" className="gap-1">
                                                            <Check className="w-3 h-3" /> {t.skillDetail.synced}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="neutral" size="sm">
                                                            {t.skillDetail.notSynced}
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="text-sm">
                                                    {tool.is_link ? (
                                                        <span className="flex items-center gap-1.5 text-base-content/70">
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            {t.skillDetail.autoLink}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-base-content/70">
                                                            <FileText className="w-3.5 h-3.5" />
                                                            Copy
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        onClick={() => void handleRefreshTool(tool.tool_type)}
                                                        disabled={refreshingTool === tool.tool_type || syncingAll || uninstalling}
                                                        className="btn-square h-8 w-8"
                                                    >
                                                        <RefreshCw className={`w - 4 h - 4 ${refreshingTool === tool.tool_type ? "animate-spin" : ""} `} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {activeTab === "security" && (
                    <Card
                        title={t.skillDetail.security}
                        icon={<ShieldCheck className="w-5 h-5 text-accent" />}
                        actions={
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void runSecurityScan()}
                                disabled={scanLoading}
                            >
                                <RefreshCw className={`w - 3.5 h - 3.5 mr - 2 ${scanLoading ? "animate-spin" : ""} `} />
                                {t.common.scan}
                            </Button>
                        }
                    >
                        {scanLoading && (
                            <div className="flex justify-center py-12">
                                <span className="loading loading-spinner loading-md text-primary"></span>
                            </div>
                        )}

                        {!scanLoading && scanError && (
                            <div className="alert alert-error shadow-sm rounded-xl">
                                <AlertTriangle className="w-5 h-5" />
                                <span>{scanError}</span>
                            </div>
                        )}

                        {!scanLoading && !scanError && scanResult && (
                            <>
                                <div className={`p - 6 rounded - xl border mb - 6 flex items - center justify - between ${scanResult.passed && scanResult.findings.length === 0 ? "bg-success/5 border-success/20 text-success" : "bg-warning/5 border-warning/20 text-warning"} `}>
                                    <div className="flex items-center gap-3">
                                        {scanResult.passed ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
                                        <div>
                                            <h3 className="font-bold text-lg">
                                                {scanResult.findings.length === 0 ? t.skillDetail.passedAllChecks : "Issues Detected"}
                                            </h3>
                                            <p className="opacity-80 text-sm">
                                                {scanResult.findings.length === 0
                                                    ? "This skill is safe to use according to current security rules."
                                                    : `Found ${scanResult.findings.length} potential issues.Risk Level: ${scanResult.overall_risk} `}
                                            </p>
                                        </div>
                                    </div>
                                    {scanResult.overall_risk !== "LOW" && (
                                        <Badge variant={getRiskBadgeVariant(scanResult.overall_risk)} className="text-lg px-4 h-8">
                                            {scanResult.overall_risk}
                                        </Badge>
                                    )}
                                </div>

                                {scanResult.findings.length > 0 && (
                                    <div className="space-y-4">
                                        <h4 className="font-bold border-b border-base-200/50 pb-2 mb-4">Detailed Findings</h4>
                                        {scanResult.findings.map((finding, index) => (
                                            <div
                                                key={`${finding.rule_name} -${finding.file} -${finding.line ?? index} `}
                                                className="p-5 rounded-xl bg-base-200/30 border border-base-300 hover:border-base-content/20 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div>
                                                        <h5 className="font-bold text-base flex items-center gap-2">
                                                            {finding.rule_name}
                                                        </h5>
                                                        <p className="text-sm text-base-content/70 mt-1">
                                                            {finding.description}
                                                        </p>
                                                    </div>
                                                    <Badge variant={getRiskBadgeVariant(finding.risk_level)} size="sm">
                                                        {finding.risk_level}
                                                    </Badge>
                                                </div>

                                                <div className="bg-base-300/50 rounded-lg p-2.5 mt-3 font-mono text-xs text-base-content/80 flex items-center gap-2">
                                                    <FileCode className="w-3.5 h-3.5 opacity-50" />
                                                    {finding.file}
                                                    {finding.line && <span className="opacity-50">: {finding.line}</span>}
                                                </div>

                                                <div className="mt-3 flex items-start gap-2 text-sm text-base-content/80 bg-info/5 p-3 rounded-lg border border-info/10">
                                                    <ExternalLink className="w-4 h-4 text-info mt-0.5 shrink-0" />
                                                    <span>{finding.recommendation}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}
