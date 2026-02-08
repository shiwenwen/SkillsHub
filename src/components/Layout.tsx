import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
    Package,
    Search,
    RefreshCw,
    Shield,
    Settings,
    Sun,
    Moon,
    Monitor,
    Languages,
    Menu
} from "lucide-react";
import logoImg from "../assets/logo.png";
import { useTranslation, useLanguage } from "../i18n";
import { useTheme, type ThemeMode } from "../theme";
import { Button } from "./ui/Button";

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const t = useTranslation();
    const { language, setLanguage } = useLanguage();
    const { themeMode, setThemeMode } = useTheme();
    const location = useLocation();

    const themeOptions: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
        { mode: "auto", icon: Monitor, label: t.settings.themeAuto },
        { mode: "light", icon: Sun, label: t.settings.themeLight },
        { mode: "dark", icon: Moon, label: t.settings.themeDark },
    ];

    const currentThemeIcon = themeMode === "light" ? Sun : themeMode === "dark" ? Moon : Monitor;

    const navItems = [
        { to: "/", icon: Package, label: t.nav.installed },
        { to: "/discover", icon: Search, label: t.nav.discover },
        { to: "/sync", icon: RefreshCw, label: t.nav.sync },
        { to: "/security", icon: Shield, label: t.nav.security },
        { to: "/settings", icon: Settings, label: t.nav.settings },
    ];

    return (
        <div className="flex flex-col h-screen bg-base-100 font-sans text-base-content selection:bg-primary/20 selection:text-primary">
            {/* Top Navigation Bar */}
            <header className="flex-none h-16 z-50 glass-panel sticky top-0">
                <div className="container mx-auto h-full px-4 flex items-center justify-between">
                    {/* Logo Section */}
                    <div className="flex items-center gap-3">
                        <img src={logoImg} alt="SkillsHub" className="w-8 h-8 rounded-lg shadow-lg shadow-primary/20" />
                        <div className="hidden md:block">
                            <h1 className="text-lg font-bold gradient-text tracking-tight">SkillsHub</h1>
                        </div>
                    </div>

                    {/* Navigation Items - Centered */}
                    <nav className="hidden md:flex items-center gap-1 mx-4">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.to;
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                                        ${isActive
                                            ? "bg-primary/10 text-primary shadow-[0_0_20px_rgba(var(--p),0.3)]"
                                            : "text-base-content/60 hover:text-base-content hover:bg-base-content/5"
                                        }
                                    `}
                                >
                                    <item.icon className={`w-4 h-4 ${isActive ? "animate-pulse" : ""}`} />
                                    <span>{item.label}</span>
                                </NavLink>
                            );
                        })}
                    </nav>

                    {/* Mobile Menu Button - Visible only on small screens */}
                    <div className="md:hidden flex items-center">
                        <Button variant="ghost" size="sm">
                            <Menu className="w-5 h-5" />
                        </Button>
                    </div>


                    {/* Right Actions */}
                    <div className="hidden md:flex items-center gap-3">
                        <div className="flex items-center gap-2 pr-4 border-r border-base-content/10 mr-1">
                            {/* Theme Switcher */}
                            <div className="dropdown dropdown-end">
                                <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-circle">
                                    {(() => { const Icon = currentThemeIcon; return <Icon className="w-5 h-5" />; })()}
                                </div>
                                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-44 mt-4 border border-base-content/10">
                                    {themeOptions.map((opt) => (
                                        <li key={opt.mode}>
                                            <a onClick={() => setThemeMode(opt.mode)} className={themeMode === opt.mode ? "active" : ""}>
                                                <opt.icon className="w-4 h-4" />
                                                {opt.label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Language Switcher */}
                            <div className="dropdown dropdown-end">
                                <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-circle">
                                    <Languages className="w-5 h-5" />
                                </div>
                                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 mt-4 border border-base-content/10">
                                    <li><a onClick={() => setLanguage("en")} className={language === "en" ? "active" : ""}>English</a></li>
                                    <li><a onClick={() => setLanguage("zh")} className={language === "zh" ? "active" : ""}>中文</a></li>
                                    <li><a onClick={() => setLanguage("ja")} className={language === "ja" ? "active" : ""}>日本語</a></li>
                                    <li><a onClick={() => setLanguage("ko")} className={language === "ko" ? "active" : ""}>한국어</a></li>
                                    <li><a onClick={() => setLanguage("fr")} className={language === "fr" ? "active" : ""}>Français</a></li>
                                    <li><a onClick={() => setLanguage("de")} className={language === "de" ? "active" : ""}>Deutsch</a></li>
                                    <li><a onClick={() => setLanguage("es")} className={language === "es" ? "active" : ""}>Español</a></li>
                                    <li><a onClick={() => setLanguage("pt")} className={language === "pt" ? "active" : ""}>Português</a></li>
                                    <li><a onClick={() => setLanguage("ru")} className={language === "ru" ? "active" : ""}>Русский</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto relative">
                {/* Background ambient glow */}
                <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                    <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
                    <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[120px]" />
                </div>

                <div className="container mx-auto px-4 py-8 relative z-10 animate-fade-in">
                    {children}
                </div>
            </main>
        </div>
    );
}
