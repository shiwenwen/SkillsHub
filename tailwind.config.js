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
                antigravity: {
                    "primary": "#6366f1", // Indigo 500 - Vibrant Primary
                    "primary-content": "#ffffff",
                    "secondary": "#a855f7", // Purple 500 - Secondary Accent
                    "secondary-content": "#ffffff",
                    "accent": "#0ea5e9", // Sky 500 - Cyan/Blue Accent
                    "accent-content": "#ffffff",
                    "neutral": "#1e293b", // Slate 800 - Component BG
                    "neutral-content": "#94a3b8", // Slate 400 - Muted Text
                    "base-100": "#0f172a", // Slate 900 - App BG (Deep Dark Blue)
                    "base-200": "#1e293b", // Slate 800 - Card/Sidebar BG
                    "base-300": "#334155", // Slate 700 - Borders/Hover
                    "base-content": "#f8fafc", // Slate 50 - Main Text
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
        darkTheme: "antigravity", // Set as default dark theme
    },
}
