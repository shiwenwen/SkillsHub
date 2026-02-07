import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    Shield,
    AlertTriangle,
    Check,
    X,
    Search,
    FileWarning,
    Lock,
} from "lucide-react";
import { useTranslation } from "../i18n";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCK";
type ScanStatus = "PASSED" | "REVIEW" | "BLOCKED";

interface ScannedSkillInfo {
    id: string;
    path: string;
}

interface InstalledSkillInfo {
    id: string;
    source: string;
}

interface CloudSyncConfig {
    enabled: boolean;
    provider: string | null;
    sync_folder: string | null;
    auto_sync: boolean;
    last_sync: string | null;
}

interface AppConfigPayload {
    default_sync_strategy: string;
    auto_sync_on_install: boolean;
    check_updates_on_startup: boolean;
    scan_before_install: boolean;
    scan_before_update: boolean;
    block_high_risk: boolean;
    require_confirm_medium: boolean;
    auto_approve_low: boolean;
    trusted_sources: string[];
    cloud_sync: CloudSyncConfig;
}

interface ScanResult {
    overall_risk: string;
    findings: unknown[];
}

interface SecurityRuleDto {
    id: string;
    name: string;
    risk_level: string;
    enabled: boolean;
}

interface SecurityScanRecordDto {
    skill: string;
    scanned_at: number;
    risk: string;
    findings: number;
    source: string;
}

interface SecurityScanRecord {
    skill: string;
    scannedAt: number;
    risk: RiskLevel;
    findings: number;
    source: string;
}

interface SecurityRule {
    id: string;
    name: string;
    riskLevel: RiskLevel;
    enabled: boolean;
}

function normalizeTrustedSources(sources: string[]): string[] {
    return Array.from(
        new Set(
            sources
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
        )
    );
}

function normalizeRiskLevel(value: string): RiskLevel {
    const risk = value.trim().toUpperCase();
    if (risk === "HIGH" || risk === "MEDIUM" || risk === "LOW" || risk === "BLOCK") {
        return risk;
    }
    return "LOW";
}

function isTrustedSource(source: string, trustedSources: string[]): boolean {
    if (!source) {
        return false;
    }
    const normalizedSource = source.toLowerCase();
    return trustedSources.some((trusted) =>
        normalizedSource.includes(trusted.trim().toLowerCase())
    );
}

function evaluateStatus(
    risk: RiskLevel,
    source: string,
    policy: {
        blockHighRiskFindings: boolean;
        requireConfirmMedium: boolean;
        autoApproveLow: boolean;
    },
    trustedSources: string[]
): ScanStatus {
    if (isTrustedSource(source, trustedSources)) {
        return "PASSED";
    }

    if (risk === "HIGH" || risk === "BLOCK") {
        return policy.blockHighRiskFindings ? "BLOCKED" : "REVIEW";
    }
    if (risk === "MEDIUM") {
        return policy.requireConfirmMedium ? "REVIEW" : "PASSED";
    }
    return policy.autoApproveLow ? "PASSED" : "REVIEW";
}

