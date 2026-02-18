import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AresThemeContextType {
    updateTheme: (colorHex: string, themeName: string) => void;
    resetTheme: () => void;
    currentTheme: string;
}

const AresThemeContext = createContext<AresThemeContextType | undefined>(undefined);

// Helper to adjust lightness
const adjustColor = (color: string, amount: number) => {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

// Simple palette generator (very basic, just lightness shifts for demo)
// Real implementation would use HSL
const generateShades = (hex: string) => {
    // This is a naive implementation but works for a "Wow" demo
    // We strictly just blindly set variables to hex for main, and lighter/darker
    // Ideally we'd use a library like 'chroma-js' or 'tinycolor2'

    // For now, let's just use CSS HSL variables via JS if possible, 
    // but we are writing Hex to the vars directly.

    // Let's assume the user gives us a "600" level color.
    return {
        50: '#f5f5f5', // Generic light
        100: adjustColor(hex, 180),
        200: adjustColor(hex, 150),
        300: adjustColor(hex, 100),
        400: adjustColor(hex, 50),
        500: adjustColor(hex, 20),
        600: hex,
        700: adjustColor(hex, -20),
        800: adjustColor(hex, -50),
        900: adjustColor(hex, -80),
        950: adjustColor(hex, -100),
    };
};

export const AresThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState('Default (Indigo)');

    const updateTheme = (colorHex: string, themeName: string) => {
        const root = document.documentElement;

        // Naive palette generation
        // Note: adjustColor is very rough, might clip.
        // For a demo, mapping exactly to user request is key.

        root.style.setProperty('--p-600', colorHex);

        // Calculate others loosely or keep them standard if it's black/white?
        // Let's try one simple lightness shift
        // Actually, to ensure it looks good, I will just set 500/600/700 which are most used.
        // 50-200 are backgrounds usually.

        // Let's rely on a simpler trick: If user says "Red", we use a known Red palette.
        // If "Green", known Green. 
        // If Hex, we try our best.

        const palette = getPredefinedPalette(colorHex) || generateShades(colorHex);

        Object.entries(palette).forEach(([shade, value]) => {
            root.style.setProperty(`--p-${shade}`, value);
        });

        setCurrentTheme(themeName);
    };

    const resetTheme = () => {
        updateTheme('#4f46e5', 'Default (Indigo)');
    };

    return (
        <AresThemeContext.Provider value={{ updateTheme, resetTheme, currentTheme }}>
            {children}
        </AresThemeContext.Provider>
    );
};

export const useAresTheme = () => {
    const context = useContext(AresThemeContext);
    if (!context) throw new Error("useAresTheme must be used within AresThemeProvider");
    return context;
};

// PREDEFINED PALETTES FOR HIGH QUALITY
const getPredefinedPalette = (input: string) => {
    const lower = input.toLowerCase();

    if (lower.includes('red') || lower.includes('#dc2626')) return {
        50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171',
        500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a'
    };

    if (lower.includes('blue') || lower.includes('#2563eb')) return {
        50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
        500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554'
    };

    if (lower.includes('green') || lower.includes('#16a34a')) return {
        50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80',
        500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16'
    };

    if (lower.includes('purple') || lower.includes('#9333ea')) return {
        50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc',
        500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764'
    };

    if (lower.includes('orange') || lower.includes('#ea580c')) return {
        50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c',
        500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407'
    };

    return null; // Fallback to generator
}
