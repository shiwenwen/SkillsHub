import { useState } from "react";
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



export default function Security() {
    const t = useTranslation();
    const [scanning, setScanning] = useState(false);

    const riskColors: Record<string, string> = {
        LOW: "badge-info",
        MEDIUM: "badge-warning",
        HIGH: "badge-error",
        BLOCK: "badge-error",
    };

    async function scanAllSkills() {
        setScanning(true);
        // In a real implementation, this would scan all installed skills
        setScanning(false);
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
                    <div className="stat-value text-success">12</div>
                    <div className="stat-desc">{t.security.skillsVerified}</div>
                </div>
                <div className="stat">
                    <div className="stat-figure text-warning">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div className="stat-title">{t.security.warnings}</div>
                    <div className="stat-value text-warning">3</div>
                    <div className="stat-desc">{t.security.requireReview}</div>
                </div>
                <div className="stat">
                    <div className="stat-figure text-error">
                        <X className="w-8 h-8" />
                    </div>
                    <div className="stat-title">{t.security.blocked}</div>
                    <div className="stat-value text-error">0</div>
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
                                {[
                                    { id: "CMD001", name: "Destructive Commands", level: "HIGH" },
                                    { id: "CMD002", name: "Privilege Escalation", level: "HIGH" },
                                    { id: "NET001", name: "Data Exfiltration", level: "HIGH" },
                                    { id: "CRED001", name: "Credential Access", level: "HIGH" },
                                    { id: "EVAL001", name: "Dynamic Code Execution", level: "MEDIUM" },
                                    { id: "PATH001", name: "System Path Access", level: "MEDIUM" },
                                    { id: "FILE001", name: "Binary Executables", level: "BLOCK" },
                                    { id: "FILE002", name: "Shell Scripts", level: "MEDIUM" },
                                ].map((rule) => (
                                    <tr key={rule.id}>
                                        <td className="font-mono">{rule.id}</td>
                                        <td>{rule.name}</td>
                                        <td>
                                            <span className={`badge ${riskColors[rule.level]}`}>
                                                {rule.level}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge badge-success badge-sm gap-1">
                                                <Check className="w-3 h-3" /> {t.security.enabled}
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
                                    defaultChecked
                                />
                            </label>
                        </div>
                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text">{t.security.requireConfirmMedium}</span>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-warning"
                                    defaultChecked
                                />
                            </label>
                        </div>
                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text">{t.security.autoApproveLow}</span>
                                <input type="checkbox" className="toggle toggle-success" />
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
                            {["github.com/official-skills", "skillshub.io/curated"].map(
                                (source) => (
                                    <div
                                        key={source}
                                        className="flex items-center justify-between p-3 bg-base-300 rounded-lg"
                                    >
                                        <span className="font-mono text-sm">{source}</span>
                                        <button className="btn btn-ghost btn-xs">{t.security.remove}</button>
                                    </div>
                                )
                            )}
                            <button className="btn btn-outline btn-sm w-full mt-2">
                                {t.security.addTrustedSource}
                            </button>
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
                                {[
                                    { skill: "code-review", time: "2 hours ago", risk: "LOW", passed: true, findings: 0 },
                                    { skill: "api-testing", time: "3 hours ago", risk: "MEDIUM", passed: true, findings: 2 },
                                    { skill: "deploy-helper", time: "1 day ago", risk: "LOW", passed: true, findings: 1 },
                                ].map((scan, i) => (
                                    <tr key={i}>
                                        <td className="font-medium">{scan.skill}</td>
                                        <td className="text-base-content/60">{scan.time}</td>
                                        <td>
                                            <span className={`badge ${riskColors[scan.risk]}`}>
                                                {scan.risk}
                                            </span>
                                        </td>
                                        <td>
                                            {scan.passed ? (
                                                <span className="text-success flex items-center gap-1">
                                                    <Check className="w-4 h-4" /> {t.security.passed}
                                                </span>
                                            ) : (
                                                <span className="text-error flex items-center gap-1">
                                                    <X className="w-4 h-4" /> {t.security.blocked}
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