function formatScannedAt(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

function fromDto(record: SecurityScanRecordDto): SecurityScanRecord {
    return {
        skill: record.skill,
        scannedAt: record.scanned_at,
        risk: normalizeRiskLevel(record.risk),
        findings: record.findings,
        source: record.source,
    };
}

function toDto(record: SecurityScanRecord): SecurityScanRecordDto {
    return {
        skill: record.skill,
        scanned_at: record.scannedAt,
        risk: record.risk,
        findings: record.findings,
        source: record.source,
    };
}

function fromRuleDto(rule: SecurityRuleDto): SecurityRule {
    return {
        id: rule.id,
        name: rule.name,
        riskLevel: normalizeRiskLevel(rule.risk_level),
        enabled: rule.enabled,
    };
}

export default function Security() {
    const t = useTranslation();
    const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
    const [scanning, setScanning] = useState(false);
    const [loadingPolicy, setLoadingPolicy] = useState(true);
    const [blockHighRiskFindings, setBlockHighRiskFindings] = useState(true);
    const [requireConfirmMedium, setRequireConfirmMedium] = useState(true);
    const [autoApproveLow, setAutoApproveLow] = useState(false);
    const [trustedSources, setTrustedSources] = useState<string[]>([]);
    const [newTrustedSource, setNewTrustedSource] = useState("");
    const [securityRules, setSecurityRules] = useState<SecurityRule[]>([]);
    const [scanRecords, setScanRecords] = useState<SecurityScanRecord[]>([]);

    const riskColors: Record<string, string> = {
        LOW: "badge-info",
        MEDIUM: "badge-warning",
        HIGH: "badge-error",
        BLOCK: "badge-error",
    };

    const recentScans = useMemo(() => {
        return scanRecords.map((record) => {
            const status = evaluateStatus(
                record.risk,
                record.source,
                {
                    blockHighRiskFindings,
                    requireConfirmMedium,
                    autoApproveLow,
                },
                trustedSources
            );
            return {
                ...record,
                status,
            };
        });
    }, [scanRecords, blockHighRiskFindings, requireConfirmMedium, autoApproveLow, trustedSources]);

    const stats = useMemo(() => {
        return {
            scanned: recentScans.length,
            warnings: recentScans.filter((scan) => scan.status === "REVIEW").length,
            blocked: recentScans.filter((scan) => scan.status === "BLOCKED").length,
            verified: recentScans.filter((scan) => scan.status === "PASSED").length,
        };
    }, [recentScans]);

    useEffect(() => {
        const loadSecurityPolicy = async () => {
            try {
                const config = await invoke<AppConfigPayload>("get_app_config");
                setBlockHighRiskFindings(config.block_high_risk);
                setRequireConfirmMedium(config.require_confirm_medium);
                setAutoApproveLow(config.auto_approve_low);
                setTrustedSources(normalizeTrustedSources(config.trusted_sources));
            } catch (error) {
                console.error("Failed to load security policy:", error);
            } finally {
                setLoadingPolicy(false);
            }
        };

        void loadSecurityPolicy();
    }, []);

    useEffect(() => {
        const loadScanRecords = async () => {
            try {
                const records = await invoke<SecurityScanRecordDto[]>("get_security_scan_records");
                setScanRecords(records.map(fromDto));
            } catch (error) {
                console.error("Failed to load security scan records:", error);
            }
        };

        void loadScanRecords();
    }, []);

    useEffect(() => {
        const loadSecurityRules = async () => {
            try {
                const rules = await invoke<SecurityRuleDto[]>("list_security_rules");
                setSecurityRules(rules.map(fromRuleDto));
            } catch (error) {
                console.error("Failed to load security rules:", error);
            }
        };

        void loadSecurityRules();
    }, []);

    async function persistSecurityPolicy(next: {
        blockHighRiskFindings: boolean;
        requireConfirmMedium: boolean;
        autoApproveLow: boolean;
        trustedSources: string[];
    }) {
        saveQueueRef.current = saveQueueRef.current
            .then(async () => {
                const config = await invoke<AppConfigPayload>("get_app_config");
                const nextConfig: AppConfigPayload = {
                    ...config,
                    block_high_risk: next.blockHighRiskFindings,
                    require_confirm_medium: next.requireConfirmMedium,
                    auto_approve_low: next.autoApproveLow,
                    trusted_sources: next.trustedSources,
                };
                await invoke("save_app_config", { config: nextConfig });
            })
            .catch((error) => {
                console.error("Failed to persist security policy:", error);
            });

        await saveQueueRef.current;
    }

    async function persistScanRecords(records: SecurityScanRecord[]) {
        try {
            await invoke("save_security_scan_records", { records: records.map(toDto) });
        } catch (error) {
            console.error("Failed to persist security scan records:", error);
        }
    }

    async function scanAllSkills() {
        setScanning(true);
        try {
            const [scannedSkills, installedSkills] = await Promise.all([
                invoke<ScannedSkillInfo[]>("scan_all_skills"),
                invoke<InstalledSkillInfo[]>("list_installed_skills"),
            ]);

            const sourceBySkill = new Map(installedSkills.map((skill) => [skill.id, skill.source]));
            const fallbackPathBySkill = new Map(scannedSkills.map((skill) => [skill.id, skill.path]));
            const uniqueSkillIds = Array.from(new Set(scannedSkills.map((skill) => skill.id)));

            const scannedAt = Date.now();
            const results = await Promise.all(
                uniqueSkillIds.map(async (skillId) => {
                    try {
                        const scan = await invoke<ScanResult>("scan_skill", { skillId });
                        return {
                            skill: skillId,
                            scannedAt,
                            risk: normalizeRiskLevel(scan.overall_risk),
                            findings: scan.findings.length,
                            source:
                                sourceBySkill.get(skillId) ?? fallbackPathBySkill.get(skillId) ?? "",
                        } satisfies SecurityScanRecord;
                    } catch (error) {
                        console.warn(`Failed to scan ${skillId}:`, error);
                        return {
                            skill: skillId,
                            scannedAt,
                            risk: "HIGH" as const,
                            findings: 1,
                            source:
                                sourceBySkill.get(skillId) ?? fallbackPathBySkill.get(skillId) ?? "",
                        } satisfies SecurityScanRecord;
                    }
                })
            );

            setScanRecords((current) => {
                const next = [...results, ...current].slice(0, 20);
                void persistScanRecords(next);
                return next;
            });
        } catch (error) {
            console.error("Failed to scan all skills:", error);
        } finally {
            setScanning(false);
        }
    }

    function handleRemoveTrustedSource(source: string) {
        setTrustedSources((current) => {
            const nextTrustedSources = current.filter((item) => item !== source);
            void persistSecurityPolicy({
                blockHighRiskFindings,
                requireConfirmMedium,
                autoApproveLow,
                trustedSources: nextTrustedSources,
            });
            return nextTrustedSources;
        });
    }

    function handleAddTrustedSource() {
        const source = newTrustedSource.trim();
        if (!source) {
            return;
        }

        setTrustedSources((current) => {
            if (current.some((item) => item.toLowerCase() === source.toLowerCase())) {
                return current;
            }
            const nextTrustedSources = [...current, source];
            void persistSecurityPolicy({
                blockHighRiskFindings,
                requireConfirmMedium,
                autoApproveLow,
                trustedSources: nextTrustedSources,
            });
            return nextTrustedSources;
        });
        setNewTrustedSource("");
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{t.security.title}</h1>
                    <p className="text-base-content/60 mt-1">
                        {t.security.description}
                    </p>
                </div>
                <button
                    onClick={scanAllSkills}
                    className="btn btn-primary btn-sm gap-2"
                    disabled={scanning}
                >
                    {scanning ? (
                        <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                        <Search className="w-4 h-4" />
                    )}
                    {t.security.scanAll}
                </button>
            </div>

            {/* Stats */}
            <div className="stats shadow bg-base-200 w-full">
                <div className="stat">
                    <div className="stat-figure text-success">
                        <Shield className="w-8 h-8" />
                    </div>
                    <div className="stat-title">{t.security.scanned}</div>
                    <div className="stat-value text-success">{stats.scanned}</div>
                    <div className="stat-desc">
                        {stats.verified} {t.security.skillsVerified}
                    </div>
                </div>
                <div className="stat">
                    <div className="stat-figure text-warning">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div className="stat-title">{t.security.warnings}</div>
                    <div className="stat-value text-warning">{stats.warnings}</div>
                    <div className="stat-desc">{t.security.requireReview}</div>
                </div>
                <div className="stat">
                    <div className="stat-figure text-error">
                        <X className="w-8 h-8" />
                    </div>
                    <div className="stat-title">{t.security.blocked}</div>
                    <div className="stat-value text-error">{stats.blocked}</div>
                    <div className="stat-desc">{t.security.criticalIssues}</div>
                </div>
            </div>

            {/* Scan Rules */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <h3 className="card-title">{t.security.activeSecurityRules}</h3>
                    <div className="overflow-x-auto mt-4">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>{t.security.ruleId}</th>
                                    <th>{t.security.name}</th>
                                    <th>{t.security.riskLevel}</th>
                                    <th>{t.security.status}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {securityRules.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center text-base-content/60 py-6">
                                            {t.security.noIssues}
                                        </td>
                                    </tr>
                                )}
                                {securityRules.map((rule) => (
                                    <tr key={rule.id}>
                                        <td className="font-mono">{rule.id}</td>
                                        <td>{rule.name}</td>
                                        <td>
                                            <span className={`badge ${riskColors[rule.riskLevel]}`}>
                                                {rule.riskLevel}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${rule.enabled ? "badge-success" : "badge-ghost"} badge-sm gap-1`}>
                                                {rule.enabled && <Check className="w-3 h-3" />} {rule.enabled ? t.security.enabled : t.security.blocked}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Policy Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card bg-base-200">
                    <div className="card-body">
                        <h3 className="card-title">
                            <Lock className="w-5 h-5" />
                            {t.security.scanPolicy}
                        </h3>
                        <div className="form-control mt-4">
                            <label className="label cursor-pointer">
                                <span className="label-text">{t.security.blockHighRiskFindings}</span>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-error"
                                    checked={blockHighRiskFindings}
                                    disabled={loadingPolicy}
                                    onChange={(event) => {
                                        const nextValue = event.target.checked;
                                        setBlockHighRiskFindings(nextValue);
                                        void persistSecurityPolicy({
                                            blockHighRiskFindings: nextValue,
                                            requireConfirmMedium,
                                            autoApproveLow,
                                            trustedSources,
                                        });
                                    }}
                                />
                            </label>
                        </div>
                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text">{t.security.requireConfirmMedium}</span>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-warning"
                                    checked={requireConfirmMedium}
                                    disabled={loadingPolicy}
                                    onChange={(event) => {
                                        const nextValue = event.target.checked;
                                        setRequireConfirmMedium(nextValue);
                                        void persistSecurityPolicy({
                                            blockHighRiskFindings,
                                            requireConfirmMedium: nextValue,
                                            autoApproveLow,
                                            trustedSources,
                                        });
                                    }}
                                />
                            </label>
                        </div>
                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text">{t.security.autoApproveLow}</span>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-success"
                                    checked={autoApproveLow}
                                    disabled={loadingPolicy}
                                    onChange={(event) => {
                                        const nextValue = event.target.checked;
                                        setAutoApproveLow(nextValue);
                                        void persistSecurityPolicy({
                                            blockHighRiskFindings,
                                            requireConfirmMedium,
                                            autoApproveLow: nextValue,
                                            trustedSources,
                                        });
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="card bg-base-200">
                    <div className="card-body">
                        <h3 className="card-title">
                            <FileWarning className="w-5 h-5" />
                            {t.security.trustedSources}
                        </h3>
                        <div className="space-y-2 mt-4">
                            {trustedSources.map(
                                (source) => (
                                    <div
                                        key={source}
                                        className="flex items-center justify-between p-3 bg-base-300 rounded-lg"
                                    >
                                        <span className="font-mono text-sm">{source}</span>
                                        <button
                                            className="btn btn-ghost btn-xs"
                                            disabled={loadingPolicy}
                                            onClick={() => handleRemoveTrustedSource(source)}
                                        >
                                            {t.security.remove}
                                        </button>
                                    </div>
                                )
                            )}
                            <div className="flex gap-2 mt-2">
                                <input
                                    type="text"
                                    className="input input-bordered input-sm flex-1 font-mono"
                                    placeholder={t.security.addTrustedSource}
                                    value={newTrustedSource}
                                    disabled={loadingPolicy}
                                    onChange={(event) => setNewTrustedSource(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            handleAddTrustedSource();
                                        }
                                    }}
                                />
                                <button
                                    className="btn btn-outline btn-sm"
                                    disabled={loadingPolicy}
                                    onClick={handleAddTrustedSource}
                                >
                                    {t.security.addTrustedSource}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Scans */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <h3 className="card-title">{t.security.recentScanResults}</h3>
                    <div className="overflow-x-auto mt-4">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t.security.skill}</th>
                                    <th>{t.security.scannedAt}</th>
                                    <th>{t.security.riskLevel}</th>
                                    <th>{t.security.status}</th>
                                    <th>{t.security.findings}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentScans.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center text-base-content/60 py-6">
                                            {t.security.noIssues}
                                        </td>
                                    </tr>
                                )}
                                {recentScans.map((scan) => (
                                    <tr key={`${scan.skill}-${scan.scannedAt}`}>
                                        <td className="font-medium">{scan.skill}</td>
                                        <td className="text-base-content/60">{formatScannedAt(scan.scannedAt)}</td>
                                        <td>
                                            <span className={`badge ${riskColors[scan.risk]}`}>
                                                {scan.risk}
                                            </span>
                                        </td>
                                        <td>
                                            {scan.status === "PASSED" ? (
                                                <span className="text-success flex items-center gap-1">
                                                    <Check className="w-4 h-4" /> {t.security.passed}
                                                </span>
                                            ) : scan.status === "BLOCKED" ? (
                                                <span className="text-error flex items-center gap-1">
                                                    <X className="w-4 h-4" /> {t.security.blocked}
                                                </span>
                                            ) : (
                                                <span className="text-warning flex items-center gap-1">
                                                    <AlertTriangle className="w-4 h-4" /> {t.security.requireReview}
                                                </span>
                                            )}
                                        </td>
                                        <td>{scan.findings}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
