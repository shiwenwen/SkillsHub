import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Package, MoreVertical, RefreshCw, Trash2, ExternalLink } from "lucide-react";
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

export default function Installed() {
    const t = useTranslation();
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSkills();
    }, []);

    async function loadSkills() {
        setLoading(true);
        try {
            const result = await invoke<SkillInfo[]>("list_installed_skills");
            setSkills(result);
        } catch (error) {
            console.error("Failed to load skills:", error);
        }
        setLoading(false);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{t.installed.title}</h1>
                    <p className="text-base-content/60 mt-1">
                        {t.installed.description}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadSkills}
                        className="btn btn-ghost btn-sm gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        {t.common.refresh}
                    </button>
                    <Link to="/discover" className="btn btn-primary btn-sm gap-2">
                        <Package className="w-4 h-4" />
                        {t.installed.installNew}
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="stats shadow bg-base-200 w-full">
                <div className="stat">
                    <div className="stat-figure text-primary">
                        <Package className="w-8 h-8" />
                    </div>
                    <div className="stat-title">{t.installed.totalSkills}</div>
                    <div className="stat-value text-primary">{skills.length}</div>
                </div>
                <div className="stat">
                    <div className="stat-figure text-success">
                        <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                            ✓
                        </div>
                    </div>
                    <div className="stat-title">{t.installed.scanPassed}</div>
                    <div className="stat-value text-success">
                        {skills.filter((s) => s.scan_passed).length}
                    </div>
                </div>
                <div className="stat">
                    <div className="stat-figure text-secondary">
                        <RefreshCw className="w-8 h-8" />
                    </div>
                    <div className="stat-title">{t.installed.synced}</div>
                    <div className="stat-value text-secondary">
                        {skills.filter((s) => s.synced_tools.length > 0).length}
                    </div>
                </div>
            </div>

            {/* Skills Grid */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
            ) : skills.length === 0 ? (
                <div className="card bg-base-200">
                    <div className="card-body items-center text-center py-12">
                        <Package className="w-16 h-16 text-base-content/30" />
                        <h2 className="card-title mt-4">{t.installed.noSkills}</h2>
                        <p className="text-base-content/60">
                            {t.installed.noSkillsHint}
                        </p>
                        <Link to="/discover" className="btn btn-primary mt-4">
                            {t.installed.discoverSkills}
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {skills.map((skill) => (
                        <div
                            key={skill.id}
                            className="card bg-base-200 hover:bg-base-300 transition-colors"
                        >
                            <div className="card-body">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                            <Package className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold">{skill.name}</h3>
                                            <p className="text-sm text-base-content/60">
                                                v{skill.version}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="dropdown dropdown-end">
                                        <label tabIndex={0} className="btn btn-ghost btn-sm btn-circle">
                                            <MoreVertical className="w-4 h-4" />
                                        </label>
                                        <ul
                                            tabIndex={0}
                                            className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
                                        >
                                            <li>
                                                <Link to={`/skill/${skill.id}`}>
                                                    <ExternalLink className="w-4 h-4" /> {t.installed.viewDetails}
                                                </Link>
                                            </li>
                                            <li>
                                                <a>
                                                    <RefreshCw className="w-4 h-4" /> {t.common.sync}
                                                </a>
                                            </li>
                                            <li>
                                                <a className="text-error">
                                                    <Trash2 className="w-4 h-4" /> {t.common.uninstall}
                                                </a>
                                            </li>
                                        </ul>
                                    </div>
                                </div>

                                <p className="text-sm text-base-content/60 mt-2 line-clamp-2">
                                    {skill.description || t.common.noDescription}
                                </p>

                                <div className="flex flex-wrap gap-2 mt-3">
                                    {skill.scan_passed ? (
                                        <span className="badge badge-success badge-sm gap-1">
                                            ✓ {t.installed.secure}
                                        </span>
                                    ) : (
                                        <span className="badge badge-error badge-sm gap-1">
                                            ⚠ {t.installed.issues}
                                        </span>
                                    )}
                                    {skill.synced_tools.map((tool) => (
                                        <span key={tool} className="badge badge-outline badge-sm">
                                            {tool}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
