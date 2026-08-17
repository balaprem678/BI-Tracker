import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeTone = {
  id: string;
  name: string;
  hue: number;
  chroma: number;
  swatch: string;
};

export const PRESET_THEMES: ThemeTone[] = [
  { id: "teal", name: "Teal Console", hue: 200, chroma: 0.104, swatch: "oklch(0.53 0.104 200)" },
  { id: "indigo", name: "Indigo Ink", hue: 265, chroma: 0.15, swatch: "oklch(0.52 0.15 265)" },
  { id: "emerald", name: "Emerald Shift", hue: 158, chroma: 0.13, swatch: "oklch(0.53 0.13 158)" },
  { id: "amber", name: "Amber Desk", hue: 70, chroma: 0.14, swatch: "oklch(0.62 0.14 70)" },
  { id: "rose", name: "Rose Signal", hue: 12, chroma: 0.16, swatch: "oklch(0.56 0.16 12)" },
  { id: "magenta", name: "Magenta Pulse", hue: 330, chroma: 0.17, swatch: "oklch(0.55 0.17 330)" },
  { id: "sky", name: "Sky Report", hue: 240, chroma: 0.12, swatch: "oklch(0.55 0.12 240)" },
  { id: "lime", name: "Lime Board", hue: 130, chroma: 0.14, swatch: "oklch(0.56 0.14 130)" },
];

export const DEFAULT_THEME: ThemeTone = PRESET_THEMES[0]!;

const STORAGE_KEY = "bi-tracker-theme";
const FAV_KEY = "bi-tracker-theme-favourites";

type ThemeCtx = {
  theme: ThemeTone;
  favourites: ThemeTone[];
  setTheme: (t: ThemeTone) => void;
  randomTheme: () => void;
  toggleFavourite: (t: ThemeTone) => void;
  isFavourite: (t: ThemeTone) => boolean;
};

const Ctx = createContext<ThemeCtx | null>(null);

function applyTone(tone: ThemeTone) {
  const root = document.documentElement;
  const hue = tone.hue;
  const chroma = Math.max(0.08, Math.min(0.2, tone.chroma));

  const primary = `oklch(0.62 ${chroma + 0.05} ${hue})`;
  const primaryForeground = "oklch(0.12 0.02 220)";
  const background = `oklch(0.16 0.03 ${hue})`;
  const foreground = "oklch(0.96 0.02 220)";
  const surface = `oklch(0.2 0.025 ${hue})`;
  const surface2 = `oklch(0.24 0.028 ${hue})`;
  const secondary = `oklch(0.28 0.03 ${hue})`;
  const muted = `oklch(0.26 0.028 ${hue})`;
  const mutedForeground = "oklch(0.82 0.025 220)";
  const border = `oklch(0.92 0.02 ${hue} / 18%)`;
  const input = `oklch(0.92 0.02 ${hue} / 18%)`;
  const accent = `oklch(0.76 0.08 ${hue})`;
  const accentForeground = "oklch(0.12 0.02 220)";
  const success = `oklch(0.66 0.14 ${hue + 18})`;
  const warning = `oklch(0.7 0.13 ${hue - 24})`;
  const sidebar = `oklch(0.18 0.03 ${hue})`;

  root.style.setProperty("--background", background);
  root.style.setProperty("--foreground", foreground);
  root.style.setProperty("--surface", surface);
  root.style.setProperty("--surface-2", surface2);
  root.style.setProperty("--card", surface);
  root.style.setProperty("--card-foreground", foreground);
  root.style.setProperty("--popover", surface);
  root.style.setProperty("--popover-foreground", foreground);
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-foreground", primaryForeground);
  root.style.setProperty("--secondary", secondary);
  root.style.setProperty("--secondary-foreground", foreground);
  root.style.setProperty("--muted", muted);
  root.style.setProperty("--muted-foreground", mutedForeground);
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-foreground", accentForeground);
  root.style.setProperty("--destructive", "oklch(0.7 0.22 22)");
  root.style.setProperty("--destructive-foreground", "oklch(0.98 0.02 20)");
  root.style.setProperty("--success", success);
  root.style.setProperty("--warning", warning);
  root.style.setProperty("--border", border);
  root.style.setProperty("--input", input);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--chart-1", primary);
  root.style.setProperty("--chart-2", success);
  root.style.setProperty("--chart-3", warning);
  root.style.setProperty("--chart-4", `oklch(0.68 0.16 ${hue + 65})`);
  root.style.setProperty("--chart-5", `oklch(0.7 0.17 ${hue + 110})`);
  root.style.setProperty("--sidebar", sidebar);
  root.style.setProperty("--sidebar-foreground", foreground);
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-primary-foreground", primaryForeground);
  root.style.setProperty("--sidebar-accent", secondary);
  root.style.setProperty("--sidebar-accent-foreground", foreground);
  root.style.setProperty("--sidebar-border", border);
  root.style.setProperty("--sidebar-ring", primary);
}

function randomTone(): ThemeTone {
  const hue = Math.round(Math.random() * 360);
  const chroma = Number((0.1 + Math.random() * 0.08).toFixed(3));
  return {
    id: `random-${hue}`,
    name: `Random ${hue}°`,
    hue,
    chroma,
    swatch: `oklch(0.53 ${chroma} ${hue})`,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeTone>(DEFAULT_THEME);
  const [favourites, setFavourites] = useState<ThemeTone[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ThemeTone;
        setThemeState(parsed);
        applyTone(parsed);
      }
      const favRaw = localStorage.getItem(FAV_KEY);
      if (favRaw) setFavourites(JSON.parse(favRaw) as ThemeTone[]);
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const setTheme = useCallback((t: ThemeTone) => {
    setThemeState(t);
    applyTone(t);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    } catch {
      /* ignore */
    }
  }, []);

  const randomTheme = useCallback(() => setTheme(randomTone()), [setTheme]);

  const toggleFavourite = useCallback((t: ThemeTone) => {
    setFavourites((prev) => {
      const next = prev.some((f) => f.id === t.id)
        ? prev.filter((f) => f.id !== t.id)
        : [...prev, t];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      favourites,
      setTheme,
      randomTheme,
      toggleFavourite,
      isFavourite: (t) => favourites.some((f) => f.id === t.id),
    }),
    [theme, favourites, setTheme, randomTheme, toggleFavourite],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
