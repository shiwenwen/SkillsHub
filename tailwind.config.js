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
                skillshub: {
                    "primary": "#6366f1",
                    "primary-content": "#ffffff",
                    "secondary": "#8b5cf6",
                    "secondary-content": "#ffffff",
                    "accent": "#22d3ee",
                    "accent-content": "#000000",
                    "neutral": "#1f2937",
                    "neutral-content": "#d1d5db",
                    "base-100": "#0f172a",
                    "base-200": "#1e293b",
                    "base-300": "#334155",
                    "base-content": "#f1f5f9",
                    "info": "#38bdf8",
                    "info-content": "#000000",
                    "success": "#22c55e",
                    "success-content": "#000000",
                    "warning": "#f59e0b",
                    "warning-content": "#000000",
                    "error": "#ef4444",
                    "error-content": "#ffffff",
                },
            },
            "light",
            "dark",
        ],
        darkTheme: "skillshub",
    },
}
