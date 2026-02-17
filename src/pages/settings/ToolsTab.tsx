import {
    FolderOpen,
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    Search,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import type { ToolConfig } from "./types";

interface ToolsTabProps {
    tools: ToolConfig[];
    customTools: ToolConfig[];
    toolFilter: string;
    setToolFilter: (v: string) => void;
    expandedTools: Set<string>;
    toggleToolExpand: (toolId: string) => void;
    updateToolPath: (toolId: string, field: "globalPath" | "projectPath", value: string) => void;
    toolSyncStrategies: Record<string, string>;
    setToolSyncStrategies: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    deleteCustomTool: (toolId: string) => void;
    setShowAddToolModal: (v: boolean) => void;
    selectDirectory: (setter: (path: string) => void) => void;
    t: Record<string, any>;
}

function ToolItem({
    tool,
    isExpanded,
    toggleToolExpand,
    updateToolPath,
    toolSyncStrategies,
    setToolSyncStrategies,
    deleteCustomTool,
    selectDirectory,
    t,
}: {
    tool: ToolConfig;
    isExpanded: boolean;
    toggleToolExpand: (toolId: string) => void;
    updateToolPath: (toolId: string, field: "globalPath" | "projectPath", value: string) => void;
    toolSyncStrategies: Record<string, string>;
    setToolSyncStrategies: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    deleteCustomTool: (toolId: string) => void;
    selectDirectory: (setter: (path: string) => void) => void;
    t: Record<string, any>;
}) {
    return (
        <div className="bg-base-200/50 rounded-xl overflow-hidden border border-base-300/50 transition-all duration-200">
            {/* Tool Header */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-base-300/30 transition-colors"
                onClick={() => toggleToolExpand(tool.id)}
            >
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-base">{tool.name}</span>
                    <div className="flex gap-2">
                        {tool.detected ? (
                            <Badge variant="success" size="sm" className="hidden sm:inline-flex">{t.common.detected || "Detected"}</Badge>
                        ) : (
                            <Badge variant="neutral" size="sm" className="hidden sm:inline-flex">{t.common.notFound || "Not Found"}</Badge>
                        )}
                        {tool.isCustom && <Badge variant="primary" size="sm">{t.settings.customTool}</Badge>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {tool.isCustom && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-error hover:bg-error/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomTool(tool.id);
                            }}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-base-300/50 pt-4 bg-base-300/10">
                    {/* Global Path */}
                    {tool.hasGlobalPath !== false && (
                        <div className="form-control">
                            <label className="label py-1">
                                <span className="label-text text-xs font-medium text-base-content/60 uppercase tracking-wider">
                                    {t.settings.globalPath}
                                </span>
                            </label>
                            <div className="join w-full">
                                <input
                                    type="text"
                                    className="input input-bordered input-sm join-item flex-1 font-mono text-xs bg-base-100"
                                    value={tool.globalPath}
                                    onChange={(e) => updateToolPath(tool.id, "globalPath", e.target.value)}
                                    placeholder={t.settings.noGlobalPath}
                                />
                                <button
                                    className="btn btn-ghost btn-sm join-item bg-base-200 border-base-300"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectDirectory((path) => updateToolPath(tool.id, "globalPath", path));
                                    }}
                                >
                                    <FolderOpen className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Project Path */}
                    <div className="form-control">
                        <label className="label py-1">
                            <span className="label-text text-xs font-medium text-base-content/60 uppercase tracking-wider">
                                {t.settings.projectPath}
                            </span>
                        </label>
                        <div className="join w-full">
                            <input
                                type="text"
                                className="input input-bordered input-sm join-item flex-1 font-mono text-xs bg-base-100"
                                value={tool.projectPath}
                                onChange={(e) => updateToolPath(tool.id, "projectPath", e.target.value)}
                                placeholder=".tool/skills/"
                            />
                            <button className="btn btn-ghost btn-sm join-item bg-base-200 border-base-300">
                                <FolderOpen className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Per-tool Sync Strategy */}
                    <div className="form-control">
                        <label className="label py-1">
                            <span className="label-text text-xs font-medium text-base-content/60 uppercase tracking-wider">
                                {t.settings.toolSyncStrategy}
                            </span>
                        </label>
                        <select
                            className="select select-bordered select-sm w-full bg-base-100"
                            value={toolSyncStrategies[tool.id] || ""}
                            onChange={(e) => {
                                const value = e.target.value;
                                setToolSyncStrategies(prev => {
                                    const next = { ...prev };
                                    if (value === "") {
                                        delete next[tool.id];
                                    } else {
                                        next[tool.id] = value;
                                    }
                                    return next;
                                });
                            }}
                        >
                            <option value="">{t.settings.useGlobalStrategy}</option>
                            <option value="auto">{t.settings.autoLinkFirst}</option>
                            <option value="link">{t.settings.alwaysLink}</option>
                            <option value="copy">{t.settings.alwaysCopy}</option>
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ToolsTab({
    tools,
    customTools,
    toolFilter,
    setToolFilter,
    expandedTools,
    toggleToolExpand,
    updateToolPath,
    toolSyncStrategies,
    setToolSyncStrategies,
    deleteCustomTool,
    setShowAddToolModal,
    selectDirectory,
    t,
}: ToolsTabProps) {
    const renderToolItem = (tool: ToolConfig) => {
        const matchesFilter = tool.name.toLowerCase().includes(toolFilter.toLowerCase());
        if (!matchesFilter) return null;

        return (
            <ToolItem
                key={tool.id}
                tool={tool}
                isExpanded={expandedTools.has(tool.id)}
                toggleToolExpand={toggleToolExpand}
                updateToolPath={updateToolPath}
                toolSyncStrategies={toolSyncStrategies}
                setToolSyncStrategies={setToolSyncStrategies}
                deleteCustomTool={deleteCustomTool}
                selectDirectory={selectDirectory}
                t={t}
            />
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-base-200/30 p-4 rounded-2xl border border-base-300/30 backdrop-blur-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50" />
                    <input
                        type="text"
                        className="input input-bordered pl-10 w-full bg-base-100"
                        placeholder={t.common.search || "Search tools..."}
                        value={toolFilter}
                        onChange={(e) => setToolFilter(e.target.value)}
                    />
                </div>
                <Button
                    variant="primary"
                    onClick={() => setShowAddToolModal(true)}
                    className="w-full md:w-auto"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    {t.settings.addCustomTool}
                </Button>
            </div>

            <div className="space-y-4">
                {tools.map(renderToolItem)}
                {customTools.length > 0 && (
                    <>
                        <div className="divider text-base-content/30 text-sm font-medium">{t.settings.customTools}</div>
                        {customTools.map(renderToolItem)}
                    </>
                )}
            </div>
        </div>
    );
}
