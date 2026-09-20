import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeaveRequest = {
  id: string;
  user_id?: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  clean_reason?: string;
  time_slot?: string | null;
  from_time?: string | null;
  to_time?: string | null;
  status: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_note?: string | null;
  created_at: string;
  updated_at?: string;
  // Enriched fields for Admin view
  employee_name?: string;
  employee_email?: string;
  employee_job_title?: string | null;
  employee_department?: string | null;
  employee_staff_section?: string | null;
  reviewer_name?: string | null;
};

// 30-minute time slots strictly between 9:00 AM and 9:00 PM
export const LEAVE_TIME_SLOT_OPTIONS = [
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "01:00 PM",
  "01:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
  "04:30 PM",
  "05:00 PM",
  "05:30 PM",
  "06:00 PM",
  "06:30 PM",
  "07:00 PM",
  "07:30 PM",
  "08:00 PM",
  "08:30 PM",
  "09:00 PM",
] as const;

export function timeToMinutes(timeStr: string): number {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match || !match[1] || !match[2] || !match[3]) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "AM") {
    if (hours === 12) hours = 0;
  } else if (period === "PM") {
    if (hours !== 12) hours += 12;
  }
  return hours * 60 + minutes;
}

export function formatSlotDuration(fromTime: string, toTime: string): string {
  const start = timeToMinutes(fromTime);
  const end = timeToMinutes(toTime);
  const diff = end - start;
  if (diff <= 0) return "0 mins";
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hrs > 0 && mins > 0) {
    return `${hrs} hr${hrs > 1 ? "s" : ""} ${mins} min${mins > 1 ? "s" : ""}`;
  }
  if (hrs > 0) {
    return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  }
  return `${mins} min${mins > 1 ? "s" : ""}`;
}

export function parseLeaveTimeSlot(reason?: string | null, rawTimeSlot?: string | null) {
  let timeSlot: string | null = rawTimeSlot || null;
  let cleanReason = reason || "";

  if (!timeSlot && reason) {
    const match = reason.match(/^\[Time Slot:\s*([^\]]+)\]\s*([\s\S]*)$/i);
    if (match && match[1]) {
      timeSlot = match[1].trim();
      cleanReason = match[2] ? match[2].trim() : "";
    }
  }

  let fromTime: string | null = null;
  let toTime: string | null = null;
  if (timeSlot) {
    const slotMatch = timeSlot.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (slotMatch && slotMatch[1] && slotMatch[2]) {
      fromTime = slotMatch[1];
      toTime = slotMatch[2];
    }
  }

  return {
    timeSlot,
    fromTime,
    toTime,
    cleanReason,
  };
}

export const getMyLeaves = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LeaveRequest[]> => {
    const { data, error } = await context.supabase
      .from("leave_requests")
      .select("id, user_id, start_date, end_date, leave_type, reason, status, reviewed_by, reviewed_at, reviewer_note, created_at")
      .eq("user_id", context.userId)
      .order("start_date", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((l: any) => {
      const parsed = parseLeaveTimeSlot(l.reason, l.time_slot);
      return {
        ...l,
        time_slot: parsed.timeSlot,
        from_time: parsed.fromTime,
        to_time: parsed.toTime,
        clean_reason: parsed.cleanReason,
      } as LeaveRequest;
    });
  });

const leaveInput = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leaveType: z.string().trim().min(1).max(40),
  reason: z.string().trim().max(500),
  fromTime: z.string().optional(),
  toTime: z.string().optional(),
  timeSlot: z.string().optional(),
});

export const requestLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof leaveInput>) => leaveInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.endDate < data.startDate) {
      return { ok: false as const, message: "End date is before the start date." };
    }

    let fullReason = data.reason;
    let slotStr: string | null = null;

    if (data.fromTime && data.toTime) {
      const startMin = timeToMinutes(data.fromTime);
      const endMin = timeToMinutes(data.toTime);

      // Business hours constraint: 9:00 AM (540m) to 9:00 PM (1260m)
      if (startMin < 540 || endMin > 1260) {
        return {
          ok: false as const,
          message: "Time slot must be within working hours (09:00 AM to 09:00 PM).",
        };
      }
      if (endMin <= startMin) {
        return {
          ok: false as const,
          message: "End time must be after start time.",
        };
      }

      const durationStr = formatSlotDuration(data.fromTime, data.toTime);
      slotStr = `${data.fromTime} – ${data.toTime} (${durationStr})`;
      fullReason = `[Time Slot: ${slotStr}] ${data.reason}`.trim();
    } else if (data.timeSlot) {
      slotStr = data.timeSlot;
      fullReason = `[Time Slot: ${slotStr}] ${data.reason}`.trim();
    }

    const { error } = await context.supabase.from("leave_requests").insert({
      user_id: context.userId,
      start_date: data.startDate,
      end_date: data.endDate,
      leave_type: data.leaveType,
      reason: fullReason,
      status: "Pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, message: "Leave request submitted successfully." };
  });

export const cancelLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("leave_requests")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, message: "Leave request cancelled." };
  });

// ==========================================
// ADMIN LEAVE MANAGEMENT FUNCTIONS
// ==========================================

