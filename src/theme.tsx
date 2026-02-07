import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

// 主题模式
export type ThemeMode = "auto" | "light" | "dark";

// DaisyUI 主题名称
const LIGHT_THEME = "skillshub-light";
const DARK_THEME = "skillshub-dark";
const STORAGE_KEY = "skillshub-theme";

// 获取系统偏好
function getSystemPrefersDark(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// 根据模式获取实际 DaisyUI 主题名
function resolveTheme(mode: ThemeMode): string {
    if (mode === "light") return LIGHT_THEME;
    if (mode === "dark") return DARK_THEME;
    return getSystemPrefersDark() ? DARK_THEME : LIGHT_THEME;
}

// 应用主题到 DOM
function applyTheme(theme: string) {
    document.documentElement.setAttribute("data-theme", theme);
}

// 获取默认主题模式
function getDefaultThemeMode(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "auto" || stored === "light" || stored === "dark") {
        return stored;
    }
    return "auto";
}

// Context 类型
interface ThemeContextType {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    resolvedTheme: "light" | "dark";
}

// 创建 Context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider 组件
interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [themeMode, setThemeModeState] = useState<ThemeMode>(getDefaultThemeMode);
    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
        const mode = getDefaultThemeMode();
        if (mode === "light") return "light";
        if (mode === "dark") return "dark";
        return getSystemPrefersDark() ? "dark" : "light";
    });

    // 更新主题
    const updateTheme = useCallback((mode: ThemeMode) => {
        const daisyTheme = resolveTheme(mode);
        applyTheme(daisyTheme);
        setResolvedTheme(daisyTheme === DARK_THEME ? "dark" : "light");
    }, []);

    // 切换主题模式
    const setThemeMode = useCallback((mode: ThemeMode) => {
        setThemeModeState(mode);
        localStorage.setItem(STORAGE_KEY, mode);
        updateTheme(mode);
    }, [updateTheme]);

    // 初始化时应用主题
    useEffect(() => {
        updateTheme(themeMode);
    }, []);

    // 监听系统主题变化（仅 auto 模式时生效）
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => {
            if (themeMode === "auto") {
                updateTheme("auto");
            }
        };
        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, [themeMode, updateTheme]);

    const value: ThemeContextType = {
        themeMode,
        setThemeMode,
        resolvedTheme,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

// 自定义 Hook：获取主题设置
export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
