import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    Shield,
    AlertTriangle,
    Check,
    X,
    Search,
    ShieldCheck,
    FileWarning,
    Lock,
    Plus,
    ShieldAlert,
    Activity
} from "lucide-react";
import { useTranslation } from "../i18n";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

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

interface RegistryConfig {
    name: string;
    url: string;
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
    const [configuredRegistries, setConfiguredRegistries] = useState<RegistryConfig[]>([]);
    const [selectedRegistryName, setSelectedRegistryName] = useState("");
    const [securityRules, setSecurityRules] = useState<SecurityRule[]>([]);
    const [scanRecords, setScanRecords] = useState<SecurityScanRecord[]>([]);

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

    useEffect(() => {
        const loadRegistries = async () => {
            try {
                const registries = await invoke<RegistryConfig[]>("list_registries");
                const enabledRegistries = registries.filter((registry) => registry.enabled);
                setConfiguredRegistries(enabledRegistries);
                if (enabledRegistries.length > 0) {
                    setSelectedRegistryName(enabledRegistries[0].name);
                }
            } catch (error) {
                console.error("Failed to load registries:", error);
            }
        };

        void loadRegistries();
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
        if (!source) return;

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

    function handleAddRegistryAsTrustedSource() {
        if (!selectedRegistryName) return;

        const selectedRegistry = configuredRegistries.find(
            (registry) => registry.name === selectedRegistryName
        );
        if (!selectedRegistry) return;

        const source = selectedRegistry.url.trim();
        if (!source) return;

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
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                        {t.security.title}
                    </h1>
                    <p className="text-base-content/60 mt-1">
                        {t.security.description}
                    </p>
                </div>
                <Button
                    variant="primary"
                    onClick={scanAllSkills}
                    disabled={scanning}
                    loading={scanning}
                    className="shadow-lg shadow-primary/20"
                >
                    <Search className="w-4 h-4 mr-2" />
                    {t.security.scanAll}
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-base-200/50 p-6 rounded-2xl border border-base-300/50 flex flex-col items-center justify-center text-center">
                    <Shield className="w-8 h-8 text-primary mb-3" />
                    <div className="text-2xl font-bold text-primary">{stats.scanned}</div>
                    <div className="text-xs text-base-content/60 font-medium uppercase mt-1">{t.security.scanned}</div>
                </div>
                <div className="bg-base-200/50 p-6 rounded-2xl border border-base-300/50 flex flex-col items-center justify-center text-center">
                    <Check className="w-8 h-8 text-success mb-3" />
                    <div className="text-2xl font-bold text-success">{stats.verified}</div>
                    <div className="text-xs text-base-content/60 font-medium uppercase mt-1">{t.security.skillsVerified}</div>
                </div>
                <div className="bg-base-200/50 p-6 rounded-2xl border border-base-300/50 flex flex-col items-center justify-center text-center">
                    <AlertTriangle className="w-8 h-8 text-warning mb-3" />
                    <div className="text-2xl font-bold text-warning">{stats.warnings}</div>
                    <div className="text-xs text-base-content/60 font-medium uppercase mt-1">{t.security.warnings}</div>
                </div>
                <div className="bg-base-200/50 p-6 rounded-2xl border border-base-300/50 flex flex-col items-center justify-center text-center">
                    <ShieldAlert className="w-8 h-8 text-error mb-3" />
                    <div className="text-2xl font-bold text-error">{stats.blocked}</div>
                    <div className="text-xs text-base-content/60 font-medium uppercase mt-1">{t.security.blocked}</div>
                </div>
            </div>

            {/* Policy Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={t.security.scanPolicy} icon={<Lock className="w-5 h-5 text-secondary" />}>
                    <div className="space-y-4">
                        <div className="form-control bg-base-200/30 p-3 rounded-lg hover:bg-base-200/50 transition-colors">
                            <label className="label cursor-pointer">
                                <div>
                                    <span className="label-text font-medium block">{t.security.blockHighRiskFindings}</span>
                                    <span className="label-text-alt text-base-content/60">Automatically block high risk findings</span>
                                </div>
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
                        <div className="form-control bg-base-200/30 p-3 rounded-lg hover:bg-base-200/50 transition-colors">
                            <label className="label cursor-pointer">
                                <div>
                                    <span className="label-text font-medium block">{t.security.requireConfirmMedium}</span>
                                    <span className="label-text-alt text-base-content/60">Require manual confirmation for medium risks</span>
                                </div>
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
                        <div className="form-control bg-base-200/30 p-3 rounded-lg hover:bg-base-200/50 transition-colors">
                            <label className="label cursor-pointer">
                                <div>
                                    <span className="label-text font-medium block">{t.security.autoApproveLow}</span>
                                    <span className="label-text-alt text-base-content/60">Automatically approve low risk findings</span>
                                </div>
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
                </Card>

                <Card title={t.security.trustedSources} icon={<FileWarning className="w-5 h-5 text-accent" />}>
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2 mb-4">
                            {trustedSources.map((source) => (
                                <Badge key={source} variant="outline" className="gap-2 pr-1">
                                    {source}
                                    <button
                                        onClick={() => handleRemoveTrustedSource(source)}
                                        className="btn btn-ghost btn-xs btn-circle h-4 w-4 min-h-0"
                                    >
                                        <X className="w-3 h-3 text-error" />
                                    </button>
                                </Badge>
                            ))}
                            {trustedSources.length === 0 && (
                                <div className="text-sm text-base-content/50 italic py-2">No trusted sources configured</div>
                            )}
                        </div>

                        <div className="join w-full">
                            <input
                                type="text"
                                className="input input-bordered input-sm flex-1 font-mono join-item"
                                placeholder={t.security.addTrustedSource}
                                value={newTrustedSource}
                                disabled={loadingPolicy}
                                onChange={(event) => setNewTrustedSource(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") handleAddTrustedSource();
                                }}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={loadingPolicy}
                                onClick={handleAddTrustedSource}
                                className="join-item"
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="divider text-xs text-base-content/30 my-2">OR ADD FROM REGISTRY</div>

                        <div className="join w-full">
                            <select
                                className="select select-bordered select-sm flex-1 join-item"
                                value={selectedRegistryName}
                                disabled={loadingPolicy || configuredRegistries.length === 0}
                                onChange={(event) => setSelectedRegistryName(event.target.value)}
                            >
                                {configuredRegistries.length === 0 && (
                                    <option value="">{t.security.noConfiguredRegistries}</option>
                                )}
                                {configuredRegistries.map((registry) => (
                                    <option key={registry.name} value={registry.name}>
                                        {registry.name}
                                    </option>
                                ))}
                            </select>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={loadingPolicy || configuredRegistries.length === 0}
                                onClick={handleAddRegistryAsTrustedSource}
                                className="join-item"
                            >
                                {t.common.add || "Add"}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Recent Scans */}
            <Card title={t.security.recentScanResults} icon={<Activity className="w-5 h-5 text-info" />}>
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr className="text-base-content/60 border-b border-base-200/50">
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
                                    <td colSpan={5} className="text-center text-base-content/60 py-8">
                                        <ShieldCheck className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        {t.security.noIssues}
                                    </td>
                                </tr>
                            )}
                            {recentScans.map((scan) => (
                                <tr key={`${scan.skill}-${scan.scannedAt}`} className="hover:bg-base-200/30 transition-colors border-b border-base-200/30 last:border-0">
                                    <td className="font-medium">{scan.skill}</td>
                                    <td className="text-base-content/60 text-sm">{formatScannedAt(scan.scannedAt)}</td>
                                    <td>
                                        <Badge variant={
                                            scan.risk === 'LOW' ? 'info' :
                                                scan.risk === 'MEDIUM' ? 'warning' : 'error'
                                        } size="sm">
                                            {scan.risk}
                                        </Badge>
                                    </td>
                                    <td>
                                        {scan.status === "PASSED" ? (
                                            <span className="text-success flex items-center gap-1 text-sm font-medium">
                                                <Check className="w-4 h-4" /> {t.security.passed}
                                            </span>
                                        ) : scan.status === "BLOCKED" ? (
                                            <span className="text-error flex items-center gap-1 text-sm font-medium">
                                                <X className="w-4 h-4" /> {t.security.blocked}
                                            </span>
                                        ) : (
                                            <span className="text-warning flex items-center gap-1 text-sm font-medium">
                                                <AlertTriangle className="w-4 h-4" /> {t.security.requireReview}
                                            </span>
                                        )}
                                    </td>
                                    <td className="text-center">{scan.findings}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Scan Rules */}
            <Card title={t.security.activeSecurityRules} icon={<ShieldCheck className="w-5 h-5 text-success" />}>
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr className="text-base-content/60 border-b border-base-200/50">
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
                                <tr key={rule.id} className="hover:bg-base-200/30 transition-colors border-b border-200/30 last:border-0">
                                    <td className="font-mono text-xs opacity-70">{rule.id}</td>
                                    <td className="font-medium">{rule.name}</td>
                                    <td>
                                        <Badge variant={
                                            rule.riskLevel === "HIGH" || rule.riskLevel === "BLOCK" ? "error" :
                                                rule.riskLevel === "MEDIUM" ? "warning" : "info"
                                        } size="sm">
                                            {rule.riskLevel}
                                        </Badge>
                                    </td>
                                    <td>
                                        <Badge variant={rule.enabled ? "success" : "neutral"} size="sm" className="gap-1">
                                            {rule.enabled && <Check className="w-3 h-3" />}
                                            {rule.enabled ? t.security.enabled : t.security.blocked}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
