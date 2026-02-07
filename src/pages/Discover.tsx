import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Package, Download, Star, Loader2, Check, Filter } from "lucide-react";
import { useTranslation } from "../i18n";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

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

interface AppConfig {
    scan_before_install: boolean;
    block_high_risk: boolean;
    auto_sync_on_install: boolean;
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

    // Filtered results
    const filteredResults = results.filter(skill => {
        if (selectedSource === "all") return true;

        const skillSource = skill.source;
        const registry = registries.find(r => r.name === selectedSource);
        if (!registry) return true;

        if (registry.registry_type === "Git") {
            return skillSource === `git:${registry.url}`;
        }
        if (registry.registry_type === "ClawHub") {
            return skillSource.includes("clawdhub") || skillSource.includes("clawhub");
        }

        return true;
    });

    // 安装 Skill
    const handleInstall = async (skillId: string) => {
        setInstallingSkills(prev => new Set(prev).add(skillId));

        try {
            const config = await invoke<AppConfig>("get_app_config");

            if (config.scan_before_install) {
                try {
                    const scanResult = await invoke<{ overall_risk: string; findings: unknown[] }>("scan_skill", {
                        skillId: skillId,
                    });

                    if (config.block_high_risk && scanResult.overall_risk === "high") {
                        alert(`Installation blocked: Skill "${skillId}" detected as high risk.`);
                        return;
                    }
                } catch (scanError) {
                    console.warn("Security scan failed, proceeding with install:", scanError);
                }
            }

            await invoke<string>("install_skill", {
                skillId: skillId,
                tools: [],
            });

            setInstalledSkills(prev => new Set(prev).add(skillId));

            if (config.auto_sync_on_install) {
                try {
                    await invoke("full_sync_skills");
                    console.log("Auto sync completed after install");
                } catch (syncError) {
                    console.error("Auto sync failed:", syncError);
                }
            }
        } catch (error) {
            console.error("Install failed:", error);
            alert(`Installation failed: ${error}`);
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
        invoke<RegistryConfig[]>("list_registries")
            .then(setRegistries)
            .catch(console.error);
    }, [loadSkills]);

    // 切换源时刷新
    useEffect(() => {
        setPage(0);
        setHasMore(true);
        loadSkills(query, 0, false);
    }, [selectedSource]);

    async function handleSearch() {
        setPage(0);
        setHasMore(true);
        await loadSkills(query, 0, false);
    }

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
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                    {t.discover.title}
                </h1>
                <p className="text-base-content/60 mt-1">
                    {t.discover.description}
                </p>
            </div>

            {/* Search and Toolbar */}
            <div className="sticky top-0 z-10 bg-base-100/80 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 border-b border-base-200/50">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="join flex-1 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" />
                            <input
                                type="text"
                                placeholder={t.discover.searchPlaceholder}
                                className="input input-bordered w-full pl-10 join-item bg-base-200/50 focus:bg-base-100 transition-colors"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <Button
                            variant="primary"
                            className="join-item"
                            onClick={handleSearch}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.common.search || "Search"}
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 min-w-[200px]">
                        <Filter className="w-4 h-4 text-base-content/50" />
                        <select
                            className="select select-bordered flex-1 bg-base-200/50 focus:bg-base-100 transition-colors"
                            value={selectedSource}
                            onChange={(e) => setSelectedSource(e.target.value)}
                        >
                            <option value="all">All Sources</option>
                            {registries.map(r => (
                                <option key={r.name} value={r.name}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Results Grid */}
            {loading && page === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                    <p className="text-base-content/50 animate-pulse">{t.common.loading}</p>
                </div>
            ) : filteredResults.length === 0 ? (
                <div className="glass-panel p-12 text-center rounded-2xl border-dashed border-2 border-base-300">
                    <div className="w-20 h-20 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Package className="w-10 h-10 text-base-content/30" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">{t.discover.searchForSkills}</h2>
                    <p className="text-base-content/60 max-w-md mx-auto">
                        {t.discover.searchHint}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredResults.map((skill) => (
                        <Card
                            key={skill.id}
                            className="flex flex-col h-full hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
                            noPadding
                        >
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/10 to-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <Package className="w-6 h-6 text-secondary" />
                                    </div>
                                    <Badge variant="outline" size="xs" className="font-mono">v{skill.version}</Badge>
                                </div>

                                <div className="mb-2">
                                    <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-1" title={skill.name}>
                                        {skill.name || skill.id}
                                    </h3>
                                    <p className="text-xs text-base-content/50">
                                        by {skill.author || "Unknown"}
                                    </p>
                                </div>

                                <p className="text-sm text-base-content/70 mb-4 line-clamp-3 flex-1">
                                    {skill.description}
                                </p>

                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {skill.tags?.slice(0, 3).map((tag) => (
                                        <Badge key={tag} variant="neutral" size="xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                    {skill.tags?.length > 3 && (
                                        <Badge variant="neutral" size="xs">+{skill.tags.length - 3}</Badge>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-base-200/50 mt-auto">
                                    <div className="flex items-center gap-3 text-xs text-base-content/50 font-medium">
                                        <span className="flex items-center gap-1" title="Downloads">
                                            <Download className="w-3.5 h-3.5" />
                                            {skill.downloads?.toLocaleString() || 0}
                                        </span>
                                        <span className="flex items-center gap-1" title="Rating">
                                            <Star className="w-3.5 h-3.5 text-warning/80 fill-warning/20" />
                                            {skill.rating?.toFixed(1) || "-"}
                                        </span>
                                    </div>

                                    {installedSkills.has(skill.id) ? (
                                        <Button variant="ghost" size="sm" className="text-success cursor-default hover:bg-transparent px-2 h-8 min-h-0">
                                            <Check className="w-4 h-4 mr-1" />
                                            Installed
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            className="h-8 min-h-0 px-3 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleInstall(skill.id)}
                                            disabled={installingSkills.has(skill.id)}
                                            loading={installingSkills.has(skill.id)}
                                        >
                                            <Download className="w-3.5 h-3.5 mr-1" />
                                            Install
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Load More Trigger */}
            <div ref={loaderRef} className="flex justify-center py-8">
                {loadingMore && (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="text-xs text-base-content/40">Loading more skills...</span>
                    </div>
                )}
                {!hasMore && results.length > 0 && (
                    <div className="divider text-xs text-base-content/30 w-full max-w-sm mx-auto">End of Results</div>
                )}
            </div>
        </div>
    );
}
