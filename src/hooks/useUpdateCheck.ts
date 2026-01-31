import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// 更新检查信息类型
export interface UpdateCheckInfo {
    skill_id: string;
    current_version: string;
    current_hash: string;
    latest_version: string;
    latest_hash: string;
    has_update: boolean;
    source_registry: string | null;
}

interface UseUpdateCheckResult {
    updates: UpdateCheckInfo[];
    availableUpdates: UpdateCheckInfo[];
    isChecking: boolean;
    lastChecked: Date | null;
    error: string | null;
    checkUpdates: () => Promise<void>;
    updateSkill: (skillId: string) => Promise<string>;
    isUpdating: string | null; // 正在更新的 skill ID
}

export function useUpdateCheck(): UseUpdateCheckResult {
    const [updates, setUpdates] = useState<UpdateCheckInfo[]>([]);
    const [isChecking, setIsChecking] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    // 检查是否应该在启动时检查更新
    useEffect(() => {
        const shouldCheck = localStorage.getItem("skillshub_checkUpdatesOnStartup");
        if (shouldCheck === "true" || shouldCheck === null) {
            // 默认启用，延迟执行避免阻塞启动
            const timer = setTimeout(() => {
                checkUpdates();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, []);

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

    const updateSkill = useCallback(async (skillId: string): Promise<string> => {
        setIsUpdating(skillId);

        try {
            // 检查是否需要更新前扫描
            const scanBeforeUpdate = localStorage.getItem("skillshub_scanBeforeUpdate");
            const blockHighRisk = localStorage.getItem("skillshub_blockHighRisk");

            if (scanBeforeUpdate === "true" || scanBeforeUpdate === null) {
                // 执行安全扫描
                try {
                    const scanResult = await invoke<{ overall_risk: string; findings: unknown[] }>("scan_skill", {
                        skillId: skillId,
                    });

                    // 如果启用了阻止高风险且扫描结果为高风险，则阻止更新
                    if ((blockHighRisk === "true" || blockHighRisk === null) && scanResult.overall_risk === "high") {
                        throw new Error(`更新被阻止：Skill "${skillId}" 被检测为高风险。`);
                    }
                } catch (scanError) {
                    // 如果是我们抛出的阻止错误，重新抛出
                    if (scanError instanceof Error && scanError.message.includes("被阻止")) {
                        throw scanError;
                    }
                    console.warn("Security scan failed, proceeding with update:", scanError);
                    // 扫描失败时继续更新（可以根据需要修改此行为）
                }
            }

            const result = await invoke<string>("update_skill", { skillId });
            // 更新后重新检查
            await checkUpdates();
            return result;
        } finally {
            setIsUpdating(null);
        }
    }, [checkUpdates]);

    const availableUpdates = updates.filter(u => u.has_update);

    return {
        updates,
        availableUpdates,
        isChecking,
        lastChecked,
        error,
        checkUpdates,
        updateSkill,
        isUpdating,
    };
}

export default useUpdateCheck;
