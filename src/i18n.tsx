import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { en, type Translations } from "./locales/en";
import { zh } from "./locales/zh";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import { fr } from "./locales/fr";
import { de } from "./locales/de";
import { es } from "./locales/es";
import { pt } from "./locales/pt";
import { ru } from "./locales/ru";

// 支持的语言
export type Language = "en" | "zh" | "ja" | "ko" | "fr" | "de" | "es" | "pt" | "ru";

// 语言配置
const translations: Record<Language, Translations> = {
    en,
    zh,
    ja,
    ko,
    fr,
    de,
    es,
    pt,
    ru,
};

// 获取本机默认语言
function getDefaultLanguage(): Language {
    // 优先从 localStorage 读取
    const stored = localStorage.getItem("skillshub-language");
    const supportedLanguages: Language[] = ["en", "zh", "ja", "ko", "fr", "de", "es", "pt", "ru"];
    if (stored && supportedLanguages.includes(stored as Language)) {
        return stored as Language;
    }

    // 检测浏览器语言
    const browserLang = navigator.language.toLowerCase();
    const langMap: [string, Language][] = [
        ["zh", "zh"],
        ["ja", "ja"],
        ["ko", "ko"],
        ["fr", "fr"],
        ["de", "de"],
        ["es", "es"],
        ["pt", "pt"],
        ["ru", "ru"],
    ];
    for (const [prefix, lang] of langMap) {
        if (browserLang.startsWith(prefix)) {
            return lang;
        }
    }
    return "en";
}

// Context 类型
interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Translations;
}

// 创建 Context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Provider 组件
interface LanguageProviderProps {
    children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
    const [language, setLanguageState] = useState<Language>(getDefaultLanguage);

    // 切换语言并保存到 localStorage
    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem("skillshub-language", lang);
    };

    // 初始化时确保 localStorage 有值
    useEffect(() => {
        const stored = localStorage.getItem("skillshub-language");
        if (!stored) {
            localStorage.setItem("skillshub-language", language);
        }
    }, [language]);

    const value: LanguageContextType = {
        language,
        setLanguage,
        t: translations[language],
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

// 自定义 Hook：获取语言设置
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return {
        language: context.language,
        setLanguage: context.setLanguage,
    };
}

// 自定义 Hook：获取翻译
export function useTranslation() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useTranslation must be used within a LanguageProvider");
    }
    return context.t;
}
