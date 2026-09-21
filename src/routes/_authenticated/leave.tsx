import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  MessageSquareQuote,
  RotateCcw,
  Search,
  Sparkles,
  Timer,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import {
  cancelLeave,
  getMyLeaves,
  requestLeave,
  LeaveRequest,
  LEAVE_TIME_SLOT_OPTIONS,
  formatSlotDuration,
  timeToMinutes,
} from "@/lib/leave.functions";
import { LEAVE_TYPES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({
    meta: [
      { title: "Leave Requests — BI Tracker" },
      {
        name: "description",
        content: "Request time off, track approval status and review your leave history.",
      },
      { property: "og:title", content: "Leave Requests — BI Tracker" },
      {
        property: "og:description",
        content: "Submit and follow up on your BI Tracker leave requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeavePage,
});

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function days(a: string, b: string) {
  return Math.max(
    1,
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1,
  );
}

function getLeaveTypeBadge(type: string) {
  const norm = (type || "").toLowerCase();
  if (norm.includes("casual")) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400";
  }
  if (norm.includes("sick")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }
  if (norm.includes("emergency")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  if (norm.includes("permission")) {
    return "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400";
  }
  if (norm.includes("wfh") || norm.includes("home")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  return "border-border bg-secondary/70 text-foreground";
}

const PRESET_TIME_SLOTS = [
  { label: "09:00 AM – 11:00 AM", from: "09:00 AM", to: "11:00 AM", tag: "Morning (2h)" },
  { label: "11:00 AM – 01:00 PM", from: "11:00 AM", to: "01:00 PM", tag: "Midday (2h)" },
  { label: "02:00 PM – 04:00 PM", from: "02:00 PM", to: "04:00 PM", tag: "Afternoon (2h)" },
  { label: "04:00 PM – 06:00 PM", from: "04:00 PM", to: "06:00 PM", tag: "Late (2h)" },
  { label: "06:00 PM – 09:00 PM", from: "06:00 PM", to: "09:00 PM", tag: "Evening (3h)" },
];

function LeavePage() {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(getMyLeaves);
  const createFn = useServerFn(requestLeave);
  const cancelFn = useServerFn(cancelLeave);

  const [form, setForm] = useState({
    startDate: todayIso(),
    endDate: todayIso(),
    leaveType: LEAVE_TYPES[0] as string,
    reason: "",
  });

  const [includeTimeSlot, setIncludeTimeSlot] = useState(false);
  const [fromTime, setFromTime] = useState<string>("09:00 AM");
  const [toTime, setToTime] = useState<string>("11:00 AM");

  // Filter and Pagination State for Leave History
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedLeaveType, setSelectedLeaveType] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedStatus("all");
    setSelectedLeaveType("all");
    setFilterStartDate("");
    setFilterEndDate("");
    setCurrentPage(1);
  };

  const isFiltered = Boolean(
    searchQuery.trim() ||
      selectedStatus !== "all" ||
      selectedLeaveType !== "all" ||
      filterStartDate ||
      filterEndDate
  );

  const handleLeaveTypeChange = (newType: string) => {
    const isPermission = newType.toLowerCase().includes("permission");
    setForm((prev) => ({
      ...prev,
      leaveType: newType,
      endDate: isPermission ? prev.startDate : prev.endDate,
    }));
    if (isPermission) {
      setIncludeTimeSlot(true);
    }
  };

  const handleFromTimeChange = (newFrom: string) => {
    setFromTime(newFrom);
    const fromMin = timeToMinutes(newFrom);
    const toMin = timeToMinutes(toTime);
    if (toMin <= fromMin) {
      // Find a slot 1 hour or 30 mins ahead
      const nextSlot = LEAVE_TIME_SLOT_OPTIONS.find((t) => timeToMinutes(t) > fromMin);
      if (nextSlot) {
        const twoHoursLater = LEAVE_TIME_SLOT_OPTIONS.find((t) => timeToMinutes(t) >= fromMin + 120);
        setToTime(twoHoursLater || nextSlot);
      }
    }
  };

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });
  const { data: leaves } = useQuery<LeaveRequest[]>({
    queryKey: ["my-leaves"],
    queryFn: () => listFn(),
    refetchInterval: 8000,
  });

  const filteredLeaves = useMemo(() => {
    if (!leaves) return [];
    return leaves.filter((l: LeaveRequest) => {
      // Status Filter
      if (selectedStatus !== "all" && l.status !== selectedStatus) {
        return false;
      }

      // Leave Type Filter
      if (selectedLeaveType !== "all") {
        const typeNorm = (l.leave_type || "").toLowerCase();
        const filterNorm = selectedLeaveType.toLowerCase();
        if (filterNorm === "casual leave") {
          if (!typeNorm.includes("casual")) return false;
        } else if (filterNorm === "wfh") {
          if (!typeNorm.includes("wfh") && !typeNorm.includes("home")) return false;
        } else if (filterNorm === "sick") {
          if (!typeNorm.includes("sick")) return false;
        } else if (filterNorm === "permission") {
          if (!typeNorm.includes("permission")) return false;
        } else if (filterNorm === "emergency") {
          if (!typeNorm.includes("emergency")) return false;
        } else {
          if (typeNorm !== filterNorm) return false;
        }
      }

      // Date Filters
      if (filterStartDate && l.end_date < filterStartDate) {
        return false;
      }
      if (filterEndDate && l.start_date > filterEndDate) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchReason = (l.clean_reason || l.reason || "").toLowerCase().includes(q);
        const matchType = (l.leave_type || "").toLowerCase().includes(q);
        const matchTime = (l.time_slot || "").toLowerCase().includes(q);
        const matchStatus = (l.status || "").toLowerCase().includes(q);
        const matchDates = `${l.start_date} ${l.end_date}`.includes(q);
        if (!matchReason && !matchType && !matchTime && !matchStatus && !matchDates) {
          return false;
        }
      }

      return true;
    });
  }, [leaves, selectedStatus, selectedLeaveType, filterStartDate, filterEndDate, searchQuery]);

  const totalItems = filteredLeaves.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (validCurrentPage - 1) * pageSize;
  const paginatedLeaves = useMemo(() => {
    return filteredLeaves.slice(startIdx, startIdx + pageSize);
  }, [filteredLeaves, startIdx, pageSize]);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...form,
          ...(includeTimeSlot ? { fromTime, toTime } : {}),
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setForm({ ...form, reason: "" });
      qc.invalidateQueries({ queryKey: ["my-leaves"] });
    },
    onError: () => toast.error("Could not submit that request."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["my-leaves"] });
    },
    onError: () => toast.error("Could not cancel request."),
  });

  if (!session) return null;

  const pending = (leaves ?? []).filter((l: LeaveRequest) => l.status === "Pending").length;
  const approved = (leaves ?? []).filter((l: LeaveRequest) => l.status === "Approved").length;
  const rejected = (leaves ?? []).filter((l: LeaveRequest) => l.status === "Rejected").length;
  const totalDays = (leaves ?? []).reduce((s: number, l: LeaveRequest) => s + days(l.start_date, l.end_date), 0);

  return (
    <AppShell session={session}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Leave Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Request time off, track management decisions and view feedback.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total Requests" value={leaves?.length ?? 0} />
        <Stat label="Pending" value={pending} />
        <Stat label="Approved" value={approved} />
        <Stat label="Total Days" value={totalDays} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Panel title="New Leave Request" hint="Your manager will review and approve or reject.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Start Date
                </span>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  End Date
                </span>
                <input
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Leave Type
              </span>
              <select
                value={form.leaveType}
                onChange={(e) => handleLeaveTypeChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            {/* Time Slot (9:00 AM – 9:00 PM) */}
            <div className="rounded-xl border border-border/80 bg-accent/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Clock className="size-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground">
                      Time Slot (Permission)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Available timing: 9:00 AM to 9:00 PM
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTimeSlot}
                    onChange={(e) => setIncludeTimeSlot(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                  />
                  <span className="text-xs font-medium text-foreground">
                    {includeTimeSlot ? "Enabled" : "Add Time Slot"}
                  </span>
                </label>
              </div>

              {includeTimeSlot && (
                <div className="space-y-3 pt-1 border-t border-border/50 animate-in fade-in duration-200">
                  {/* Quick Pick Presets */}
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Quick Pick Timings (9:00 AM – 9:00 PM)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_TIME_SLOTS.map((slot) => {
                        const isSelected = fromTime === slot.from && toTime === slot.to;
                        return (
                          <button
                            type="button"
                            key={slot.label}
                            onClick={() => {
                              setFromTime(slot.from);
                              setToTime(slot.to);
                            }}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                                : "bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                            }`}
                          >
                            {slot.from} → {slot.to}
                            <span className="ml-1 opacity-75">({slot.tag})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* From and To dropdowns */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        From Timing (Start)
                      </span>
                      <select
                        value={fromTime}
                        onChange={(e) => handleFromTimeChange(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-mono outline-none transition-colors focus:border-primary"
                      >
                        {LEAVE_TIME_SLOT_OPTIONS.slice(0, -1).map((t) => (
                          <option key={`from-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        To Timing (End)
                      </span>
                      <select
                        value={toTime}
                        onChange={(e) => setToTime(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-mono outline-none transition-colors focus:border-primary"
                      >
                        {LEAVE_TIME_SLOT_OPTIONS.filter(
                          (t) => timeToMinutes(t) > timeToMinutes(fromTime)
                        ).map((t) => (
                          <option key={`to-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Duration summary chip */}
                  <div className="flex items-center justify-between rounded-lg bg-background/80 px-2.5 py-1.5 border border-border/60 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Timer className="size-3.5 text-primary" />
                      <span>Permission Duration:</span>
                    </div>
                    <span className="font-bold font-mono text-primary">
                      {formatSlotDuration(fromTime, toTime)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Reason / Note
              </span>
              <textarea
                rows={3}
                maxLength={500}
                placeholder="Optional details or context for the team..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              />
            </label>

            <button
              type="submit"
              disabled={create.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              <CalendarDays className="size-4" />
              {create.isPending ? "Submitting..." : "Submit Leave Request"}
            </button>
          </form>
        </Panel>

        <Panel
          title="Leave History & Decisions"
          hint="Search, filter by date, type, and status, and view real-time decisions."
        >
          {/* SEARCH & FILTERS CONTROLS */}
          <div className="mb-4 space-y-2.5 rounded-xl border border-border/70 bg-accent/20 p-3">
            {/* Row 1: Search input + Status Badges */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search reason, timing, type, date..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-input bg-background pl-8 pr-7 py-1.5 text-xs outline-none transition-colors focus:border-primary placeholder:text-muted-foreground/70"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Status Filter Badges */}
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 p-1 text-xs">
                {[
                  { id: "all", label: "All", count: leaves?.length ?? 0 },
                  { id: "Pending", label: "Pending", count: pending },
                  { id: "Approved", label: "Approved", count: approved },
                  { id: "Rejected", label: "Rejected", count: rejected },
                ].map((st) => {
                  const isActive = selectedStatus === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setSelectedStatus(st.id);
                        setCurrentPage(1);
                      }}
                      className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      }`}
                    >
                      <span>{st.label}</span>
                      <span
                        className={`rounded-full px-1 text-[9px] ${
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {st.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Leave Type Filter + Date From/To + Reset button */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
              {/* Type Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">Type:</span>
                <select
                  value={selectedLeaveType}
                  onChange={(e) => {
                    setSelectedLeaveType(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-primary"
                >
                  <option value="all">All Types</option>
                  {LEAVE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">From:</span>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => {
                    setFilterStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-primary"
                />
              </div>

              {/* Date To */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">To:</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => {
                    setFilterEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-primary"
                />
              </div>

              {/* Reset button */}
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="ml-auto flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                >
                  <RotateCcw className="size-3" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* LEAVE CARDS OR EMPTY STATES */}
          {filteredLeaves.length > 0 ? (
            <div className="space-y-3">
              {paginatedLeaves.map((l: LeaveRequest) => {
                const duration = days(l.start_date, l.end_date);
                return (
                  <div
                    key={l.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-border"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-foreground text-sm">
                          {l.start_date}
                          {l.end_date !== l.start_date ? ` → ${l.end_date}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          ({duration} {duration === 1 ? "day" : "days"})
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getLeaveTypeBadge(
                            l.leave_type
                          )}`}
                        >
                          {l.leave_type}
                        </span>
                        {l.time_slot && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                            <Clock className="size-3" />
                            {l.time_slot}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {l.status === "Approved" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            Approved
                          </span>
                        ) : l.status === "Rejected" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                            <XCircle className="size-3" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Clock className="size-3" />
                            Pending Review
                          </span>
                        )}

                        {l.status === "Pending" && (
                          <button
                            onClick={() => remove.mutate(l.id)}
                            title="Cancel Request"
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {(l.clean_reason || l.reason) && (
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground/80 font-medium">Reason:</strong>{" "}
                        {l.clean_reason || l.reason}
                      </p>
                    )}

                    {/* Admin Reviewer Notes & Feedback */}
                    {l.reviewer_note && (
                      <div className="mt-1 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
                        <MessageSquareQuote className="size-4 shrink-0 text-primary mt-0.5" />
                        <div>
                          <p className="font-semibold text-primary">Manager Feedback:</p>
                          <p className="text-muted-foreground mt-0.5">{l.reviewer_note}</p>
                          {l.reviewed_at && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              Reviewed on {new Date(l.reviewed_at).toLocaleDateString()} at {new Date(l.reviewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* PAGINATION FOOTER */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                <div>
                  Showing <span className="font-bold text-foreground">{startIdx + 1}</span>–
                  <span className="font-bold text-foreground">
                    {Math.min(startIdx + pageSize, totalItems)}
                  </span>{" "}
                  of <span className="font-bold text-foreground">{totalItems}</span> requests
                  {isFiltered && <span className="text-[11px] text-primary ml-1">(filtered)</span>}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={validCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="size-3.5" />
                      Prev
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`size-7 rounded-md text-xs font-semibold transition-all ${
                          validCurrentPage === p
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={validCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : isFiltered ? (
            <div className="py-10 text-center text-sm text-muted-foreground space-y-2">
              <Filter className="mx-auto size-7 text-muted-foreground/60" />
              <p className="font-semibold text-foreground">No matching leave requests found</p>
              <p className="text-xs">Try clearing or adjusting your search query, type, or date range.</p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors mt-1"
              >
                <RotateCcw className="size-3" />
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No leave requests submitted yet.
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
