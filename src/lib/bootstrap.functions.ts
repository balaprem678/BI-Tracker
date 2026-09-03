import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const DEFAULT_ADMIN_USERNAME = "BIadmin";
export const DEFAULT_ADMIN_EMAIL = "BIadmin@bi-tracker.local";
export const DEFAULT_ADMIN_PASSWORD = "BiTracker@07";
export const DEFAULT_ADMIN_FULL_NAME = "BI Admin";

export function normalizeAdminIdentifier(identifier: string) {
  const value = identifier.trim();
  if (!value) return "";
  if (value.toLowerCase() === DEFAULT_ADMIN_USERNAME.toLowerCase()) {
    return DEFAULT_ADMIN_EMAIL;
  }
  return value;
}

/**
 * Bootstrap-only: allows creating the very first administrator account.
 * Once any admin exists this endpoint refuses — all further accounts are
 * created by an admin from the admin panel. Employees can never self sign up.
 */
export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

const bootstrapInput = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
  fullName: z.string().trim().min(1).max(120),
});

export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof bootstrapInput>) => bootstrapInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) {
      return { ok: false as const, message: "An administrator already exists." };
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      return { ok: false as const, message: error?.message ?? "Could not create account" };
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });

    return { ok: true as const, message: "Administrator created. You can sign in now." };
  });