const adminLeaveFilterInput = z.object({
  status: z.string().optional().or(z.literal("all")),
  staffSection: z.string().optional().or(z.literal("all")),
  leaveType: z.string().optional().or(z.literal("all")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  search: z.string().optional().or(z.literal("")),
});

export const getAllLeaveRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof adminLeaveFilterInput>) => adminLeaveFilterInput.parse(input))
  .handler(async ({ data: filter, context }) => {
    const { supabase, userId } = context;

    // Check admin role
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      throw new Error("Unauthorized: Admin access required.");
    }

    let query = supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter.status && filter.status !== "all") {
      query = query.eq("status", filter.status);
    }
    if (filter.leaveType && filter.leaveType !== "all") {
      if (filter.leaveType === "Casual Leave") {
        query = query.in("leave_type", ["Casual Leave", "Casual"]);
      } else if (filter.leaveType === "WFH") {
        query = query.in("leave_type", ["WFH", "Work from home", "Work From Home"]);
      } else if (filter.leaveType === "Sick") {
        query = query.in("leave_type", ["Sick", "Sick Leave"]);
      } else {
        query = query.eq("leave_type", filter.leaveType);
      }
    }
    if (filter.startDate) {
      query = query.gte("start_date", filter.startDate);
    }
    if (filter.endDate) {
      query = query.lte("end_date", filter.endDate);
    }

    const [{ data: leaves, error: lErr }, { data: profiles, error: pErr }] = await Promise.all([
      query,
      supabase.from("profiles").select("id, full_name, email, job_title, department, staff_section"),
    ]);

    if (lErr) throw new Error(lErr.message);
    if (pErr) throw new Error(pErr.message);

    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

    const enriched: LeaveRequest[] = (leaves ?? []).map((l: any) => {
      const emp = profileMap.get(l.user_id);
      const reviewer = l.reviewed_by ? profileMap.get(l.reviewed_by) : null;
      const parsed = parseLeaveTimeSlot(l.reason, l.time_slot);

      return {
        ...l,
        time_slot: parsed.timeSlot,
        from_time: parsed.fromTime,
        to_time: parsed.toTime,
        clean_reason: parsed.cleanReason,
        employee_name: emp?.full_name ?? "Unknown Employee",
        employee_email: emp?.email ?? "",
        employee_job_title: emp?.job_title ?? null,
        employee_department: emp?.department ?? null,
        employee_staff_section: emp?.staff_section ?? "IT Team",
        reviewer_name: reviewer?.full_name ?? null,
      };
    });

    // Client-side / in-memory secondary filters
    let filtered = enriched;

    if (filter.staffSection && filter.staffSection !== "all") {
      filtered = filtered.filter(
        (l) =>
          (filter.staffSection === "IT Team" && (l.employee_staff_section === "IT Team" || l.employee_staff_section === "it_team")) ||
          (filter.staffSection === "BI Staff" && (l.employee_staff_section === "BI Staff" || l.employee_staff_section === "bi_staff")),
      );
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      filtered = filtered.filter(
        (l) =>
          l.employee_name?.toLowerCase().includes(q) ||
          l.employee_email?.toLowerCase().includes(q) ||
          l.reason?.toLowerCase().includes(q) ||
          l.time_slot?.toLowerCase().includes(q) ||
          l.leave_type?.toLowerCase().includes(q),
      );
    }

    const pendingCount = enriched.filter((l) => l.status === "Pending").length;
    const approvedCount = enriched.filter((l) => l.status === "Approved").length;
    const rejectedCount = enriched.filter((l) => l.status === "Rejected").length;

    return {
      leaves: filtered,
      totalCount: enriched.length,
      pendingCount,
      approvedCount,
      rejectedCount,
    };
  });

export const getPendingLeaveNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Check admin role
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return { pendingCount: 0, recentPending: [] };
    }

    const [{ data: pendingLeaves }, { data: profiles }] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("id, user_id, start_date, end_date, leave_type, reason, status, created_at")
        .eq("status", "Pending")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, department, staff_section"),
    ]);

    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

    const recentPending: LeaveRequest[] = (pendingLeaves ?? []).slice(0, 8).map((l: any) => {
      const emp = profileMap.get(l.user_id);
      const parsed = parseLeaveTimeSlot(l.reason, l.time_slot);
      return {
        ...l,
        time_slot: parsed.timeSlot,
        from_time: parsed.fromTime,
        to_time: parsed.toTime,
        clean_reason: parsed.cleanReason,
        employee_name: emp?.full_name ?? "Unknown Employee",
        employee_email: emp?.email ?? "",
        employee_department: emp?.department ?? null,
        employee_staff_section: emp?.staff_section ?? "IT Team",
      };
    });

    return {
      pendingCount: pendingLeaves?.length ?? 0,
      recentPending,
    };
  });

const updateLeaveStatusInput = z.object({
  id: z.string().min(1),
  status: z.enum(["Approved", "Rejected", "Pending"]),
  reviewerNote: z.string().trim().max(500).optional(),
});

export const updateLeaveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof updateLeaveStatusInput>) => updateLeaveStatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check admin role
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      throw new Error("Unauthorized: Admin access required.");
    }

    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: data.status,
        reviewed_by: userId,
        reviewed_at: nowIso,
        reviewer_note: data.reviewerNote || null,
        updated_at: nowIso,
      })
      .eq("id", data.id);

    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      message: `Leave request ${data.status.toLowerCase()} successfully.`,
    };
  });
