/**
 * Chart theming utilities for Recharts.
 * Returns theme-aware colors for tooltips, grids, axes.
 */

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function getChartTheme() {
  const dark = isDark();
  return {
    grid: {
      stroke: dark ? "hsl(220, 12%, 18%)" : "hsl(220, 13%, 91%)",
    },
    tick: {
      fill: dark ? "hsl(220, 8%, 50%)" : "hsl(215, 16%, 47%)",
      fontSize: 11,
    },
    tooltip: {
      backgroundColor: dark ? "hsl(220, 13%, 11%)" : "hsl(0, 0%, 100%)",
      border: dark ? "1px solid hsl(220, 12%, 18%)" : "1px solid hsl(220, 13%, 91%)",
      borderRadius: "6px",
      color: dark ? "#fff" : "hsl(220, 15%, 15%)",
      fontSize: "12px",
    },
    labelStyle: {
      color: dark ? "hsl(220, 8%, 70%)" : "hsl(215, 16%, 47%)",
      marginBottom: 4,
    },
    legend: {
      fontSize: "11px",
      color: dark ? "hsl(220, 8%, 50%)" : "hsl(215, 16%, 47%)",
    },
  };
}
