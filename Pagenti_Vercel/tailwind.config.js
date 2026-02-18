/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./views/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./hooks/**/*.{js,ts,jsx,tsx}",
        "./contexts/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                indigo: {
                    50: 'var(--p-50)',
                    100: 'var(--p-100)',
                    200: 'var(--p-200)',
                    300: 'var(--p-300)',
                    400: 'var(--p-400)',
                    500: 'var(--p-500)',
                    600: 'var(--p-600)',
                    700: 'var(--p-700)',
                    800: 'var(--p-800)',
                    900: 'var(--p-900)',
                    950: 'var(--p-950)',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                heading: ['Outfit', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
        },
    },
    plugins: [],
}
