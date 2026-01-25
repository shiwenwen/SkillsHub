import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Package, Download, Star, Tag } from "lucide-react";
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
    const [loading, setLoading] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const popularTags = [
        "coding",
        "testing",
        "documentation",
        "devops",
        "security",
        "database",
    ];

    async function handleSearch() {
        setLoading(true);
        try {
            const result = await invoke<SkillListing[]>("search_skills", {
                query,
            });
            setResults(result);
        } catch (error) {
            console.error("Search failed:", error);
        }
        setLoading(false);
    }

    function toggleTag(tag: string) {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    }

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
                        >
                            <Search className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tag Filters */}
                <div className="flex flex-wrap gap-2 mt-4">
                    {popularTags.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`badge badge-lg gap-1 cursor-pointer transition-colors ${selectedTags.includes(tag)
                                ? "badge-primary"
                                : "badge-outline hover:badge-primary"
                                }`}
                        >
                            <Tag className="w-3 h-3" />
                            {tag}
                        </button>
                    ))}
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
                        <Search className="w-16 h-16 text-base-content/30" />
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
                                            <h3 className="text-lg font-bold">{skill.name}</h3>
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
                </div>
            )}

            {/* Featured Section */}
            <div className="card bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
                <div className="card-body">
                    <h2 className="card-title">
                        <Star className="w-5 h-5 text-warning" />
                        {t.discover.featuredSkills}
                    </h2>
                    <p className="text-base-content/60">
                        {t.discover.curatedSkills}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        {["Code Review", "API Testing", "Documentation"].map((name) => (
                            <div key={name} className="glass-card p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                        <Package className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{name}</p>
                                        <p className="text-xs text-base-content/60">{t.common.popular}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
