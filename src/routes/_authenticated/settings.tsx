import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Shuffle } from "lucide-react";
import { AppShell, Panel } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import { PRESET_THEMES, useTheme, type ThemeTone } from "@/components/theme-provider";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Theme — BI Tracker" },
      {
        name: "description",
        content:
          "Pick an accent theme, shuffle random colours and save favourite themes for BI Tracker.",
      },
      { property: "og:title", content: "Settings & Theme — BI Tracker" },
      {
        property: "og:description",
        content: "Personalise BI Tracker with preset palettes, random colours and favourites.",
      },
    ],
  }),
  component: SettingsPage,
});

function Swatch({ tone }: { tone: ThemeTone }) {
  const { theme, setTheme, toggleFavourite, isFavourite } = useTheme();
  const active = theme.id === tone.id;
  const fav = isFavourite(tone);
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        active ? "border-primary bg-secondary/60" : "border-border hover:bg-secondary/40"
      }`}
    >
      <button onClick={() => setTheme(tone)} className="flex w-full items-center gap-3 text-left">
        <span
          className="size-9 shrink-0 rounded-md border border-border"
          style={{ background: tone.swatch }}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{tone.name}</span>
          <span className="block text-xs text-muted-foreground">
            {active ? "Applied" : "Tap to apply"}
          </span>
        </span>
      </button>
      <button
        onClick={() => toggleFavourite(tone)}
        aria-label={fav ? "Remove favourite" : "Add favourite"}
        className={`mt-3 inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs transition-colors ${
          fav ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Heart className={`size-3.5 ${fav ? "fill-current" : ""}`} />
        {fav ? "Favourite" : "Mark favourite"}
      </button>
    </div>
  );
}

function SettingsPage() {
  const sessionFn = useServerFn(getSessionInfo);
  const session = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });
  const { theme, favourites, randomTheme, toggleFavourite } = useTheme();

  if (!session.data) return null;

  return (
    <AppShell session={session.data}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Setting</h1>

      <div className="grid gap-6">
        <Panel
          title="Theme colour"
          hint="Choose a preset or shuffle a random colour, then favourite the ones you like."
          action={
            <button
              onClick={randomTheme}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Shuffle className="size-4" />
              Random colour
            </button>
          }
        >
          <div className="mb-4 flex items-center gap-3 rounded-md border border-border p-3">
            <span
              className="size-10 rounded-md border border-border"
              style={{ background: theme.swatch }}
            />
            <div>
              <p className="text-sm font-medium">Current: {theme.name}</p>
              <p className="text-xs text-muted-foreground">
                Saved on this device and applied across every page.
              </p>
            </div>
            <button
              onClick={() => toggleFavourite(theme)}
              className="ml-auto inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Heart className="size-3.5" />
              Favourite this
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PRESET_THEMES.map((tone) => (
              <Swatch key={tone.id} tone={tone} />
            ))}
          </div>
        </Panel>

        <Panel title="Favourite themes" hint="Click any favourite to apply it instantly.">
          {favourites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No favourites yet — mark a preset or a random colour above.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {favourites.map((tone) => (
                <Swatch key={tone.id} tone={tone} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
