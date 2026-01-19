import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

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
        h = s = 0; // achromatic
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

    useEffect(() => {
        if (!user) return;

        const root = document.documentElement;

        // Apply Primary Color
        if (user.brandingPrimaryColor) {
            const hsl = hexToHSL(user.brandingPrimaryColor);
            if (hsl) {
                root.style.setProperty("--primary", hsl);
                root.style.setProperty("--ring", hsl);
                // Also update chart color 1 to match primary
                root.style.setProperty("--chart-1", hsl);
            }
        } else {
            root.style.removeProperty("--primary");
            root.style.removeProperty("--ring");
            root.style.removeProperty("--chart-1");
        }

        // Apply Accent Color (Mapping to Secondary for now, or we could add a specific accent variable)
        if (user.brandingAccentColor) {
            const hsl = hexToHSL(user.brandingAccentColor);
            if (hsl) {
                // We can map this to secondary or use it as a separate accent if css uses it
                // The CSS defines --secondary as "Electric Indigo", let's override it if user provides one
                root.style.setProperty("--secondary", hsl);
            }
        } else {
            root.style.removeProperty("--secondary");
        }

        // Apply Sidebar Color
        if (user.brandingSidebarColor) {
            // We'll set a custom property for the sidebar to consume
            root.style.setProperty("--sidebar-bg", user.brandingSidebarColor);
        } else {
            root.style.removeProperty("--sidebar-bg");
        }

        // Apply Page Background Color
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
