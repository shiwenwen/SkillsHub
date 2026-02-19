import {
    Languages,
    Palette,
    Settings as SettingsIcon,
    FolderOpen,
    Sun,
    Moon,
    Monitor,
} from "lucide-react";
import { type Language } from "../../i18n";
import { type ThemeMode } from "../../theme";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import type { StoreInfo } from "./types";

interface GeneralTabProps {
    language: Language;
    setLanguage: (lang: Language) => void;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    defaultStrategy: string;
    setDefaultStrategy: (strategy: string) => void;
    autoSyncOnInstall: boolean;
    setAutoSyncOnInstall: (v: boolean) => void;
    checkUpdatesOnStartup: boolean;
    setCheckUpdatesOnStartup: (v: boolean) => void;
    autoCheckUpdateInterval: number;
    setAutoCheckUpdateInterval: (v: number) => void;
    storeInfo: StoreInfo | null;
    t: Record<string, any>;
}

export default function GeneralTab({
    language,
    setLanguage,
    themeMode,
    setThemeMode,
    defaultStrategy,
    setDefaultStrategy,
    autoSyncOnInstall,
    setAutoSyncOnInstall,
    checkUpdatesOnStartup,
    setCheckUpdatesOnStartup,
    autoCheckUpdateInterval,
    setAutoCheckUpdateInterval,
    storeInfo,
    t,
}: GeneralTabProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title={t.settings.language} icon={<Languages className="w-5 h-5 text-primary" />}>
                <div className="form-control">
                    <label className="label">
                        <span className="label-text">{t.settings.languageDescription}</span>
                    </label>
                    <select
                        className="select select-bordered w-full"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as Language)}
                    >
                        <option value="zh">{t.settings.chinese}</option>
                        <option value="en">{t.settings.english}</option>
                        <option value="ja">日本語</option>
                        <option value="ko">한국어</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="es">Español</option>
                        <option value="pt">Português</option>
                        <option value="ru">Русский</option>
                    </select>
                </div>
            </Card>

            <Card title={t.settings.theme} icon={<Palette className="w-5 h-5 text-accent" />}>
                <div className="form-control">
                    <label className="label">
                        <span className="label-text">{t.settings.themeDescription}</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {([
                            { mode: "auto" as ThemeMode, icon: Monitor, label: t.settings.themeAuto, desc: t.settings.themeAutoDescription },
                            { mode: "light" as ThemeMode, icon: Sun, label: t.settings.themeLight, desc: t.settings.themeLightDescription },
                            { mode: "dark" as ThemeMode, icon: Moon, label: t.settings.themeDark, desc: t.settings.themeDarkDescription },
                        ]).map((opt) => (
                            <button
                                key={opt.mode}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                                    themeMode === opt.mode
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-base-300 bg-base-200/50 text-base-content/60 hover:border-base-content/20"
                                }`}
                                onClick={() => setThemeMode(opt.mode)}
                            >
                                <opt.icon className="w-6 h-6" />
                                <span className="text-sm font-medium">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            <Card title={t.settings.general} icon={<SettingsIcon className="w-5 h-5 text-secondary" />}>
                <div className="space-y-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t.settings.defaultSyncStrategy}</span>
                        </label>
                        <select
                            className="select select-bordered w-full"
                            value={defaultStrategy}
                            onChange={(e) => setDefaultStrategy(e.target.value)}
                        >
                            <option value="auto">{t.settings.autoLinkFirst}</option>
                            <option value="link">{t.settings.alwaysLink}</option>
                            <option value="copy">{t.settings.alwaysCopy}</option>
                        </select>
                    </div>
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4">
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={autoSyncOnInstall}
                                onChange={(e) => setAutoSyncOnInstall(e.target.checked)}
                            />
                            <span className="label-text">{t.settings.autoSyncOnInstall}</span>
                        </label>
                    </div>
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4">
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={checkUpdatesOnStartup}
                                onChange={(e) => setCheckUpdatesOnStartup(e.target.checked)}
                            />
                            <span className="label-text">{t.settings.checkUpdatesOnStartup}</span>
                        </label>
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t.settings.autoCheckUpdateInterval}</span>
                        </label>
                        <select
                            className="select select-bordered w-full"
                            value={autoCheckUpdateInterval}
                            onChange={(e) => setAutoCheckUpdateInterval(Number(e.target.value))}
                        >
                            <option value={0}>{t.settings.autoCheckDisabled}</option>
                            <option value={30}>{t.settings.autoCheck30Min}</option>
                            <option value={60}>{t.settings.autoCheck1Hour}</option>
                            <option value={120}>{t.settings.autoCheck2Hours}</option>
                            <option value={240}>{t.settings.autoCheck4Hours}</option>
                            <option value={480}>{t.settings.autoCheck8Hours}</option>
                        </select>
                    </div>
                </div>
            </Card>

            <Card title={t.settings.storage} icon={<FolderOpen className="w-5 h-5 text-accent" />}>
                <div className="form-control">
                    <label className="label">
                        <span className="label-text">{t.settings.localStoreLocation}</span>
                    </label>
                    <div className="join w-full">
                        <input
                            type="text"
                            className="input input-bordered join-item flex-1 font-mono text-sm"
                            value={storeInfo?.path || t.common.loading}
                            readOnly
                        />
                        <Button
                            variant="ghost"
                            className="join-item border-base-300 bg-base-200"
                            onClick={() => storeInfo?.path && invoke("open_directory", { path: storeInfo.path })}
                            disabled={!storeInfo?.path}
                        >
                            <FolderOpen className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-base-200/50 p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold">{storeInfo?.size_display || "--"}</div>
                        <div className="text-xs text-base-content/60 uppercase tracking-wide mt-1">{t.settings.storageUsed}</div>
                    </div>
                    <div className="bg-base-200/50 p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold">{storeInfo?.skill_count ?? "--"}</div>
                        <div className="text-xs text-base-content/60 uppercase tracking-wide mt-1">{t.settings.skillsStored}</div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
