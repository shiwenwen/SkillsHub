import {
    UserRound,
    Github,
    Box,
    ExternalLink,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import logoImg from "../../assets/logo.png";

interface AboutTabProps {
    t: Record<string, any>;
}

export default function AboutTab({ t }: AboutTabProps) {
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

                    <button type="button" className="btn btn-primary gap-2">
                        <Box className="h-4 w-4" />
                        {t.settings.aboutCheckUpdate}
                    </button>

                    <div className="pt-2 text-sm text-base-content/50">
                        {t.settings.aboutCopyright}
                    </div>
                </div>
            </div>
        </div>
    );
}
