import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type UIDesignPreferences,
  DEFAULT_DESIGN_PREFERENCES,
  saveMyDesignPreferences,
  getMyDesignPreferences,
} from "@/lib/design.functions";

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

export type ColorMode = "dark" | "light" | "system";
export type UIDensity = "comfortable" | "compact";
export type UIFontSize = "compact" | "normal" | "large";
export type UIRadius = "sharp" | "normal" | "pill";

const GUEST_STORAGE_KEY = "bi-tracker-design-guest";

function getStorageKey(userId?: string | null) {
  return userId ? `bi-tracker-design-${userId}` : GUEST_STORAGE_KEY;
}

export function applyDesign(prefs: UIDesignPreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const { theme, mode, density, fontSize, radius } = prefs;

  // 1. Color Scheme Mode
  const isSystemDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && isSystemDark);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // 2. Color Palette Values
  const hue = theme.hue;
  const chroma = Math.max(0.08, Math.min(0.2, theme.chroma));

  if (isDark) {
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
  } else {
    // Crisp Light Mode Palette
    const primary = `oklch(0.53 ${chroma} ${hue})`;
    const primaryForeground = "oklch(0.99 0.005 220)";
    const background = `oklch(0.985 0.006 ${hue})`;
    const foreground = "oklch(0.20 0.028 258)";
    const surface = "oklch(1 0 0)";
    const surface2 = `oklch(0.965 0.008 ${hue})`;
    const secondary = `oklch(0.95 0.012 ${hue})`;
    const muted = `oklch(0.95 0.012 ${hue})`;
    const mutedForeground = "oklch(0.48 0.02 258)";
    const border = `oklch(0.24 0.028 258 / 12%)`;
    const input = `oklch(0.24 0.028 258 / 16%)`;
    const accent = `oklch(0.94 0.025 ${hue})`;
    const accentForeground = `oklch(0.28 0.03 ${hue})`;
    const success = "oklch(0.53 0.13 158)";
    const warning = "oklch(0.62 0.14 70)";
    const sidebar = "oklch(1 0 0)";

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
    root.style.setProperty("--destructive", "oklch(0.55 0.196 22)");
    root.style.setProperty("--destructive-foreground", "oklch(0.99 0.008 20)");
    root.style.setProperty("--success", success);
    root.style.setProperty("--warning", warning);
    root.style.setProperty("--border", border);
    root.style.setProperty("--input", input);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--chart-1", primary);
    root.style.setProperty("--chart-2", success);
    root.style.setProperty("--chart-3", warning);
    root.style.setProperty("--chart-4", `oklch(0.52 0.15 ${hue + 65})`);
    root.style.setProperty("--chart-5", `oklch(0.55 0.17 ${hue + 110})`);
    root.style.setProperty("--sidebar", sidebar);
    root.style.setProperty("--sidebar-foreground", foreground);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-primary-foreground", primaryForeground);
    root.style.setProperty("--sidebar-accent", secondary);
    root.style.setProperty("--sidebar-accent-foreground", foreground);
    root.style.setProperty("--sidebar-border", border);
    root.style.setProperty("--sidebar-ring", primary);
  }

  // 3. Geometry (Border Radius)
  const radiusMap: Record<UIRadius, string> = {
    sharp: "0.25rem",
    normal: "0.5rem",
    pill: "0.875rem",
  };
  root.style.setProperty("--radius", radiusMap[radius] || "0.5rem");
  root.setAttribute("data-radius", radius);

  // 4. Density & Font Size Attributes
  root.setAttribute("data-density", density);
  root.setAttribute("data-font-size", fontSize);
}

export function createRandomTone(): ThemeTone {
  const hue = Math.round(Math.random() * 360);
  const chroma = Number((0.1 + Math.random() * 0.08).toFixed(3));
  return {
    id: `random-${hue}`,
    name: `Vibrant ${hue}°`,
    hue,
    chroma,
    swatch: `oklch(0.55 ${chroma} ${hue})`,
  };
}

export function createCustomTone(hue: number, name?: string): ThemeTone {
  const clampedHue = Math.max(0, Math.min(360, Math.round(hue)));
  return {
    id: `custom-${clampedHue}`,
    name: name || `Custom ${clampedHue}°`,
    hue: clampedHue,
    chroma: 0.12,
    swatch: `oklch(0.55 0.12 ${clampedHue})`,
  };
}

