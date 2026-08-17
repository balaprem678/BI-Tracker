import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyProfile = {
  id: string;
  email: string | null;
  full_name: string;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  hourly_rate: number;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, job_title, department, hourly_rate")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      id: context.userId,
      email: data?.email ?? null,
      full_name: data?.full_name ?? "",
      job_title: data?.job_title ?? null,
      department: data?.department ?? null,
      phone: null,
      hourly_rate: Number(data?.hourly_rate ?? 0),
    };
  });

const updateInput = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(120),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof updateInput>) => updateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        job_title: data.jobTitle || null,
        department: data.department || null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
