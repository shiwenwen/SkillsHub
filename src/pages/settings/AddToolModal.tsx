import { FolderOpen } from "lucide-react";
import { Button } from "../../components/ui/Button";

interface AddToolModalProps {
    newToolName: string;
    setNewToolName: (v: string) => void;
    newToolGlobalPath: string;
    setNewToolGlobalPath: (v: string) => void;
    newToolProjectPath: string;
    setNewToolProjectPath: (v: string) => void;
    addCustomTool: () => void;
    isLoading: boolean;
    onClose: () => void;
    selectDirectory: (setter: (path: string) => void) => void;
    t: Record<string, any>;
}

export default function AddToolModal({
    newToolName,
    setNewToolName,
    newToolGlobalPath,
    setNewToolGlobalPath,
    newToolProjectPath,
    setNewToolProjectPath,
    addCustomTool,
    isLoading,
    onClose,
    selectDirectory,
    t,
}: AddToolModalProps) {
    return (
        <div className="modal modal-open">
            <div className="modal-box glass-panel">
                <h3 className="font-bold text-lg mb-6">{t.settings.addCustomTool}</h3>
                <div className="space-y-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t.settings.toolName}</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered"
                            placeholder={t.settings.toolNamePlaceholder}
                            value={newToolName}
                            onChange={(e) => setNewToolName(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t.settings.globalPath}</span>
                        </label>
                        <div className="join w-full">
                            <input
                                type="text"
                                className="input input-bordered font-mono text-sm join-item flex-1"
                                placeholder="~/.tool/skills/"
                                value={newToolGlobalPath}
                                onChange={(e) => setNewToolGlobalPath(e.target.value)}
                            />
                            <button
                                className="btn btn-ghost join-item"
                                onClick={() => selectDirectory(setNewToolGlobalPath)}
                                type="button"
                            >
                                <FolderOpen className="w-4 h-4" />
                            </button>
                        </div>
                        <span className="label-text-alt text-base-content/50 mt-1">
                            {t.settings.globalPathHint}
                        </span>
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t.settings.projectPath}</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered font-mono text-sm"
                            placeholder=".tool/skills/"
                            value={newToolProjectPath}
                            onChange={(e) => setNewToolProjectPath(e.target.value)}
                        />
                        <span className="label-text-alt text-base-content/50 mt-1">
                            {t.settings.projectPathHint}
                        </span>
                    </div>
                </div>
                <div className="modal-action">
                    <Button variant="ghost" onClick={onClose}>
                        {t.common.cancel}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={addCustomTool}
                        disabled={!newToolName.trim() || isLoading}
                        loading={isLoading}
                    >
                        {t.settings.addTool}
                    </Button>
                </div>
            </div>
            <div className="modal-backdrop bg-base-100/80 backdrop-blur-sm" onClick={onClose} />
        </div>
    );
}
