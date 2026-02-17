import { Shield } from "lucide-react";
import { Card } from "../../components/ui/Card";

interface SecurityTabProps {
    scanBeforeInstall: boolean;
    setScanBeforeInstall: (v: boolean) => void;
    scanBeforeUpdate: boolean;
    setScanBeforeUpdate: (v: boolean) => void;
    blockHighRisk: boolean;
    setBlockHighRisk: (v: boolean) => void;
    t: Record<string, any>;
}

export default function SecurityTab({
    scanBeforeInstall,
    setScanBeforeInstall,
    scanBeforeUpdate,
    setScanBeforeUpdate,
    blockHighRisk,
    setBlockHighRisk,
    t,
}: SecurityTabProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title={t.settings.security} icon={<Shield className="w-5 h-5 text-error" />}>
                <div className="space-y-4">
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4 p-3 bg-base-200/30 rounded-lg hover:bg-base-200/50 transition-colors">
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={scanBeforeInstall}
                                onChange={(e) => setScanBeforeInstall(e.target.checked)}
                            />
                            <div>
                                <span className="label-text block font-medium">{t.settings.scanBeforeInstall}</span>
                                <span className="label-text-alt text-base-content/60">{t.settings.scanBeforeInstallDesc}</span>
                            </div>
                        </label>
                    </div>
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4 p-3 bg-base-200/30 rounded-lg hover:bg-base-200/50 transition-colors">
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={scanBeforeUpdate}
                                onChange={(e) => setScanBeforeUpdate(e.target.checked)}
                            />
                            <div>
                                <span className="label-text block font-medium">{t.settings.scanBeforeUpdate}</span>
                                <span className="label-text-alt text-base-content/60">{t.settings.scanBeforeUpdateDesc}</span>
                            </div>
                        </label>
                    </div>
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4 p-3 bg-error/10 rounded-lg hover:bg-error/20 transition-colors">
                            <input
                                type="checkbox"
                                className="toggle toggle-error"
                                checked={blockHighRisk}
                                onChange={(e) => setBlockHighRisk(e.target.checked)}
                            />
                            <div>
                                <span className="label-text block font-medium text-error">{t.settings.blockHighRisk}</span>
                                <span className="label-text-alt text-error/60">{t.settings.blockHighRiskDesc}</span>
                            </div>
                        </label>
                    </div>
                </div>
            </Card>
        </div>
    );
}
