import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { applyTheme, type ThemeMode } from "@/components/ThemeToggle";

function hexToHSL(hex: string): string | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;

    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    s = s * 100;
    s = Math.round(s);
    l = l * 100;
    l = Math.round(l);
    h = Math.round(h * 360);

    return `${h} ${s}% ${l}%`;
}

export function ThemeManager() {
    const { user } = useAuth();

    // Sync theme preference from user DB to DOM
    useEffect(() => {
        if (!user?.theme) return;
        const validModes: ThemeMode[] = ["light", "dark", "system"];
        const mode = validModes.includes(user.theme as ThemeMode)
            ? (user.theme as ThemeMode)
            : "dark";

        // Only sync from DB if localStorage doesn't already have a value
        // (ThemeToggle manages localStorage directly for instant feedback)
        const stored = localStorage.getItem("theme") as ThemeMode | null;
        if (!stored) {
            localStorage.setItem("theme", mode);
            applyTheme(mode);
        }
    }, [user?.theme]);

    // Apply branding colors
    useEffect(() => {
        if (!user) return;

        const root = document.documentElement;

        // Primary Color
        if (user.brandingPrimaryColor) {
            const hsl = hexToHSL(user.brandingPrimaryColor);
            if (hsl) {
                root.style.setProperty("--primary", hsl);
                root.style.setProperty("--ring", hsl);
                root.style.setProperty("--chart-1", hsl);
                root.style.setProperty("--sidebar-primary", hsl);
            }
        } else {
            root.style.removeProperty("--primary");
            root.style.removeProperty("--ring");
            root.style.removeProperty("--chart-1");
            root.style.removeProperty("--sidebar-primary");
        }

        // Accent Color → secondary
        if (user.brandingAccentColor) {
            const hsl = hexToHSL(user.brandingAccentColor);
            if (hsl) {
                root.style.setProperty("--secondary", hsl);
            }
        } else {
            root.style.removeProperty("--secondary");
        }

        // Sidebar Color → --sidebar (correct variable name)
        if (user.brandingSidebarColor) {
            const hsl = hexToHSL(user.brandingSidebarColor);
            if (hsl) {
                root.style.setProperty("--sidebar", hsl);
            }
        } else {
            root.style.removeProperty("--sidebar");
        }

        // Page Background Color
        if (user.brandingBackgroundColor) {
            const hsl = hexToHSL(user.brandingBackgroundColor);
            if (hsl) {
                root.style.setProperty("--background", hsl);
            }
        } else {
            root.style.removeProperty("--background");
        }

    }, [user]);

    return null;
}
