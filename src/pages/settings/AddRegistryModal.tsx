import { Button } from "../../components/ui/Button";

interface AddRegistryModalProps {
    newRegistryName: string;
    setNewRegistryName: (v: string) => void;
    newRegistryUrl: string;
    setNewRegistryUrl: (v: string) => void;
    newRegistryBranch: string;
    setNewRegistryBranch: (v: string) => void;
    newRegistryDescription: string;
    setNewRegistryDescription: (v: string) => void;
    addRegistry: () => void;
    isRegistryLoading: boolean;
    onClose: () => void;
    t: Record<string, any>;
}

export default function AddRegistryModal({
    newRegistryName,
    setNewRegistryName,
    newRegistryUrl,
    setNewRegistryUrl,
    newRegistryBranch,
    setNewRegistryBranch,
    newRegistryDescription,
    setNewRegistryDescription,
    addRegistry,
    isRegistryLoading,
    onClose,
    t,
}: AddRegistryModalProps) {
    return (
        <div className="modal modal-open">
            <div className="modal-box glass-panel">
                <h3 className="font-bold text-lg mb-6">{t.settings.addRegistry}</h3>
                <div className="space-y-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Name</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered"
                            placeholder="my-registry"
                            value={newRegistryName}
                            onChange={(e) => setNewRegistryName(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Git URL</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered font-mono text-sm"
                            placeholder="https://github.com/user/repo"
                            value={newRegistryUrl}
                            onChange={(e) => setNewRegistryUrl(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Branch (Optional)</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered font-mono text-sm"
                            placeholder="main"
                            value={newRegistryBranch}
                            onChange={(e) => setNewRegistryBranch(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Description (Optional)</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered"
                            placeholder="Description..."
                            value={newRegistryDescription}
                            onChange={(e) => setNewRegistryDescription(e.target.value)}
                        />
                    </div>
                </div>
                <div className="modal-action">
                    <Button variant="ghost" onClick={onClose}>
                        {t.common.cancel}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={addRegistry}
                        disabled={!newRegistryName.trim() || !newRegistryUrl.trim() || isRegistryLoading}
                        loading={isRegistryLoading}
                    >
                        {t.settings.addRegistry}
                    </Button>
                </div>
            </div>
            <div className="modal-backdrop bg-base-100/80 backdrop-blur-sm" onClick={onClose} />
        </div>
    );
}
