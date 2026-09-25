import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  DollarSign,
  Calendar,
  Users,
  Building2,
  Calculator,
  CheckCircle2,
  Lock,
  Search,
  FileText,
  Printer,
  Download,
  Settings2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { AppShell, Panel } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getAdminPayrollOverview,
  updateEmployeeSalaryStructure,
  generateEmployeePayslip,
  bulkGenerateMonthPayslips,
  type SalaryStructure,
  type Payslip,
} from "@/lib/salary.functions";
import { PayslipViewModal } from "@/components/payslip-view";

export const Route = createFileRoute("/_authenticated/admin/salary")({
  head: () => ({
    meta: [
      { title: "Salary & Payroll Management — BI Tracker" },
      {
        name: "description",
        content: "Manage employee compensation, calculate LOP deductions, and generate immutable monthly payslips.",
      },
      { property: "og:title", content: "Salary & Payroll Management — BI Tracker" },
    ],
  }),
  component: AdminSalaryPage,
});

function AdminSalaryPage() {
  const qc = useQueryClient();

  const getPayrollOverviewFn = useServerFn(getAdminPayrollOverview);
  const updateStructureFn = useServerFn(updateEmployeeSalaryStructure);
  const generatePayslipFn = useServerFn(generateEmployeePayslip);
  const bulkGenerateFn = useServerFn(bulkGenerateMonthPayslips);

  // Month selector default to current month YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<"ALL" | "IT" | "BI">("ALL");

  // Modal states
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isPayslipOpen, setIsPayslipOpen] = useState(false);

  // Configure salary modal state
  const [editEmployee, setEditEmployee] = useState<{
    id: string;
    name: string;
    code?: string;
    structure: Partial<SalaryStructure>;
  } | null>(null);

  const [structureForm, setStructureForm] = useState({
    monthly_gross: 50000,
    basic_pay: 25000,
    hra: 10000,
    special_allowance: 10000,
    conveyance: 5000,
    pf_deduction: 1800,
    pt_deduction: 200,
    tds_deduction: 0,
    other_deductions: 0,
    custom_notes: "",
  });

  const payrollQuery = useQuery({
    queryKey: ["admin-payroll", selectedMonth],
    queryFn: () => getPayrollOverviewFn({ data: { month_year: selectedMonth } }),
  });

  // Month options (past 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const curr = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(curr.getFullYear(), curr.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      options.push({ value, label });
    }
    return options;
  }, []);

  const formatINR = (val: number | undefined | null) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Mutations
  const updateStructureMutation = useMutation({
    mutationFn: async () => {
      if (!editEmployee) return;
      return await updateStructureFn({
        data: {
          user_id: editEmployee.id,
          ...structureForm,
        },
      });
    },
    onSuccess: () => {
      toast.success("Salary structure updated successfully");
      qc.invalidateQueries({ queryKey: ["admin-payroll"] });
      setEditEmployee(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update salary structure");
    },
  });

  const generatePayslipMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await generatePayslipFn({
        data: {
          user_id: userId,
          month_year: selectedMonth,
        },
      });
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || "Payslip generated and locked successfully");
      qc.invalidateQueries({ queryKey: ["admin-payroll"] });
      if (data?.payslip && data?.payslip?.id) {
        setSelectedPayslip(data.payslip as Payslip);
        setIsPayslipOpen(true);
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to generate payslip");
    },
  });

  const bulkGenerateMutation = useMutation({
    mutationFn: async () => {
      return await bulkGenerateFn({
        data: {
          month_year: selectedMonth,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["admin-payroll"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to run bulk payroll generation");
    },
  });

  const openConfigModal = (emp: any) => {
    const s = emp.structure || emp.salaryStructure || {};
    const gross = s.monthly_gross || emp.monthlyGross || 50000;
    setEditEmployee({
      id: emp.id || emp.userId,
      name: emp.full_name || emp.fullName || emp.name,
      code: emp.employee_id || emp.employeeCode || "EMP-000",
      structure: s,
    });
    setStructureForm({
      monthly_gross: gross,
      basic_pay: s.basic_pay || Math.round(gross * 0.5),
      hra: s.hra || Math.round(gross * 0.2),
      special_allowance: s.special_allowance || Math.round(gross * 0.2),
      conveyance: s.conveyance || Math.round(gross * 0.1),
      pf_deduction: s.pf_deduction || 1800,
      pt_deduction: s.pt_deduction || 200,
      tds_deduction: s.tds_deduction || 0,
      other_deductions: s.other_deductions || 0,
      custom_notes: s.custom_notes || "",
    });
  };

  const handleGrossChange = (newGross: number) => {
    setStructureForm({
      ...structureForm,
      monthly_gross: newGross,
      basic_pay: Math.round(newGross * 0.5),
      hra: Math.round(newGross * 0.2),
      special_allowance: Math.round(newGross * 0.2),
      conveyance: Math.round(newGross * 0.1),
    });
  };

  // Count by workforce section
  const { allCount, itCount, biCount } = useMemo(() => {
    const list = payrollQuery.data?.employees || [];
    let it = 0;
    let bi = 0;
    for (const e of list) {
      const sec = (e.staff_section || e.staffSection || "").toUpperCase();
      if (sec.includes("IT")) it++;
      if (sec.includes("BI")) bi++;
    }
    return { allCount: list.length, itCount: it, biCount: bi };
  }, [payrollQuery.data?.employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    const list = payrollQuery.data?.employees || [];
    return list.filter((emp) => {
      // Section filter
      const sec = (emp.staff_section || emp.staffSection || "").toUpperCase();
      if (selectedSection === "IT" && !sec.includes("IT")) return false;
      if (selectedSection === "BI" && !sec.includes("BI")) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (emp.full_name || emp.fullName || emp.name || "").toLowerCase().includes(q);
        const matchEmail = (emp.email || "").toLowerCase().includes(q);
        const matchCode = (emp.employee_id || emp.employeeCode || "").toLowerCase().includes(q);
        const matchDept = (emp.department || "").toLowerCase().includes(q);
        return matchName || matchEmail || matchCode || matchDept;
      }
      return true;
    });
  }, [payrollQuery.data?.employees, selectedSection, searchQuery]);

  const exportSalaryListToCSV = () => {
    const list = filteredEmployees;
    if (!list || list.length === 0) {
      toast.error("No employee salary records available to export for the current selection.");
      return;
    }

    const headers = [
      "Employee ID",
      "Full Name",
      "Email",
      "Section",
      "Department",
      "Designation",
      "Payroll Month",
      "Total Month Days",
      "Paid Days",
      "LOP Days",
      "Monthly Gross (INR)",
      "LOP Deduction (INR)",
      "Basic Pay (INR)",
      "HRA (INR)",
      "Special Allowance (INR)",
      "Conveyance Allowance (INR)",
      "Gross Earnings (INR)",
      "Employee PF (INR)",
      "Professional Tax PT (INR)",
      "TDS / Tax (INR)",
      "Other Deductions (INR)",
      "Total Deductions (INR)",
      "Net Payable Salary (INR)",
      "Payslip Status",
      "Bank Name",
      "Bank Account No"
    ];

    const rows = list.map((emp) => {
      const hasSlip = !!emp.payslip;
      const s = emp.structure || emp.salaryStructure || {};
      const gross = hasSlip ? emp.payslip.gross_earnings : (s.monthly_gross || emp.monthlyGross || 0);
      const lopDays = hasSlip ? emp.payslip.lop_days : (emp.lop_days ?? emp.lopDays ?? 0);
      const lopDed = hasSlip ? emp.payslip.lop_deduction : (emp.calculated_lop_deduction ?? emp.lopDeduction ?? 0);
      const basic = hasSlip ? emp.payslip.basic_pay : (s.basic_pay ?? Math.round(gross * 0.5));
      const hra = hasSlip ? emp.payslip.hra : (s.hra ?? Math.round(gross * 0.2));
      const special = hasSlip ? emp.payslip.special_allowance : (s.special_allowance ?? Math.round(gross * 0.2));
      const conveyance = hasSlip ? emp.payslip.conveyance : (s.conveyance ?? Math.round(gross * 0.1));
      const grossEarn = hasSlip ? emp.payslip.gross_earnings : gross;
      const pf = hasSlip ? emp.payslip.pf_deduction : (s.pf_deduction ?? 1800);
      const pt = hasSlip ? emp.payslip.pt_deduction : (s.pt_deduction ?? 200);
      const tds = hasSlip ? emp.payslip.tds_deduction : (s.tds_deduction ?? 0);
      const otherDed = hasSlip ? emp.payslip.other_deductions : (s.other_deductions ?? 0);
      const totalDed = hasSlip ? emp.payslip.total_deductions : (lopDed + pf + pt + tds + otherDed);
      const net = hasSlip ? emp.payslip.net_salary : Math.max(0, grossEarn - totalDed);
      const status = hasSlip ? "GENERATED" : "UNPROCESSED";
      const totalDays = emp.total_days || 31;
      const paidDays = emp.paid_days !== undefined ? emp.paid_days : Math.max(0, totalDays - lopDays);

      return [
        emp.employee_id || emp.employeeCode || "N/A",
        emp.full_name || emp.fullName || emp.name || "Employee",
        emp.email || "",
        emp.staff_section || emp.staffSection || "IT Team",
        emp.department || "Business Intelligence",
        emp.job_title || emp.jobTitle || "Staff",
        selectedMonth,
        totalDays,
        paidDays,
        lopDays,
        gross,
        lopDed,
        basic,
        hra,
        special,
        conveyance,
        grossEarn,
        pf,
        pt,
        tds,
        otherDed,
        totalDed,
        net,
        status,
        emp.bankName || emp.bank_name || "",
        emp.bankAccount || emp.bank_account || ""
      ].map((val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(",");
    });

    const csvContent = "\uFEFF" + [headers.map((h) => `"${h}"`).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const secTag = selectedSection === "ALL" ? "All_Workforce" : `${selectedSection}_Staff`;
    link.download = `Salary_Payroll_List_${selectedMonth}_${secTag}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} salary records to CSV successfully`);
  };

  const summary = payrollQuery.data?.summary || {
    total_employees: 0,
    total_gross: 0,
    total_lop_deductions: 0,
    total_net_payout: 0,
    generated_payslips_count: 0,
  };

  return (
    <AppShell title="Salary & Payroll Management">
      <div className="space-y-6">
        {/* Header & Month Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-primary" />
              Salary & Payroll Management
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Configure employee compensation structures, auto-deduct LOP for unpaid leaves, and generate immutable monthly payslips.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-xl shadow-sm text-xs">
              <Calendar className="size-4 text-primary" />
              <span className="text-muted-foreground font-medium">Payroll Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-foreground font-bold outline-none cursor-pointer text-sm"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-popover text-popover-foreground">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={exportSalaryListToCSV}
              className="h-10 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300 font-medium"
            >
              <Download className="size-3.5" />
              Export Salary List
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => payrollQuery.refetch()}
              disabled={payrollQuery.isFetching}
              className="h-10 text-xs gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${payrollQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => bulkGenerateMutation.mutate()}
              disabled={bulkGenerateMutation.isPending}
              className="h-10 text-xs gap-1.5 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Sparkles className="size-3.5" />
              {bulkGenerateMutation.isPending ? "Generating..." : "Generate Month Payslips"}
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Monthly Gross</span>
              <Building2 className="size-4 text-primary" />
            </div>
            <div className="text-2xl font-black font-mono text-foreground mt-2">
              {formatINR(summary.total_gross)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Base compensation for {summary.total_employees} active employees
            </p>
          </div>

          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-medium">
              <span>Total LOP Deductions</span>
              <Calculator className="size-4" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-2">
              {formatINR(summary.total_lop_deductions)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Calculated from approved unpaid leave requests
            </p>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-primary font-semibold">
              <span>Total Net Disbursal</span>
              <CheckCircle2 className="size-4" />
            </div>
            <div className="text-2xl font-black font-mono text-primary mt-2">
              {formatINR(summary.total_net_payout)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Net payable amount after all statutory deductions
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Generated Payslips</span>
              <FileText className="size-4 text-muted-foreground/70" />
            </div>
            <div className="text-2xl font-black font-mono text-foreground mt-2">
              {summary.generated_payslips_count} / {summary.total_employees}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {summary.generated_payslips_count === summary.total_employees
                ? "All payslips generated & locked"
                : `${summary.total_employees - summary.generated_payslips_count} pending generation`}
            </p>
          </div>
        </div>

        {/* Filter and Employee Table Panel */}
        <Panel className="space-y-4">
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
                <button
                  onClick={() => setSelectedSection("ALL")}
                  className={`rounded-md px-3 py-1 font-medium transition-all ${
                    selectedSection === "ALL"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Workforce ({allCount || summary.total_employees})
                </button>
                <button
                  onClick={() => setSelectedSection("IT")}
                  className={`rounded-md px-3 py-1 font-medium transition-all ${
                    selectedSection === "IT"
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  IT Team ({itCount})
                </button>
                <button
                  onClick={() => setSelectedSection("BI")}
                  className={`rounded-md px-3 py-1 font-medium transition-all ${
                    selectedSection === "BI"
                      ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  BI Staff ({biCount})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-[200px] sm:min-w-[240px]">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search employee by name, ID..."
                  className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:border-ring"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={exportSalaryListToCSV}
                title="Export current salary table to CSV"
                className="h-8 text-xs gap-1.5 border-border bg-card hover:bg-muted text-foreground font-medium"
              >
                <Download className="size-3.5 text-primary" />
                <span className="hidden sm:inline">Export</span> CSV
              </Button>
            </div>
          </div>

          {/* Table */}
          {payrollQuery.isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading payroll records and leave calculations...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <Users className="mx-auto size-7 text-muted-foreground/60" />
              <p className="font-semibold text-foreground">No employees found.</p>
              <p>No active employees matched your search and filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground uppercase text-[10px] tracking-wider bg-muted/20">
                    <th className="p-3">Employee</th>
                    <th className="p-3">Monthly Gross</th>
                    <th className="p-3">Attendance & LOP</th>
                    <th className="p-3">Deductions (PF/PT/TDS)</th>
                    <th className="p-3">Net Pay</th>
                    <th className="p-3">Payslip Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredEmployees.map((emp) => {
                    const hasPayslip = !!emp.payslip;
                    const netPay = hasPayslip
                      ? emp.payslip.net_salary
                      : (emp.calculated_net ?? emp.projectedNetSalary ?? 0);
                    const gross = hasPayslip
                      ? emp.payslip.gross_earnings
                      : (emp.structure?.monthly_gross ?? emp.salaryStructure?.monthly_gross ?? emp.monthlyGross ?? emp.monthly_gross ?? 0);

                    const pf = emp.structure?.pf_deduction ?? emp.salaryStructure?.pf_deduction ?? 0;
                    const pt = emp.structure?.pt_deduction ?? emp.salaryStructure?.pt_deduction ?? 0;
                    const tds = emp.structure?.tds_deduction ?? emp.salaryStructure?.tds_deduction ?? 0;
                    const lopCount = emp.lop_days ?? emp.lopDays ?? 0;
                    const lopDeduct = emp.calculated_lop_deduction ?? emp.lopDeduction ?? 0;
                    const empKey = emp.id || emp.userId || emp.employeeCode || Math.random();

                    return (
                      <tr
                        key={empKey}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        {/* Employee Name & Role */}
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs">
                              {(emp.full_name || emp.fullName || emp.name || "E").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground text-xs">
                                  {emp.full_name || emp.fullName || emp.name || "Staff Member"}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    (emp.staff_section || emp.staffSection || "").toUpperCase().includes("IT")
                                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                                      : "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20"
                                  }`}
                                >
                                  {emp.staff_section || emp.staffSection || "IT Team"}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {emp.employee_id || emp.employeeCode || "EMP-000"} • {emp.job_title || emp.jobTitle || emp.department || "Staff"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Gross Pay */}
                        <td className="p-3 font-mono font-medium text-foreground">
                          {formatINR(gross)}
                        </td>

                        {/* LOP & Attendance */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground">
                              {emp.paid_days ?? 0} / {emp.total_days ?? 30}d
                            </span>
                            {lopCount > 0 ? (
                              <Badge
                                variant="outline"
                                className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] px-1.5 py-0.2"
                              >
                                -{lopCount}d LOP ({formatINR(lopDeduct)})
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                Full Attendance
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Deductions */}
                        <td className="p-3 text-[11px] text-muted-foreground">
                          <div className="space-y-0.5 font-mono">
                            <div>PF: {formatINR(pf)}</div>
                            <div>PT: {formatINR(pt)} | TDS: {formatINR(tds)}</div>
                          </div>
                        </td>

                        {/* Net Pay */}
                        <td className="p-3 font-mono font-bold text-sm text-primary">
                          {formatINR(netPay)}
                        </td>

                        {/* Status */}
                        <td className="p-3">
                          {hasPayslip ? (
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0.5"
                              >
                                <CheckCircle2 className="size-3 mr-1" />
                                Generated
                              </Badge>
                              {emp.payslip.is_locked && (
                                <span title="Locked Snapshot - Immutable">
                                  <Lock className="size-3 text-muted-foreground" />
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0.5 text-muted-foreground"
                            >
                              <Clock className="size-3 mr-1" />
                              Unprocessed
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasPayslip ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPayslip({
                                    ...emp.payslip,
                                    employee_name: emp.payslip.employee_name || emp.full_name || emp.fullName || emp.name,
                                    employee_code: emp.payslip.employee_code || emp.employee_id || emp.employeeCode,
                                    department: emp.payslip.department || emp.department,
                                    job_title: emp.payslip.job_title || emp.job_title || emp.jobTitle,
                                  });
                                  setIsPayslipOpen(true);
                                }}
                                className="h-7 px-2 text-[11px] gap-1"
                              >
                                <FileText className="size-3 text-primary" />
                                View Slip
                              </Button>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => generatePayslipMutation.mutate(emp.id || emp.userId)}
                                disabled={generatePayslipMutation.isPending}
                                className="h-7 px-2 text-[11px] gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                <Sparkles className="size-3" />
                                Generate
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openConfigModal(emp)}
                              className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <Settings2 className="size-3" />
                              Structure
                            </Button>
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

      {/* Salary Structure Configuration Modal */}
      {editEmployee && (
        <Dialog open={!!editEmployee} onOpenChange={(open) => !open && setEditEmployee(null)}>
          <DialogContent className="max-w-xl bg-background text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                <Settings2 className="size-5 text-primary" />
                Configure Salary Structure: {editEmployee.name} ({editEmployee.code || "EMP"})
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Update base earnings components and statutory deductions. Once a monthly payslip is generated, its historical record remains immutable.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Gross Salary Quick Input */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80">
                <label className="block font-semibold text-foreground uppercase tracking-wider text-[10px] mb-1">
                  Monthly Total Gross Salary (INR)
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-primary">₹</span>
                  <input
                    type="number"
                    value={structureForm.monthly_gross}
                    onChange={(e) => handleGrossChange(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-bold font-mono outline-none focus:border-ring"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Updating gross will automatically distribute 50% Basic, 20% HRA, 20% Special Allowance, and 10% Conveyance. You can also customize each below.
                </p>
              </div>

              {/* Earnings Breakdown */}
              <div className="space-y-2">
                <div className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[10px]">
                  Earnings Components
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground mb-1">Basic Pay (₹)</label>
                    <input
                      type="number"
                      value={structureForm.basic_pay}
                      onChange={(e) =>
                        setStructureForm({ ...structureForm, basic_pay: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">HRA (₹)</label>
                    <input
                      type="number"
                      value={structureForm.hra}
                      onChange={(e) =>
                        setStructureForm({ ...structureForm, hra: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Special Allowance (₹)</label>
                    <input
                      type="number"
                      value={structureForm.special_allowance}
                      onChange={(e) =>
                        setStructureForm({
                          ...structureForm,
                          special_allowance: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Conveyance Allowance (₹)</label>
                    <input
                      type="number"
                      value={structureForm.conveyance}
                      onChange={(e) =>
                        setStructureForm({ ...structureForm, conveyance: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-ring"
                    />
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider text-[10px]">
                  Statutory & Other Deductions
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground mb-1">Employee PF (₹)</label>
                    <input
                      type="number"
                      value={structureForm.pf_deduction}
                      onChange={(e) =>
                        setStructureForm({
                          ...structureForm,
                          pf_deduction: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Professional Tax PT (₹)</label>
                    <input
                      type="number"
                      value={structureForm.pt_deduction}
                      onChange={(e) =>
                        setStructureForm({
                          ...structureForm,
                          pt_deduction: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Tax Deducted TDS (₹)</label>
                    <input
                      type="number"
                      value={structureForm.tds_deduction}
                      onChange={(e) =>
                        setStructureForm({
                          ...structureForm,
                          tds_deduction: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Other Deductions / Advance (₹)</label>
                    <input
                      type="number"
                      value={structureForm.other_deductions}
                      onChange={(e) =>
                        setStructureForm({
                          ...structureForm,
                          other_deductions: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-ring"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Notes */}
              <div>
                <label className="block text-muted-foreground mb-1">Custom Notes / Appraisal Reference</label>
                <input
                  type="text"
                  value={structureForm.custom_notes}
                  onChange={(e) =>
                    setStructureForm({ ...structureForm, custom_notes: e.target.value })
                  }
                  placeholder="e.g. Revised after Q2 2026 performance appraisal"
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditEmployee(null)}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => updateStructureMutation.mutate()}
                disabled={updateStructureMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {updateStructureMutation.isPending ? "Saving..." : "Save Salary Structure"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Payslip View Modal */}
      <PayslipViewModal
        payslip={selectedPayslip}
        open={isPayslipOpen}
        onOpenChange={setIsPayslipOpen}
      />
    </AppShell>
  );
}
