import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const themeToneSchema = z.object({
  id: z.string(),
  name: z.string(),
  hue: z.number(),
  chroma: z.number(),
  swatch: z.string(),
});

export const designPreferencesSchema = z.object({
  theme: themeToneSchema,
  mode: z.enum(["dark", "light", "system"]).default("dark"),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  fontSize: z.enum(["compact", "normal", "large"]).default("normal"),
  radius: z.enum(["sharp", "normal", "pill"]).default("normal"),
  favourites: z.array(themeToneSchema).default([]),
});

export type UIDesignPreferences = z.infer<typeof designPreferencesSchema>;

export const DEFAULT_DESIGN_PREFERENCES: UIDesignPreferences = {
  theme: {
    id: "teal",
    name: "Teal Console",
    hue: 200,
    chroma: 0.104,
    swatch: "oklch(0.53 0.104 200)",
  },
  mode: "dark",
  density: "comfortable",
  fontSize: "normal",
  radius: "normal",
  favourites: [],
};

export const getMyDesignPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UIDesignPreferences> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: authUser, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      if (error || !authUser?.user) {
        return DEFAULT_DESIGN_PREFERENCES;
      }

      const prefs = authUser.user.user_metadata?.ui_design_preferences;
      if (!prefs) {
        return DEFAULT_DESIGN_PREFERENCES;
      }

      const parsed = designPreferencesSchema.safeParse(prefs);
      if (parsed.success) {
        return parsed.data;
      }
    } catch (err) {
      console.error("Failed to load user design preferences:", err);
    }
    return DEFAULT_DESIGN_PREFERENCES;
  });

export const saveMyDesignPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UIDesignPreferences) => designPreferencesSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const prevMeta = existingUser?.user?.user_metadata || {};

      const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        user_metadata: {
          ...prevMeta,
          ui_design_preferences: data,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true as const, preferences: data };
    } catch (err: any) {
      console.error("Failed to save user design preferences:", err);
      throw new Error(err?.message || "Failed to persist design preferences");
    }
  });
