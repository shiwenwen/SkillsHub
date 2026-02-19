import {
    UserRound,
    Github,
    Box,
    ExternalLink,
    Download,
    RotateCw,
    CheckCircle2,
    AlertCircle,
    Loader2,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { useAppUpdate } from "../../hooks/useAppUpdate";
import logoImg from "../../assets/logo.png";

interface AboutTabProps {
    t: Record<string, any>;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AboutTab({ t }: AboutTabProps) {
    const {
        status,
        version,
        body,
        progress,
        contentLength,
        downloaded,
        error,
        checkForUpdate,
        downloadAndInstall,
        installAndRelaunch,
    } = useAppUpdate();

    const renderUpdateSection = () => {
        switch (status) {
            case "idle":
                return (
                    <button
                        type="button"
                        className="btn btn-primary gap-2"
                        onClick={checkForUpdate}
                    >
                        <Box className="h-4 w-4" />
                        {t.settings.aboutCheckUpdate}
                    </button>
                );

            case "checking":
                return (
                    <button
                        type="button"
                        className="btn btn-primary gap-2"
                        disabled
                    >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.settings.updateChecking}
                    </button>
                );

            case "upToDate":
                return (
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-4 py-2 text-sm text-success font-medium">
                            <CheckCircle2 className="h-4 w-4" />
                            {t.settings.updateUpToDate}
                        </div>
                        <div>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm gap-2"
                                onClick={checkForUpdate}
                            >
                                <RotateCw className="h-3 w-3" />
                                {t.settings.updateCheckAgain}
                            </button>
                        </div>
                    </div>
                );

            case "available":
                return (
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-info/40 bg-info/10 px-4 py-2 text-sm text-info font-medium">
                            <Download className="h-4 w-4" />
                            {t.settings.updateAvailable}: v{version}
                        </div>
                        {body && (
                            <div className="mx-auto max-w-md rounded-xl border border-base-content/10 bg-base-100/50 p-4 text-left text-sm text-base-content/70">
                                <p className="font-medium text-base-content mb-1">{t.settings.updateReleaseNotes}</p>
                                <p className="whitespace-pre-line">{body}</p>
                            </div>
                        )}
                        <button
                            type="button"
                            className="btn btn-primary gap-2"
                            onClick={downloadAndInstall}
                        >
                            <Download className="h-4 w-4" />
                            {t.settings.updateDownloadInstall}
                        </button>
                    </div>
                );

            case "downloading":
                return (
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 text-sm text-base-content/70">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t.settings.updateDownloading}
                            {contentLength
                                ? ` ${formatBytes(downloaded)} / ${formatBytes(contentLength)}`
                                : ""}
                        </div>
                        <div className="mx-auto w-64">
                            <progress
                                className="progress progress-primary w-full"
                                value={progress}
                                max="100"
                            />
                            <p className="text-xs text-base-content/50 mt-1">
                                {progress}%
                            </p>
                        </div>
                    </div>
                );

            case "ready":
                return (
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-4 py-2 text-sm text-success font-medium">
                            <CheckCircle2 className="h-4 w-4" />
                            {t.settings.updateReadyRestart}
                        </div>
                        <div>
                            <button
                                type="button"
                                className="btn btn-primary gap-2"
                                onClick={installAndRelaunch}
                            >
                                <RotateCw className="h-4 w-4" />
                                {t.settings.updateRestartNow}
                            </button>
                        </div>
                    </div>
                );

            case "error":
                return (
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-error/40 bg-error/10 px-4 py-2 text-sm text-error font-medium">
                            <AlertCircle className="h-4 w-4" />
                            {t.settings.updateError}
                        </div>
                        {error && (
                            <p className="text-xs text-base-content/50 max-w-md mx-auto break-all">
                                {error}
                            </p>
                        )}
                        <div>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm gap-2"
                                onClick={checkForUpdate}
                            >
                                <RotateCw className="h-3 w-3" />
                                {t.settings.updateRetry}
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-8">
            <div className="relative overflow-hidden rounded-3xl border border-base-content/10 bg-gradient-to-br from-base-200/75 via-base-200/40 to-base-100/60 p-8 md:p-10 shadow-2xl">
                <div className="absolute inset-y-0 left-1/2 hidden w-80 -translate-x-1/2 bg-primary/10 blur-3xl md:block" />

                <div className="relative text-center space-y-6">
                    <img src={logoImg} alt="SkillsHub" className="w-24 h-24 rounded-3xl mx-auto shadow-2xl shadow-primary/30" />
                    <div>
                        <h2 className="text-4xl font-bold mb-2">SkillsHub</h2>
                        <p className="text-lg text-base-content/70">{t.settings.aboutSubtitle}</p>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm text-primary font-medium">
                        {t.common.version} {t.settings.aboutVersion}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 text-left">
                        <div className="rounded-2xl border border-base-content/10 bg-base-100/50 p-5">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary">
                                <UserRound className="h-6 w-6" />
                            </div>
                            <p className="text-sm text-base-content/60">{t.settings.aboutAuthorLabel}</p>
                            <p className="mt-1 text-2xl font-semibold">Ctrler</p>
                        </div>

                        <div className="rounded-2xl border border-base-content/10 bg-base-100/50 p-5">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/20 text-secondary">
                                <Github className="h-6 w-6" />
                            </div>
                            <p className="text-sm text-base-content/60">{t.settings.aboutOpenSourceLabel}</p>
                            <a
                                href="https://github.com/100skills/SkillsHub"
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xl font-semibold link link-hover"
                            >
                                {t.settings.aboutOpenSourceAction}
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                        <Badge variant="ghost">Tauri v2</Badge>
                        <Badge variant="ghost">React 18</Badge>
                        <Badge variant="ghost">TypeScript</Badge>
                        <Badge variant="ghost">Rust</Badge>
                    </div>

                    {renderUpdateSection()}

                    <div className="pt-2 text-sm text-base-content/50">
                        {t.settings.aboutCopyright}
                    </div>
                </div>
            </div>
        </div>
    );
}
