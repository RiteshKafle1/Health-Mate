/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Clinical Palette
                background: '#FFF2F2', // Dominant (~60-70%)
                surface: '#A9B5DF', // Secondary Surface / Cards
                primary: {
                    DEFAULT: '#7886C7', // Accent / CTAs
                    hover: '#5e6ca8',
                    foreground: '#FFFFFF',
                },
                text: {
                    DEFAULT: '#2D336B', // Main text
                    muted: '#64748b', // Helper text
                },
                // Functional Colors
                success: {
                    DEFAULT: '#10b981',
                    bg: '#d1fae5',
                },
                warning: {
                    DEFAULT: '#f59e0b',
                    bg: '#fef3c7',
                },
                error: {
                    DEFAULT: '#ef4444',
                    bg: '#fee2e2',
                },
                info: {
                    DEFAULT: '#3b82f6',
                    bg: '#dbeafe',
                },
                // Preserving some old tokens if needed, but remapping them
                secondary: {
                    DEFAULT: '#A9B5DF',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'lg': '1rem', // 16px
                'xl': '1.5rem',
            },
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(45, 51, 107, 0.05)',
                'card': '0 10px 30px -5px rgba(45, 51, 107, 0.08)',
                'hover': '0 20px 40px -5px rgba(45, 51, 107, 0.12)',
            },
        },
    },
    plugins: [],
}
