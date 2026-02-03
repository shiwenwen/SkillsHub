import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Package, Download, Star, Loader2, Check } from "lucide-react";
import { useTranslation } from "../i18n";

interface SkillListing {
    id: string;
    name: string;
    description: string;
    author: string;
    tags: string[];
    version: string;
    downloads: number;
    rating: number;
    source: string;
}

interface RegistryConfig {
    name: string;
    url: string;
    description: string;
    enabled: boolean;
    registry_type: string;
}

export default function Discover() {
    const t = useTranslation();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SkillListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const loaderRef = useRef<HTMLDivElement>(null);
    const [installingSkills, setInstallingSkills] = useState<Set<string>>(new Set());
    const [installedSkills, setInstalledSkills] = useState<Set<string>>(new Set());

    // Filtering
    const [registries, setRegistries] = useState<RegistryConfig[]>([]);
    const [selectedSource, setSelectedSource] = useState<string>("all");

    const PAGE_SIZE = 20;

    // 获取 Skill 的源


    // Filtered results
    const filteredResults = results.filter(skill => {
        if (selectedSource === "all") return true;

        // Check if skill source matches selected registry
        const skillSource = skill.source;

        // Get selected registry
        const registry = registries.find(r => r.name === selectedSource);
        if (!registry) return true;

        // Logic to match skill source to registry
        // 1. Git match
        if (registry.registry_type === "Git") {
            return skillSource === `git:${registry.url}`;
        }
        // 2. ClawHub/Registry match
        if (registry.registry_type === "ClawHub") {
            // ClawHub skills start with registry:https://auth.clawdhub.com...
            return skillSource.includes("clawdhub") || skillSource.includes("clawhub");
        }

        return true;
    });

    // 安装 Skill
    const handleInstall = async (skillId: string) => {
        setInstallingSkills(prev => new Set(prev).add(skillId));

        try {
            // 检查是否需要安装前扫描
            const scanBeforeInstall = localStorage.getItem("skillshub_scanBeforeInstall");
            const blockHighRisk = localStorage.getItem("skillshub_blockHighRisk");

            if (scanBeforeInstall === "true" || scanBeforeInstall === null) {
                // 执行安全扫描
                try {
                    const scanResult = await invoke<{ overall_risk: string; findings: unknown[] }>("scan_skill", {
                        skillId: skillId,
                    });

                    // 如果启用了阻止高风险且扫描结果为高风险，则阻止安装
                    if ((blockHighRisk === "true" || blockHighRisk === null) && scanResult.overall_risk === "high") {
                        alert(`安装被阻止：Skill "${skillId}" 被检测为高风险。`);
                        return;
                    }
                } catch (scanError) {
                    console.warn("Security scan failed, proceeding with install:", scanError);
                    // 扫描失败时继续安装（可以根据需要修改此行为）
                }
            }

            await invoke<string>("install_skill", {
                skillId: skillId,
                tools: [],
            });

            // 标记为已安装
            setInstalledSkills(prev => new Set(prev).add(skillId));

            // 检查是否需要自动同步
            const autoSync = localStorage.getItem("skillshub_autoSyncOnInstall");
            if (autoSync === "true" || autoSync === null) {
                // 默认开启自动同步
                try {
                    await invoke("full_sync_skills");
                    console.log("Auto sync completed after install");
                } catch (syncError) {
                    console.error("Auto sync failed:", syncError);
                }
            }
        } catch (error) {
            console.error("Install failed:", error);
            alert(`安装失败: ${error}`);
        } finally {
            setInstallingSkills(prev => {
                const next = new Set(prev);
                next.delete(skillId);
                return next;
            });
        }
    };

    // 加载 Skills
    const loadSkills = useCallback(async (searchQuery: string, pageNum: number, append: boolean = false) => {
        if (pageNum === 0) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const result = await invoke<SkillListing[]>("search_skills", {
                query: searchQuery,
            });

            // 模拟分页（后端暂不支持分页，前端处理）
            const startIndex = pageNum * PAGE_SIZE;
            const endIndex = startIndex + PAGE_SIZE;
            const pageResults = result.slice(startIndex, endIndex);

            if (append) {
                setResults(prev => [...prev, ...pageResults]);
            } else {
                setResults(pageResults);
            }

            setHasMore(endIndex < result.length);
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    // 初始加载
    useEffect(() => {
        loadSkills("", 0, false);

        // Load registries
        invoke<RegistryConfig[]>("list_registries")
            .then(setRegistries)
            .catch(console.error);

    }, [loadSkills]);

    // 切换源时刷新
    useEffect(() => {
        // Reset page and reload when source changes
        setPage(0);
        setHasMore(true);
        loadSkills(query, 0, false);
    }, [selectedSource]); // eslint-disable-line react-hooks/exhaustive-deps

    // 搜索处理
    async function handleSearch() {
        setPage(0);
        setHasMore(true);
        await loadSkills(query, 0, false);
    }

    // 加载更多
    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            loadSkills(query, nextPage, true);
        }
    }, [loadingMore, hasMore, page, query, loadSkills]);

    // 无限滚动 IntersectionObserver
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, loadMore]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">{t.discover.title}</h1>
                <p className="text-base-content/60 mt-1">
                    {t.discover.description}
                </p>
            </div>

            {/* Search and Filter */}
            <div className="card bg-base-200 p-6">
                <div className="flex gap-4">
                    <div className="join flex-1">
                        <input
                            type="text"
                            placeholder={t.discover.searchPlaceholder}
                            className="input input-bordered join-item flex-1"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                        />
                        <button
                            onClick={handleSearch}
                            className="btn btn-primary join-item"
                            disabled={loading}
                        >
                            <Search className="w-5 h-5" />
                        </button>
                    </div>
                    <select
                        className="select select-bordered w-full max-w-xs"
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value)}
                    >
                        <option value="all">Check All</option>
                        {registries.map(r => (
                            <option key={r.name} value={r.name}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
            ) : filteredResults.length === 0 ? (
                <div className="card bg-base-200">
                    <div className="card-body items-center text-center py-12">
                        <Package className="w-16 h-16 text-base-content/30" />
                        <h2 className="card-title mt-4">{t.discover.searchForSkills}</h2>
                        <p className="text-base-content/60">
                            {t.discover.searchHint}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredResults.map((skill) => (
                        <div
                            key={skill.id}
                            className="card bg-base-200 hover:bg-base-300 transition-colors"
                        >
                            <div className="card-body">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center">
                                            <Package className="w-7 h-7 text-secondary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold">{skill.name || skill.id}</h3>
                                            <p className="text-sm text-base-content/60">
                                                {t.discover.by} {skill.author || t.discover.unknown} • v{skill.version}
                                            </p>
                                        </div>
                                    </div>
                                    {installedSkills.has(skill.id) ? (
                                        <button className="btn btn-success btn-sm gap-2" disabled>
                                            <Check className="w-4 h-4" />
                                            {t.common.installed || "已安装"}
                                        </button>
                                    ) : (
                                        <button
                                            className="btn btn-primary btn-sm gap-2"
                                            onClick={() => handleInstall(skill.id)}
                                            disabled={installingSkills.has(skill.id)}
                                        >
                                            {installingSkills.has(skill.id) ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4" />
                                            )}
                                            {installingSkills.has(skill.id)
                                                ? (t.common.installing || "安装中...")
                                                : t.common.install}
                                        </button>
                                    )}
                                </div>

                                <p className="text-base-content/70 mt-3">{skill.description}</p>

                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex flex-wrap gap-2">
                                        {skill.tags?.map((tag) => (
                                            <span key={tag} className="badge badge-outline badge-sm">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-base-content/60">
                                        <span className="flex items-center gap-1">
                                            <Download className="w-4 h-4" />
                                            {skill.downloads?.toLocaleString() || 0}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Star className="w-4 h-4 text-warning" />
                                            {skill.rating?.toFixed(1) || "N/A"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* 加载更多触发器 */}
                    <div ref={loaderRef} className="flex justify-center py-4">
                        {loadingMore && (
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        )}
                        {!hasMore && results.length > 0 && (
                            <p className="text-base-content/50 text-sm">已加载全部</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
