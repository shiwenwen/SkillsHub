import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
    Package,
    Search,
    RefreshCw,
    Shield,
    Settings,
    Layers,
} from "lucide-react";
import { useTranslation } from "../i18n";

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const t = useTranslation();

    const navItems = [
        { to: "/", icon: Package, label: t.nav.installed },
        { to: "/discover", icon: Search, label: t.nav.discover },
        { to: "/sync", icon: RefreshCw, label: t.nav.sync },
        { to: "/security", icon: Shield, label: t.nav.security },
        { to: "/settings", icon: Settings, label: t.nav.settings },
    ];

    return (
        <div className="flex h-screen bg-base-100">
            {/* Sidebar */}
            <aside className="w-64 bg-base-200 border-r border-base-300 flex flex-col">
                {/* Logo */}
                <div className="p-6 border-b border-base-300">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                            <Layers className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold gradient-text">SkillsHub</h1>
                            <p className="text-xs text-base-content/60">{t.nav.appDescription}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                    ? "bg-primary text-primary-content shadow-lg shadow-primary/25"
                                    : "text-base-content/70 hover:bg-base-300 hover:text-base-content"
                                }`
                            }
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-base-300">
                    <div className="glass-card p-4">
                        <p className="text-xs text-base-content/60">{t.common.version} 0.1.0</p>
                        <p className="text-xs text-base-content/40 mt-1">
                            {t.nav.unifiedSkillsManagement}
                        </p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8 animate-fade-in">{children}</div>
            </main>
        </div>
    );
}
