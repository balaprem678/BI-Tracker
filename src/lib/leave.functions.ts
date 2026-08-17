import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeaveRequest = {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  status: string;
  created_at: string;
};

export const getMyLeaves = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leave_requests")
      .select("id, start_date, end_date, leave_type, reason, status, created_at")
      .eq("user_id", context.userId)
      .order("start_date", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as LeaveRequest[];
  });

const leaveInput = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leaveType: z.string().trim().min(1).max(40),
  reason: z.string().trim().max(500),
});

export const requestLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof leaveInput>) => leaveInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.endDate < data.startDate) {
      return { ok: false as const, message: "End date is before the start date." };
    }
    const { error } = await context.supabase.from("leave_requests").insert({
      user_id: context.userId,
      start_date: data.startDate,
      end_date: data.endDate,
      leave_type: data.leaveType,
      reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, message: "Leave request submitted." };
  });

export const cancelLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("leave_requests")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
