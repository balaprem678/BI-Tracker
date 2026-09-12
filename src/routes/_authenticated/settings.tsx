import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Heart,
  Shuffle,
  Sun,
  Moon,
  Laptop,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  Maximize2,
  Minimize2,
  Type,
  Square,
  Circle,
  CloudCheck,
  Layers,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import {
  PRESET_THEMES,
  useTheme,
  type ThemeTone,
  type ColorMode,
  type UIDensity,
  type UIFontSize,
  type UIRadius,
  createCustomTone,
} from "@/components/theme-provider";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Personal Settings & Design — BI Tracker" },
      {
        name: "description",
        content:
          "Personalize your BI Tracker experience with custom theme colors, dark/light appearance, display density, and font scaling.",
      },
      { property: "og:title", content: "Personal Settings & Design — BI Tracker" },
      {
        property: "og:description",
        content:
          "Custom profile design settings for BI Tracker. Persists across logins for every employee and admin.",
      },
    ],
  }),
  component: SettingsPage,
});

function ThemeCard({
  tone,
  isActive,
  isFav,
  onSelect,
  onToggleFav,
}: {
  tone: ThemeTone;
  isActive: boolean;
  isFav: boolean;
  onSelect: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition-all ${
        isActive
          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/50 hover:bg-secondary/40"
      }`}
    >
      <div className="flex items-start justify-between">
        <span
          className="size-9 rounded-lg border border-border/40 shadow-xs transition-transform group-hover:scale-105"
          style={{ background: tone.swatch }}
        />
        <button
          type="button"
          onClick={onToggleFav}
          aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
          className={`rounded-md p-1.5 transition-colors ${
            isFav
              ? "text-rose-500 hover:text-rose-600 dark:text-rose-400"
              : "text-muted-foreground/60 hover:text-foreground"
          }`}
        >
          <Heart className={`size-4 ${isFav ? "fill-current" : ""}`} />
        </button>
      </div>

      <div className="mt-3">
        <p className="truncate text-sm font-medium">{tone.name}</p>
        <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Hue {tone.hue}°</span>
          {isActive && (
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <Check className="size-3" /> Active
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  const sessionFn = useServerFn(getSessionInfo);
  const session = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });

  const {
    theme,
    mode,
    density,
    fontSize,
    radius,
    favourites,
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
    isFavourite,
    resetToDefaults,
  } = useTheme();

  const [customHue, setCustomHue] = useState(theme.hue);

  if (!session.data) return null;

  const handleCustomHueChange = (hue: number) => {
    setCustomHue(hue);
    const tone = createCustomTone(hue);
    setTheme(tone);
  };

  const handleReset = async () => {
    if (confirm("Reset your profile design preferences back to default settings?")) {
      await resetToDefaults();
      toast.success("Design preferences reset to defaults.");
    }
  };

  return (
    <AppShell session={session.data}>
      <div className="mx-auto max-w-5xl space-y-8 pb-12">
        {/* Header with profile sync indicator */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Personal Settings</h1>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
                {session.data.role.replace("_", " ")}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Customize your console appearance. Each profile maintains its own unique design that is
              retained whenever you log in.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Cloud save indicator */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              {isSaving ? (
                <>
                  <span className="size-2 animate-ping rounded-full bg-amber-500" />
                  <span>Saving to profile…</span>
                </>
              ) : lastSavedAt ? (
                <>
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-foreground">Saved to profile</span>
                </>
              ) : (
                <>
                  <span className="size-2 rounded-full bg-primary" />
                  <span>Profile customizer active</span>
                </>
              )}
            </div>

            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Reset design to defaults"
            >
              <RotateCcw className="size-3.5" />
              Reset Defaults
            </button>
          </div>
        </div>

        {/* 1. Appearance Mode (Dark / Light / System) */}
        <Panel
          title="Appearance Mode"
          hint="Select your preferred display theme. Adjusts backgrounds, contrast, and surface luminescence."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                id: "dark" as ColorMode,
                name: "Dark Console",
                desc: "Glowing signals on deep tech surfaces",
                icon: Moon,
              },
              {
                id: "light" as ColorMode,
                name: "Light Console",
                desc: "Crisp white surfaces with clean contrast",
                icon: Sun,
              },
              {
                id: "system" as ColorMode,
                name: "System Match",
                desc: "Automatically adapts to OS day/night mode",
                icon: Laptop,
              },
            ].map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/50 hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={`grid size-9 place-items-center rounded-lg ${
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-4.5" />
                    </span>
                    {active && <Check className="size-4 text-primary" />}
                  </div>
                  <span className="mt-3 text-sm font-semibold">{m.name}</span>
                  <span className="mt-0.5 text-xs text-muted-foreground">{m.desc}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* 2. Accent Color Palettes & Custom Hue */}
        <Panel
          title="Accent Palette"
          hint="Pick a signature accent color tone for charts, buttons, indicators, and focus rings."
          action={
            <button
              onClick={() => randomTheme()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-secondary"
            >
              <Shuffle className="size-3.5" />
              Shuffle Random
            </button>
          }
        >
          {/* Active Palette Banner */}
          <div className="mb-5 flex flex-col gap-4 rounded-xl border border-border bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                className="size-11 rounded-xl border border-border/60 shadow-xs"
                style={{ background: theme.swatch }}
              />
              <div>
                <p className="text-sm font-semibold">{theme.name}</p>
                <p className="text-xs text-muted-foreground">
                  Hue: {theme.hue}° · Chroma: {theme.chroma} · Active profile theme
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavourite(theme)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isFavourite(theme)
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Heart className={`size-3.5 ${isFavourite(theme) ? "fill-current" : ""}`} />
                {isFavourite(theme) ? "Favourited" : "Save as Favourite"}
              </button>
            </div>
          </div>

          {/* Preset Swatches */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
            {PRESET_THEMES.map((tone) => (
              <ThemeCard
                key={tone.id}
                tone={tone}
                isActive={theme.id === tone.id}
                isFav={isFavourite(tone)}
                onSelect={() => setTheme(tone)}
                onToggleFav={(e) => {
                  e.stopPropagation();
                  toggleFavourite(tone);
                }}
              />
            ))}
          </div>

          {/* Custom Hue Spectrum Slider */}
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Palette className="size-3.5" />
                Custom Hue Spectrum
              </span>
              <span className="font-mono text-xs font-medium text-foreground">{customHue}°</span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="360"
                value={customHue}
                onChange={(e) => handleCustomHueChange(Number(e.target.value))}
                className="h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-gradient-to-r from-red-500 via-green-500 via-blue-500 to-red-500 accent-primary"
              />
              <span
                className="size-7 shrink-0 rounded-md border border-border"
                style={{ background: `oklch(0.55 0.12 ${customHue})` }}
              />
            </div>
          </div>
        </Panel>

        {/* 3. Display Density & Geometry */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Display Density */}
          <Panel
            title="Display Density"
            hint="Adjust row height and compact spacing across dashboards and tables."
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  id: "comfortable" as UIDensity,
                  name: "Comfortable",
                  desc: "Spacious padding & breathing room",
                  icon: Maximize2,
                },
                {
                  id: "compact" as UIDensity,
                  name: "Compact",
                  desc: "High density for maximum data rows",
                  icon: Minimize2,
                },
              ].map((d) => {
                const Icon = d.icon;
                const active = density === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDensity(d.id)}
                    className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/50 hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      {active && <Check className="size-3.5 text-primary" />}
                    </div>
                    <span className="mt-2 text-sm font-medium">{d.name}</span>
                    <span className="mt-0.5 text-xs text-muted-foreground">{d.desc}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Corner Radius */}
          <Panel
            title="Corner Geometry"
            hint="Choose the curvature of cards, buttons, modals, and input fields."
          >
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "sharp" as UIRadius, name: "Sharp", radius: "4px", icon: Square },
                { id: "normal" as UIRadius, name: "Standard", radius: "8px", icon: Layers },
                { id: "pill" as UIRadius, name: "Pill", radius: "14px", icon: Circle },
              ].map((r) => {
                const Icon = r.icon;
                const active = radius === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRadius(r.id)}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                      active
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/50 hover:bg-secondary/40"
                    }`}
                  >
                    <Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="mt-2 text-xs font-semibold">{r.name}</span>
                    <span className="text-[11px] text-muted-foreground">{r.radius}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* 4. Font Scaling */}
        <Panel
          title="Typography Scale"
          hint="Scale interface font size for comfortable reading or higher information density."
        >
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "compact" as UIFontSize, label: "Compact", sample: "13.5px" },
              { id: "normal" as UIFontSize, label: "Default", sample: "14.5px" },
              { id: "large" as UIFontSize, label: "Large", sample: "15.5px" },
            ].map((f) => {
              const active = fontSize === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFontSize(f.id)}
                  className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/50 hover:bg-secondary/40"
                  }`}
                >
                  <div className="text-left">
                    <span className="block text-xs font-semibold">{f.label}</span>
                    <span className="text-[11px] text-muted-foreground">{f.sample}</span>
                  </div>
                  {active && <Check className="size-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </Panel>

        {/* 5. Live Interactive Preview Console */}
        <Panel
          title="Live Component Preview"
          hint="Test how your selected theme palette, appearance mode, and radius render across real UI widgets."
        >
          <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                  BI
                </span>
                <div>
                  <p className="text-sm font-semibold">Active Design Sandbox</p>
                  <p className="text-xs text-muted-foreground">
                    Real-time preview rendered with current profile tokens
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Clocked In
                </span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  #EMP-9021
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Hours Logged</p>
                <p className="mt-1 font-mono text-xl font-bold text-foreground">7h 45m</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Active Task</p>
                <p className="mt-1 truncate text-sm font-medium text-foreground">API Integration Review</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Accent Style</p>
                <p className="mt-1 text-sm font-semibold text-primary">{theme.name}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-xs transition-opacity hover:opacity-90"
              >
                Primary Button
              </button>
              <button
                type="button"
                className="rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
              >
                Secondary Button
              </button>
              <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                Accent Badge
              </span>
            </div>
          </div>
        </Panel>

        {/* 6. Favourite Themes Shelf */}
        <Panel
          title="Favourite Themes"
          hint="Palettes you have bookmarked for quick 1-tap switching. Stored in your profile."
        >
          {favourites.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
              <Heart className="size-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">No favourite themes bookmarked yet</p>
              <p className="text-xs text-muted-foreground/70">
                Click the heart icon on any preset or random palette above to bookmark it to your shelf.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {favourites.map((tone) => (
                <ThemeCard
                  key={tone.id}
                  tone={tone}
                  isActive={theme.id === tone.id}
                  isFav={true}
                  onSelect={() => setTheme(tone)}
                  onToggleFav={(e) => {
                    e.stopPropagation();
                    toggleFavourite(tone);
                  }}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
