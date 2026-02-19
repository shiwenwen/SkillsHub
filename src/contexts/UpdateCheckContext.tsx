import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface UpdateCheckInfo {
    skill_id: string;
    current_version: string;
    current_hash: string;
    latest_version: string;
    latest_hash: string;
    has_update: boolean;
    source_registry: string | null;
}

interface AppConfig {
    check_updates_on_startup: boolean;
    auto_check_update_interval: number;
    scan_before_update: boolean;
    block_high_risk: boolean;
}

interface UpdateCheckContextValue {
    updates: UpdateCheckInfo[];
    availableUpdates: UpdateCheckInfo[];
    isChecking: boolean;
    lastChecked: Date | null;
    error: string | null;
    checkUpdates: () => Promise<void>;
    updateSkill: (skillId: string) => Promise<string>;
    isUpdating: string | null;
}

const UpdateCheckContext = createContext<UpdateCheckContextValue | null>(null);

export function UpdateCheckProvider({ children }: { children: ReactNode }) {
    const [updates, setUpdates] = useState<UpdateCheckInfo[]>([]);
    const [isChecking, setIsChecking] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const checkUpdates = useCallback(async () => {
        setIsChecking(true);
        setError(null);

        try {
            const result = await invoke<UpdateCheckInfo[]>("check_skill_updates");
            setUpdates(result);
            setLastChecked(new Date());
        } catch (err) {
            setError(String(err));
            console.error("Failed to check updates:", err);
        } finally {
            setIsChecking(false);
        }
    }, []);

    // Startup check + periodic auto-check
    useEffect(() => {
        let startupTimer: ReturnType<typeof setTimeout> | null = null;
        let isCancelled = false;

        const setupAutoCheck = async () => {
            try {
                const config = await invoke<AppConfig>("get_app_config");

                // Startup check
                if (config.check_updates_on_startup) {
                    startupTimer = setTimeout(() => {
                        if (!isCancelled) {
                            void checkUpdates();
                        }
                    }, 2000);
                }

                // Periodic auto-check
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }

                if (config.auto_check_update_interval > 0) {
                    const intervalMs = config.auto_check_update_interval * 60 * 1000;
                    intervalRef.current = setInterval(() => {
                        if (!isCancelled) {
                            void checkUpdates();
                        }
                    }, intervalMs);
                }
            } catch (err) {
                console.error("Failed to load app config for update check:", err);
            }
        };

        void setupAutoCheck();

        return () => {
            isCancelled = true;
            if (startupTimer) {
                clearTimeout(startupTimer);
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [checkUpdates]);

    const updateSkill = useCallback(async (skillId: string): Promise<string> => {
        setIsUpdating(skillId);

        try {
            const config = await invoke<AppConfig>("get_app_config");

            if (config.scan_before_update) {
                try {
                    const scanResult = await invoke<{ overall_risk: string; findings: unknown[] }>("scan_skill", {
                        skillId: skillId,
                    });

                    if (config.block_high_risk && scanResult.overall_risk === "high") {
                        throw new Error(`Update blocked: Skill "${skillId}" detected as high risk.`);
                    }
                } catch (scanError) {
                    if (scanError instanceof Error && scanError.message.includes("blocked")) {
                        throw scanError;
                    }
                    console.warn("Security scan failed, proceeding with update:", scanError);
                }
            }

            const result = await invoke<string>("update_skill", { skillId });
            await checkUpdates();
            return result;
        } finally {
            setIsUpdating(null);
        }
    }, [checkUpdates]);

    const availableUpdates = updates.filter(u => u.has_update);

    return (
        <UpdateCheckContext.Provider
            value={{
                updates,
                availableUpdates,
                isChecking,
                lastChecked,
                error,
                checkUpdates,
                updateSkill,
                isUpdating,
            }}
        >
            {children}
        </UpdateCheckContext.Provider>
    );
}

export function useUpdateCheck(): UpdateCheckContextValue {
    const context = useContext(UpdateCheckContext);
    if (!context) {
        throw new Error("useUpdateCheck must be used within an UpdateCheckProvider");
    }
    return context;
}

export { UpdateCheckContext };
