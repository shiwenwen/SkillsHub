import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Package, Download, Star, Loader2 } from "lucide-react";
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

    const PAGE_SIZE = 20;

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
    }, [loadSkills]);

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

            {/* Search */}
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
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
            ) : results.length === 0 ? (
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
                    {results.map((skill) => (
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
                                    <button className="btn btn-primary btn-sm gap-2">
                                        <Download className="w-4 h-4" />
                                        {t.common.install}
                                    </button>
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
