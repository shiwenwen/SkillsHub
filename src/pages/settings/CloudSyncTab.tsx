import {
    FolderOpen,
    Globe,
    Plus,
    Trash2,
    RefreshCw,
    Cloud,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import type { CloudDriveInfo, RegistryConfig } from "./types";

interface CloudSyncTabProps {
    cloudSyncEnabled: boolean;
    setCloudSyncEnabled: (v: boolean) => void;
    cloudProvider: string | null;
    handleCloudProviderChange: (provider: string) => void;
    cloudSyncFolder: string;
    setCloudSyncFolder: (v: string) => void;
    cloudAutoSync: boolean;
    setCloudAutoSync: (v: boolean) => void;
    cloudLastSync: string | null;
    cloudSyncing: boolean;
    handleCloudSync: () => void;
    detectedDrives: CloudDriveInfo[];
    selectDirectory: (setter: (path: string) => void) => void;
    registries: RegistryConfig[];
    setShowAddRegistryModal: (v: boolean) => void;
    toggleRegistry: (registry: RegistryConfig) => void;
    removeRegistry: (name: string) => void;
    t: Record<string, any>;
}

export default function CloudSyncTab({
    cloudSyncEnabled,
    setCloudSyncEnabled,
    cloudProvider,
    handleCloudProviderChange,
    cloudSyncFolder,
    setCloudSyncFolder,
    cloudAutoSync,
    setCloudAutoSync,
    cloudLastSync,
    cloudSyncing,
    handleCloudSync,
    detectedDrives,
    selectDirectory,
    registries,
    setShowAddRegistryModal,
    toggleRegistry,
    removeRegistry,
    t,
}: CloudSyncTabProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cloud Sync Config */}
            <Card title={t.settings.cloudSync} icon={<Cloud className="w-5 h-5 text-primary" />}>
                <div className="form-control mb-6">
                    <label className="label cursor-pointer justify-start gap-4">
                        <input
                            type="checkbox"
                            className="toggle toggle-primary toggle-lg"
                            checked={cloudSyncEnabled}
                            onChange={(e) => setCloudSyncEnabled(e.target.checked)}
                        />
                        <div>
                            <span className="label-text font-medium block">{t.settings.cloudSync}</span>
                            <span className="label-text-alt text-base-content/60">{t.settings.cloudSyncDescription}</span>
                        </div>
                    </label>
                </div>

                {cloudSyncEnabled && (
                    <div className="space-y-4 bg-base-200/50 p-4 rounded-xl border border-base-300/50">
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">{t.settings.cloudProvider}</span>
                            </label>
                            <select
                                className="select select-bordered w-full"
                                value={cloudProvider || ""}
                                onChange={(e) => handleCloudProviderChange(e.target.value)}
                            >
                                <option value="" disabled>{t.settings.selectProvider}</option>
                                {[
                                    { value: "ICloud", label: "iCloud Drive" },
                                    { value: "GoogleDrive", label: "Google Drive" },
                                    { value: "OneDrive", label: "OneDrive" },
                                ].map((p) => {
                                    const detected = detectedDrives.find(d => d.provider === p.value);
                                    return (
                                        <option key={p.value} value={p.value}>
                                            {detected ? detected.display_name : p.label}
                                        </option>
                                    );
                                })}
                                <option value="Custom">{t.settings.customFolder}</option>
                            </select>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">{t.settings.cloudSyncFolder}</span>
                            </label>
                            <div className="flex gap-2 w-full">
                                <input
                                    type="text"
                                    className="input input-bordered flex-1 font-mono text-sm"
                                    value={cloudSyncFolder}
                                    onChange={(e) => setCloudSyncFolder(e.target.value)}
                                    readOnly={!!detectedDrives.find(d => d.provider === cloudProvider)}
                                />
                                {!detectedDrives.find(d => d.provider === cloudProvider) && (
                                    <Button
                                        variant="ghost"
                                        className="border-base-300 bg-base-100"
                                        onClick={() => selectDirectory(setCloudSyncFolder)}
                                    >
                                        <FolderOpen className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="form-control">
                            <label className="label cursor-pointer justify-start gap-3">
                                <input
                                    type="checkbox"
                                    className="toggle toggle-sm toggle-primary"
                                    checked={cloudAutoSync}
                                    onChange={(e) => setCloudAutoSync(e.target.checked)}
                                />
                                <span className="label-text">{t.settings.cloudAutoSync}</span>
                            </label>
                        </div>

                        <div className="divider my-2"></div>

                        <div className="flex items-center justify-between">
                            <div className="text-xs text-base-content/50">
                                {cloudLastSync ?
                                    `${t.settings.lastCloudSync}: ${new Date(Number(cloudLastSync) * 1000).toLocaleString()}` :
                                    "No sync history"}
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleCloudSync}
                                disabled={cloudSyncing || !cloudSyncFolder}
                                loading={cloudSyncing}
                            >
                                <RefreshCw className="w-3 h-3 mr-2" />
                                {t.settings.syncNow}
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Registries */}
            <Card title={t.settings.registries} icon={<Globe className="w-5 h-5 text-secondary" />}>
                <div className="flex justify-end mb-4">
                    <Button size="sm" variant="outline" onClick={() => setShowAddRegistryModal(true)}>
                        <Plus className="w-4 h-4 mr-2" /> {t.settings.addRegistry}
                    </Button>
                </div>
                <div className="space-y-3">
                    {registries.length === 0 ? (
                        <div className="text-center py-8 text-base-content/50 bg-base-200/30 rounded-xl border border-dashed border-base-300">
                            {t.common.loading || "No registries configuration"}
                        </div>
                    ) : (
                        registries.map((registry) => (
                            <div key={registry.name} className="flex items-start gap-4 p-4 bg-base-200/50 rounded-xl border border-base-300/50 hover:border-primary/30 transition-colors">
                                <input
                                    type="checkbox"
                                    className="toggle toggle-sm toggle-success mt-1"
                                    checked={registry.enabled}
                                    onChange={() => toggleRegistry(registry)}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold">{registry.name}</span>
                                        {registry.tags.map(tag => (
                                            <Badge key={tag} variant="outline" size="xs">{tag}</Badge>
                                        ))}
                                    </div>
                                    <p className="text-xs text-base-content/60 font-mono mt-1 break-all select-all">
                                        {registry.url}
                                    </p>
                                    {registry.description && (
                                        <p className="text-xs text-base-content/50 mt-2 line-clamp-2">
                                            {registry.description}
                                        </p>
                                    )}
                                </div>
                                <Button variant="ghost" size="sm" className="text-error" onClick={() => removeRegistry(registry.name)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
}
