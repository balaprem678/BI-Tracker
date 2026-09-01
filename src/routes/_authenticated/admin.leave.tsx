import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Search,
  Users,
  AlertCircle,
  Eye,
  MessageSquare,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  Shield,
  UserCheck,
} from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import {
  getAllLeaveRequests,
  LeaveRequest,
  updateLeaveStatus,
} from "@/lib/leave.functions";
import { LEAVE_TYPES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/admin/leave")({
  head: () => ({
    meta: [
      { title: "Leave Management — Admin Console" },
      {
        name: "description",
        content: "Review, approve, reject, and manage employee leave requests in real-time.",
      },
      { property: "og:title", content: "Leave Management — Admin Console" },
    ],
  }),
  component: AdminLeavePage,
});

function calculateDays(start: string, end: string) {
  if (!start || !end) return 1;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name?: string, email?: string) {
  return (name || email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "U";
}

function AdminLeavePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sessionFn = useServerFn(getSessionInfo);
  const getAllLeavesFn = useServerFn(getAllLeaveRequests);
  const updateStatusFn = useServerFn(updateLeaveStatus);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [staffSectionFilter, setStaffSectionFilter] = useState<string>("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [actionModal, setActionModal] = useState<{
    leave: LeaveRequest;
    action: "Approved" | "Rejected";
  } | null>(null);
  const [reviewerNote, setReviewerNote] = useState<string>("");

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => sessionFn({}),
  });

  // Role Protection: Only Admin can access
  useEffect(() => {
    if (session && session.role !== "admin") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [session, navigate]);

  const { data: leaveData, isLoading } = useQuery({
    queryKey: [
      "admin-all-leaves",
      statusFilter,
      staffSectionFilter,
      leaveTypeFilter,
      startDate,
      endDate,
      searchQuery,
    ],
    queryFn: () =>
      getAllLeavesFn({
        data: {
          status: statusFilter,
          staffSection: staffSectionFilter,
          leaveType: leaveTypeFilter,
          startDate,
          endDate,
          search: searchQuery,
        },
      }),
    refetchInterval: 6000, // Real-time poll every 6s
    enabled: session?.role === "admin",
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; status: "Approved" | "Rejected"; reviewerNote?: string }) =>
      updateStatusFn({ data: payload }),
    onSuccess: (res) => {
      toast.success(res.message);
      setActionModal(null);
      setSelectedLeave(null);
      setReviewerNote("");
      qc.invalidateQueries({ queryKey: ["admin-all-leaves"] });
      qc.invalidateQueries({ queryKey: ["pending-leave-notifications"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update leave status."),
  });

  const leavesList = leaveData?.leaves ?? [];

  const totalDaysRequested = useMemo(() => {
    return leavesList.reduce((acc, l) => acc + calculateDays(l.start_date, l.end_date), 0);
  }, [leavesList]);

  if (!session || session.role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading Leave Console…
      </div>
    );
  }

  return (
    <AppShell session={session}>
      {/* Header Banner */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-gradient-to-r from-card via-card/80 to-accent/20 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Leave Management
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <CalendarDays className="size-3.5" />
              HR Portal
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Review, approve, and track employee leave requests across IT Team and BI Staff in real-time.
          </p>
        </div>

        {leaveData && leaveData.pendingCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse">
            <Clock className="size-4" />
            <span>{leaveData.pendingCount} Pending Request{leaveData.pendingCount > 1 ? "s" : ""} Awaiting Review</span>
          </div>
        )}
      </div>

      {/* KPI Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Total Requests" value={leaveData?.totalCount ?? 0} />
        <Stat
          label="Pending Review"
          value={leaveData?.pendingCount ?? 0}
          suffix={leaveData && leaveData.pendingCount > 0 ? " Urgent" : ""}
        />
        <Stat label="Approved" value={leaveData?.approvedCount ?? 0} />
        <Stat label="Rejected" value={leaveData?.rejectedCount ?? 0} />
        <Stat label="Total Days" value={totalDaysRequested} suffix=" days" />
      </div>

      {/* Main Filter & Search Bar */}
      <div className="space-y-6">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
            {/* Status Filter Tabs */}
            <div className="flex rounded-lg border border-border/80 bg-background/80 p-1 text-xs font-semibold">
              {[
                { id: "all", label: "All Requests" },
                { id: "Pending", label: `Pending (${leaveData?.pendingCount ?? 0})` },
                { id: "Approved", label: "Approved" },
                { id: "Rejected", label: "Rejected" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 transition-all ${
                    statusFilter === tab.id
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-muted-foreground font-medium">
              Showing {leavesList.length} request{leavesList.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Staff Section
              </span>
              <select
                value={staffSectionFilter}
                onChange={(e) => setStaffSectionFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
              >
                <option value="all">All Sections (IT & BI)</option>
                <option value="IT Team">IT Team</option>
                <option value="BI Staff">BI Staff</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Leave Type
              </span>
              <select
                value={leaveTypeFilter}
                onChange={(e) => setLeaveTypeFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
              >
                <option value="all">All Leave Types</option>
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                From Date
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                To Date
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
              />
            </label>
          </div>

          {/* Quick Search */}
          <div className="relative pt-1">
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by employee name, email, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-4 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Requests Table */}
        <Panel
          title="Employee Leave Requests"
          hint="Review requests and apply real-time approval verdicts."
        >
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading leave requests…
            </div>
          ) : leavesList.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
              <CalendarDays className="mx-auto size-8 text-muted-foreground/60" />
              <p className="font-semibold text-foreground">No matching leave requests found</p>
              <p className="text-xs">Adjust your filters or wait for new submissions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 font-semibold">Employee</th>
                    <th className="pb-3 font-semibold">Leave Type</th>
                    <th className="pb-3 font-semibold">Duration & Dates</th>
                    <th className="pb-3 font-semibold">Reason</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Submitted</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {leavesList.map((leave) => {
                    const days = calculateDays(leave.start_date, leave.end_date);
                    const isIT =
                      leave.employee_staff_section === "IT Team" ||
                      leave.employee_staff_section === "it_team";

                    return (
                      <tr key={leave.id} className="hover:bg-accent/40 transition-colors">
                        {/* Employee Details */}
                        <td className="py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {getInitials(leave.employee_name, leave.employee_email)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground text-xs truncate">
                                {leave.employee_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {leave.employee_email}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span
                                  className={`inline-flex rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                                    isIT
                                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                      : "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                  }`}
                                >
                                  {isIT ? "IT Team" : "BI Staff"}
                                </span>
                                {leave.employee_department && (
                                  <span className="text-[10px] text-muted-foreground">
                                    · {leave.employee_department}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Leave Type */}
                        <td className="py-3.5">
                          <span className="inline-flex rounded-md bg-secondary/80 px-2 py-1 text-xs font-semibold text-secondary-foreground">
                            {leave.leave_type}
                          </span>
                        </td>

                        {/* Duration & Dates */}
                        <td className="py-3.5">
                          <div className="font-mono text-xs font-bold text-foreground">
                            {days} day{days > 1 ? "s" : ""}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatDate(leave.start_date)} → {formatDate(leave.end_date)}
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="py-3.5 max-w-xs">
                          <p className="text-xs text-foreground line-clamp-2">
                            {leave.reason || "—"}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              leave.status === "Approved"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : leave.status === "Pending"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                leave.status === "Approved"
                                  ? "bg-emerald-500"
                                  : leave.status === "Pending"
                                  ? "bg-amber-500"
                                  : "bg-destructive"
                              }`}
                            />
                            {leave.status}
                          </span>
                        </td>

                        {/* Submitted Timestamp */}
                        <td className="py-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatDate(leave.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedLeave(leave)}
                              className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                              title="View Full Details"
                            >
                              <Eye className="size-3.5" />
                            </button>

                            {leave.status === "Pending" && (
                              <>
                                <button
                                  onClick={() =>
                                    setActionModal({ leave, action: "Approved" })
                                  }
                                  className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 active:scale-[0.98] transition-all"
                                  title="Approve Request"
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  Approve
                                </button>
                                <button
                                  onClick={() =>
                                    setActionModal({ leave, action: "Rejected" })
                                  }
                                  className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive hover:bg-destructive/20 active:scale-[0.98] transition-all"
                                  title="Reject Request"
                                >
                                  <XCircle className="size-3.5" />
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* APPROVE / REJECT ACTION MODAL */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {actionModal.action === "Approved" ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <XCircle className="size-5 text-destructive" />
                )}
                <h3 className="text-lg font-bold text-foreground">
                  {actionModal.action === "Approved" ? "Approve Leave Request" : "Reject Leave Request"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setActionModal(null);
                  setReviewerNote("");
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="rounded-lg bg-muted/40 p-3.5 text-xs space-y-1.5">
              <p>
                <span className="font-semibold text-foreground">Employee:</span>{" "}
                {actionModal.leave.employee_name} ({actionModal.leave.employee_email})
              </p>
              <p>
                <span className="font-semibold text-foreground">Type & Duration:</span>{" "}
                {actionModal.leave.leave_type} · {calculateDays(actionModal.leave.start_date, actionModal.leave.end_date)} days (
                {formatDate(actionModal.leave.start_date)} to {formatDate(actionModal.leave.end_date)})
              </p>
              <p>
                <span className="font-semibold text-foreground">Reason:</span>{" "}
                {actionModal.leave.reason || "—"}
              </p>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reviewer Note / Feedback (Optional)
              </span>
              <textarea
                rows={3}
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                placeholder={
                  actionModal.action === "Approved"
                    ? "e.g., Approved. Please coordinate handover before leaving."
                    : "e.g., Rejected due to critical project deadline. Please reschedule."
                }
                className="mt-1.5 w-full rounded-lg border border-input bg-background p-3 text-xs outline-none focus:border-primary resize-none"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActionModal(null);
                  setReviewerNote("");
                }}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: actionModal.leave.id,
                    status: actionModal.action,
                    reviewerNote,
                  })
                }
                className={`rounded-lg px-5 py-2 text-xs font-bold text-white transition-all disabled:opacity-50 ${
                  actionModal.action === "Approved"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                    : "bg-destructive hover:bg-destructive/90 shadow-sm"
                }`}
              >
                {updateMutation.isPending ? "Processing…" : `Confirm ${actionModal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW LEAVE DETAILS MODAL */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {getInitials(selectedLeave.employee_name, selectedLeave.employee_email)}
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {selectedLeave.employee_name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedLeave.employee_email} · {selectedLeave.employee_staff_section === "bi_staff" ? "BI Staff" : "IT Team"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLeave(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Leave Type</span>
                <p className="mt-0.5 font-bold text-foreground">{selectedLeave.leave_type}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Total Duration</span>
                <p className="mt-0.5 font-bold text-foreground font-mono">
                  {calculateDays(selectedLeave.start_date, selectedLeave.end_date)} Days
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Start Date</span>
                <p className="mt-0.5 font-semibold text-foreground font-mono">
                  {formatDate(selectedLeave.start_date)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">End Date</span>
                <p className="mt-0.5 font-semibold text-foreground font-mono">
                  {formatDate(selectedLeave.end_date)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/50 p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reason for Leave
              </span>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {selectedLeave.reason || "No reason specified."}
              </p>
            </div>

            {selectedLeave.reviewer_note && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Reviewer Notes
                </span>
                <p className="text-xs text-foreground whitespace-pre-wrap">
                  {selectedLeave.reviewer_note}
                </p>
                {selectedLeave.reviewed_at && (
                  <p className="text-[10px] text-muted-foreground pt-1">
                    Reviewed on {formatDate(selectedLeave.reviewed_at)}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  selectedLeave.status === "Approved"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : selectedLeave.status === "Pending"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-destructive/15 text-destructive"
                }`}
              >
                Status: {selectedLeave.status}
              </span>

              <div className="flex items-center gap-2">
                {selectedLeave.status === "Pending" && (
                  <>
                    <button
                      onClick={() => {
                        const leave = selectedLeave;
                        setSelectedLeave(null);
                        setActionModal({ leave, action: "Approved" });
                      }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const leave = selectedLeave;
                        setSelectedLeave(null);
                        setActionModal({ leave, action: "Rejected" });
                      }}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-white hover:bg-destructive/90"
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedLeave(null)}
                  className="rounded-lg border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
