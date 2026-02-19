import { useState, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type AppUpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "ready"
    | "upToDate"
    | "error";

interface AppUpdateState {
    status: AppUpdateStatus;
    version: string | null;
    date: string | null;
    body: string | null;
    progress: number;
    contentLength: number | null;
    downloaded: number;
    error: string | null;
}

export function useAppUpdate() {
    const [state, setState] = useState<AppUpdateState>({
        status: "idle",
        version: null,
        date: null,
        body: null,
        progress: 0,
        contentLength: null,
        downloaded: 0,
        error: null,
    });

    const checkForUpdate = useCallback(async () => {
        setState((prev) => ({
            ...prev,
            status: "checking",
            error: null,
        }));

        try {
            const update = await check();

            if (update) {
                setState((prev) => ({
                    ...prev,
                    status: "available",
                    version: update.version,
                    date: update.date ?? null,
                    body: update.body ?? null,
                }));
                return update;
            } else {
                setState((prev) => ({
                    ...prev,
                    status: "upToDate",
                }));
                return null;
            }
        } catch (err) {
            setState((prev) => ({
                ...prev,
                status: "error",
                error: err instanceof Error ? err.message : String(err),
            }));
            return null;
        }
    }, []);

    const downloadAndInstall = useCallback(async () => {
        setState((prev) => ({
            ...prev,
            status: "checking",
            error: null,
        }));

        try {
            const update = await check();
            if (!update) {
                setState((prev) => ({
                    ...prev,
                    status: "upToDate",
                }));
                return;
            }

            setState((prev) => ({
                ...prev,
                status: "downloading",
                version: update.version,
                date: update.date ?? null,
                body: update.body ?? null,
                progress: 0,
                downloaded: 0,
                contentLength: null,
            }));

            let totalDownloaded = 0;
            let totalLength: number | null = null;

            await update.downloadAndInstall((event) => {
                switch (event.event) {
                    case "Started":
                        totalLength = event.data.contentLength ?? null;
                        setState((prev) => ({
                            ...prev,
                            contentLength: totalLength,
                        }));
                        break;
                    case "Progress": {
                        totalDownloaded += event.data.chunkLength;
                        const pct = totalLength
                            ? Math.round(
                                  (totalDownloaded / totalLength) * 100,
                              )
                            : 0;
                        setState((prev) => ({
                            ...prev,
                            downloaded: totalDownloaded,
                            progress: pct,
                        }));
                        break;
                    }
                    case "Finished":
                        setState((prev) => ({
                            ...prev,
                            status: "ready",
                            progress: 100,
                        }));
                        break;
                }
            });

            setState((prev) => ({
                ...prev,
                status: "ready",
                progress: 100,
            }));
        } catch (err) {
            setState((prev) => ({
                ...prev,
                status: "error",
                error: err instanceof Error ? err.message : String(err),
            }));
        }
    }, []);

    const installAndRelaunch = useCallback(async () => {
        await relaunch();
    }, []);

    return {
        ...state,
        checkForUpdate,
        downloadAndInstall,
        installAndRelaunch,
    };
}