type ThemeCtx = {
  preferences: UIDesignPreferences;
  theme: ThemeTone;
  mode: ColorMode;
  density: UIDensity;
  fontSize: UIFontSize;
  radius: UIRadius;
  favourites: ThemeTone[];
  userId: string | null;
  isSaving: boolean;
  lastSavedAt: Date | null;
  setTheme: (t: ThemeTone) => Promise<void>;
  setMode: (m: ColorMode) => Promise<void>;
  setDensity: (d: UIDensity) => Promise<void>;
  setFontSize: (s: UIFontSize) => Promise<void>;
  setRadius: (r: UIRadius) => Promise<void>;
  updatePreferences: (partial: Partial<UIDesignPreferences>) => Promise<void>;
  randomTheme: () => Promise<void>;
  toggleFavourite: (t: ThemeTone) => Promise<void>;
  isFavourite: (t: ThemeTone) => boolean;
  resetToDefaults: () => Promise<void>;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UIDesignPreferences>(DEFAULT_DESIGN_PREFERENCES);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Apply design on preferences change
  useEffect(() => {
    applyDesign(preferences);
  }, [preferences]);

  // Listen to OS dark mode changes if mode is "system"
  useEffect(() => {
    if (preferences.mode !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyDesign(preferences);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [preferences]);

  // Load preferences for a specific user ID
  const loadUserPreferences = useCallback(async (uid: string | null, authUserMeta?: any) => {
    const storageKey = getStorageKey(uid);
    let initialPrefs = DEFAULT_DESIGN_PREFERENCES;

    // 1. Immediate local cache retrieval (0ms flicker)
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        initialPrefs = { ...DEFAULT_DESIGN_PREFERENCES, ...parsed };
      }
    } catch {
      // Ignore storage errors
    }

    // 2. If user metadata already has preferences passed in from session
    if (authUserMeta?.ui_design_preferences) {
      initialPrefs = { ...initialPrefs, ...authUserMeta.ui_design_preferences };
      try {
        localStorage.setItem(storageKey, JSON.stringify(initialPrefs));
      } catch {}
    }

    setPreferences(initialPrefs);
    applyDesign(initialPrefs);

    // 3. Background sync with backend if user is authenticated
    if (uid) {
      try {
        const serverPrefs = await getMyDesignPreferences({});
        if (serverPrefs) {
          const merged = { ...initialPrefs, ...serverPrefs };
          setPreferences(merged);
          applyDesign(merged);
          localStorage.setItem(storageKey, JSON.stringify(merged));
        }
      } catch (err) {
        // Fallback gracefully to local preferences
      }
    }
  }, []);

  // Monitor Supabase Auth state changes
  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(({ data }: { data: any }) => {
      const sessionUser = data?.session?.user;
      const currentUid = sessionUser?.id || null;
      setUserId(currentUid);
      loadUserPreferences(currentUid, sessionUser?.user_metadata);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: string, session: any) => {
        const newUid = session?.user?.id || null;
        setUserId(newUid);
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          loadUserPreferences(newUid, session?.user?.user_metadata);
        } else if (event === "SIGNED_OUT") {
          loadUserPreferences(null);
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [loadUserPreferences]);

  // Core update and persistence handler
  const updatePreferences = useCallback(
    async (partial: Partial<UIDesignPreferences>) => {
      const next: UIDesignPreferences = {
        ...preferences,
        ...partial,
      };

      // Apply instantly in state & DOM
      setPreferences(next);
      applyDesign(next);

      // Save to user-scoped local storage
      const storageKey = getStorageKey(userId);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore storage quota */
      }

      // If user is authenticated, persist to profile in database / auth metadata
      if (userId) {
        setIsSaving(true);
        try {
          // Update Supabase user metadata
          await supabase.auth.updateUser({
            data: { ui_design_preferences: next },
          });
          // Also call server function for backend verification
          await saveMyDesignPreferences({ data: next });
          setLastSavedAt(new Date());
        } catch (err) {
          console.error("Failed to sync design preferences to cloud profile:", err);
        } finally {
          setIsSaving(false);
        }
      }
    },
    [preferences, userId]
  );

  const setTheme = useCallback(
    async (tone: ThemeTone) => {
      await updatePreferences({ theme: tone });
    },
    [updatePreferences]
  );

  const setMode = useCallback(
    async (mode: ColorMode) => {
      await updatePreferences({ mode });
    },
    [updatePreferences]
  );

  const setDensity = useCallback(
    async (density: UIDensity) => {
      await updatePreferences({ density });
    },
    [updatePreferences]
  );

  const setFontSize = useCallback(
    async (fontSize: UIFontSize) => {
      await updatePreferences({ fontSize });
    },
    [updatePreferences]
  );

  const setRadius = useCallback(
    async (radius: UIRadius) => {
      await updatePreferences({ radius });
    },
    [updatePreferences]
  );

  const randomTheme = useCallback(async () => {
    const tone = createRandomTone();
    await updatePreferences({ theme: tone });
  }, [updatePreferences]);

  const toggleFavourite = useCallback(
    async (tone: ThemeTone) => {
      const current = preferences.favourites || [];
      const nextFavs = current.some((f) => f.id === tone.id)
        ? current.filter((f) => f.id !== tone.id)
        : [...current, tone];
      await updatePreferences({ favourites: nextFavs });
    },
    [preferences.favourites, updatePreferences]
  );

  const resetToDefaults = useCallback(async () => {
    await updatePreferences(DEFAULT_DESIGN_PREFERENCES);
  }, [updatePreferences]);

  const value = useMemo<ThemeCtx>(
    () => ({
      preferences,
      theme: preferences.theme,
      mode: preferences.mode,
      density: preferences.density,
      fontSize: preferences.fontSize,
      radius: preferences.radius,
      favourites: preferences.favourites || [],
      userId,
      isSaving,
      lastSavedAt,
      setTheme,
      setMode,
      setDensity,
      setFontSize,
      setRadius,
      updatePreferences,
      randomTheme,
      toggleFavourite,
      isFavourite: (t) => (preferences.favourites || []).some((f) => f.id === t.id),
      resetToDefaults,
    }),
    [
      preferences,
      userId,
      isSaving,
      lastSavedAt,
      setTheme,
      setMode,
      setDensity,
      setFontSize,
      setRadius,
      updatePreferences,
      randomTheme,
      toggleFavourite,
      resetToDefaults,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
