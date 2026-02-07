/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [require("daisyui")],
    daisyui: {
        themes: [
            {
                "skillshub-light": {
                    "primary": "#6366f1",        // Indigo 500
                    "primary-content": "#ffffff",
                    "secondary": "#a855f7",      // Purple 500
                    "secondary-content": "#ffffff",
                    "accent": "#0ea5e9",         // Sky 500
                    "accent-content": "#ffffff",
                    "neutral": "#e2e8f0",        // Slate 200
                    "neutral-content": "#475569", // Slate 600
                    "base-100": "#ffffff",        // White - App BG
                    "base-200": "#f1f5f9",        // Slate 100 - Card/Sidebar BG
                    "base-300": "#e2e8f0",        // Slate 200 - Borders/Hover
                    "base-content": "#0f172a",    // Slate 900 - Main Text
                    "info": "#3b82f6",
                    "info-content": "#ffffff",
                    "success": "#22c55e",
                    "success-content": "#ffffff",
                    "warning": "#eab308",
                    "warning-content": "#1e293b",
                    "error": "#ef4444",
                    "error-content": "#ffffff",
                },
            },
            {
                "skillshub-dark": {
                    "primary": "#6366f1",        // Indigo 500
                    "primary-content": "#ffffff",
                    "secondary": "#a855f7",      // Purple 500
                    "secondary-content": "#ffffff",
                    "accent": "#0ea5e9",         // Sky 500
                    "accent-content": "#ffffff",
                    "neutral": "#1e293b",        // Slate 800
                    "neutral-content": "#94a3b8", // Slate 400
                    "base-100": "#0f172a",        // Slate 900 - App BG
                    "base-200": "#1e293b",        // Slate 800 - Card/Sidebar BG
                    "base-300": "#334155",        // Slate 700 - Borders/Hover
                    "base-content": "#f8fafc",    // Slate 50 - Main Text
                    "info": "#3b82f6",
                    "info-content": "#ffffff",
                    "success": "#22c55e",
                    "success-content": "#ffffff",
                    "warning": "#eab308",
                    "warning-content": "#ffffff",
                    "error": "#ef4444",
                    "error-content": "#ffffff",
                },
            },
        ],
        darkTheme: "skillshub-dark",
    },
}
