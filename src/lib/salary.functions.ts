import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLocalSupabaseClient } from "@/integrations/supabase/local-db";

function isSchemaCacheOrTableMissingError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  const code = error.code || "";
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("not found") ||
    code === "PGRST205" ||
    code === "42P01"
  );
}

export interface SalaryStructure {
  id: string;
  user_id: string;
  monthly_gross: number;
  basic_pay: number;
  hra: number;
  special_allowance: number;
  conveyance: number;
  pf_deduction: number;
  pt_deduction: number;
  tds_deduction: number;
  other_deductions: number;
  custom_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Payslip {
  id: string;
  user_id: string;
  employee_name?: string;
  employee_code?: string;
  department?: string;
  job_title?: string;
  month_year: string; // "YYYY-MM"
  payout_date: string;
  total_working_days: number;
  present_days: number;
  paid_days: number;
  lop_days: number;
  lop_deduction: number;
  basic_pay: number;
  hra: number;
  conveyance: number;
  special_allowance: number;
  bonus: number;
  gross_earnings: number;
  pf_deduction: number;
  pt_deduction: number;
  tds_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  net_salary_words: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  pan: string | null;
  uan: string | null;
  pf_number: string | null;
  status: string; // "Generated" | "Paid"
  is_locked: boolean;
  generated_by: string | null;
  generated_at: string;
  created_at: string;
}

export interface AdminPayrollEmployeeItem {
  id: string;
  userId: string;
  user_id: string;
  name: string;
  fullName: string;
  full_name: string;
  email: string;
  employeeCode: string;
  employee_id: string;
  department: string;
  jobTitle: string;
  job_title: string;
  staffSection: string;
  staff_section: string;
  monthlyGross: number;
  monthly_gross: number;
  structure: SalaryStructure | null;
  salaryStructure: SalaryStructure | null;
  lopDays: number;
  lop_days: number;
  lopDeduction: number;
  calculated_lop_deduction: number;
  total_days: number;
  paid_days: number;
  calculated_net: number;
  projectedNetSalary: number;
  payslip: Payslip | null;
  isGenerated: boolean;
  bankName: string | null;
  bankAccount: string | null;
}

export function numberToIndianWords(num: number): string {
  if (num === 0) return "Rupees Zero Only";
  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function inWords(n: number): string {
    if (n === 0) return "";
    let str = "";
    if (n > 99) {
      str += a[Math.floor(n / 100)] + "Hundred ";
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : " ");
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  }

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  let output = "";
  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const remainder = integerPart % 1000;

  if (crore > 0) output += inWords(crore) + "Crore ";
  if (lakh > 0) output += inWords(lakh) + "Lakh ";
  if (thousand > 0) output += inWords(thousand) + "Thousand ";
  if (remainder > 0) output += inWords(remainder);

  output = "Rupees " + output.trim();
  if (decimalPart > 0) {
    output += " and " + inWords(decimalPart).trim() + "Paise";
  }
  return output + " Only";
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculates approved LOP (Loss of Pay) days for a given user in a month_year period ("YYYY-MM").
 */
async function calculateMonthLopDays(
  supabase: any,
  userId: string,
  monthYear: string,
): Promise<number> {
  const [yearStr, monthStr] = monthYear.split("-");
  const year = parseInt(yearStr || "2026", 10);
  const month = parseInt(monthStr || "8", 10);
  const totalDays = getDaysInMonth(year, month);

  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const endOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;

  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("start_date, end_date, leave_type, status")
    .eq("user_id", userId)
    .eq("status", "Approved");

  if (!leaves || leaves.length === 0) return 0;

  let lopDays = 0;
  for (const l of leaves) {
    // Only consider unpaid / LOP leaves or check overlap with this month
    const lStart = l.start_date;
    const lEnd = l.end_date;

    const overlapStart = lStart > startOfMonth ? lStart : startOfMonth;
    const overlapEnd = lEnd < endOfMonth ? lEnd : endOfMonth;

    if (overlapStart <= overlapEnd) {
      const diffDays =
        Math.round(
          (new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 86400000,
        ) + 1;
      
      const typeLower = (l.leave_type || "").toLowerCase();
      if (typeLower.includes("unpaid") || typeLower.includes("lop") || typeLower.includes("loss of pay")) {
        lopDays += diffDays;
      }
    }
  }

  return lopDays;
}

// ==========================================
// 1. Employee: Get My Salary Overview & Payslips
// ==========================================

export const getMySalaryOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Get profile & user metadata
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    // 2. Get salary structure
    let salaryStructure: any = null;
    try {
      const { data, error } = await supabase
        .from("employee_salary_structures")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error && isSchemaCacheOrTableMissingError(error)) {
        const local = createLocalSupabaseClient();
        const res = await local.from("employee_salary_structures").select("*").eq("user_id", userId).maybeSingle();
        salaryStructure = res.data;
      } else {
        salaryStructure = data;
      }
    } catch {
      const local = createLocalSupabaseClient();
      const res = await local.from("employee_salary_structures").select("*").eq("user_id", userId).maybeSingle();
      salaryStructure = res.data;
    }

    // 3. Get all generated payslips for this employee
    let payslips: any[] = [];
    try {
      const { data, error } = await supabase
        .from("payslips")
        .select("*")
        .eq("user_id", userId)
        .order("month_year", { ascending: false });
      if (error && isSchemaCacheOrTableMissingError(error)) {
        const local = createLocalSupabaseClient();
        const res = await local.from("payslips").select("*").eq("user_id", userId).order("month_year", { ascending: false });
        payslips = res.data || [];
      } else {
        payslips = data || [];
      }
    } catch {
      const local = createLocalSupabaseClient();
      const res = await local.from("payslips").select("*").eq("user_id", userId).order("month_year", { ascending: false });
      payslips = res.data || [];
    }

    // 4. Default fallback salary structure if none configured yet
    const fallbackGross = profile?.salary ? Number(profile.salary) : 50000;
    const activeStructure: SalaryStructure = salaryStructure || {
      id: "default-struct",
      user_id: userId,
      monthly_gross: fallbackGross,
      basic_pay: Math.round(fallbackGross * 0.5),
      hra: Math.round(fallbackGross * 0.25),
      conveyance: Math.round(fallbackGross * 0.05),
      special_allowance: Math.round(fallbackGross * 0.2),
      pf_deduction: 1800,
      pt_deduction: 200,
      tds_deduction: 0,
      other_deductions: 0,
      custom_notes: "Standard Base Configuration",
    };

    return {
      profile,
      salaryStructure: activeStructure,
      payslips: (payslips || []) as Payslip[],
    };
  });

export const getMyPayslips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      year: z.string().optional(),
      month: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    let query = supabase
      .from("payslips")
      .select("*")
      .eq("user_id", userId)
      .order("month_year", { ascending: false });

    if (data.year && data.year !== "all") {
      query = query.gte("month_year", `${data.year}-01`).lte("month_year", `${data.year}-12`);
    }

    if (data.month && data.month !== "all" && data.year && data.year !== "all") {
      query = query.eq("month_year", `${data.year}-${data.month.padStart(2, "0")}`);
    }

    let payslips: any[] = [];
    try {
      const { data: pData, error } = await query;
      if (error && isSchemaCacheOrTableMissingError(error)) {
        const local = createLocalSupabaseClient();
        let lQuery = local.from("payslips").select("*").eq("user_id", userId).order("month_year", { ascending: false });
        if (data.year && data.year !== "all") {
          lQuery = lQuery.gte("month_year", `${data.year}-01`).lte("month_year", `${data.year}-12`);
        }
        if (data.month && data.month !== "all" && data.year && data.year !== "all") {
          lQuery = lQuery.eq("month_year", `${data.year}-${data.month.padStart(2, "0")}`);
        }
        const res = await lQuery;
        payslips = res.data || [];
      } else if (error) {
        throw new Error(error.message);
      } else {
        payslips = pData || [];
      }
    } catch (e: any) {
      if (isSchemaCacheOrTableMissingError(e)) {
        const local = createLocalSupabaseClient();
        const res = await local.from("payslips").select("*").eq("user_id", userId).order("month_year", { ascending: false });
        payslips = res.data || [];
      } else {
        throw e;
      }
    }

    return (payslips || []) as Payslip[];
  });

export const getPayslipById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }): Promise<Payslip> => {
    const { supabase, userId } = context;

    let payslip: any = null;
    try {
      const { data: pData, error } = await supabase
        .from("payslips")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (error && isSchemaCacheOrTableMissingError(error)) {
        const local = createLocalSupabaseClient();
        const res = await local.from("payslips").select("*").eq("id", data.id).maybeSingle();
        payslip = res.data;
      } else if (error) {
        throw new Error(error.message);
      } else {
        payslip = pData;
      }
    } catch (e: any) {
      if (isSchemaCacheOrTableMissingError(e)) {
        const local = createLocalSupabaseClient();
        const res = await local.from("payslips").select("*").eq("id", data.id).maybeSingle();
        payslip = res.data;
      } else {
        throw e;
      }
    }

    if (!payslip) throw new Error("Payslip record not found.");

    // Check permission: must be own payslip or admin
    if (payslip.user_id !== userId) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (roleRow?.role !== "admin" && roleRow?.role !== "sub_admin") {
        throw new Error("Access denied to this payslip.");
      }
    }

    // Enrich with employee profile details
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, employee_id, department, job_title")
      .eq("id", payslip.user_id)
      .maybeSingle();

    return {
      ...payslip,
      employee_name: profile?.full_name || "Employee",
      employee_code: profile?.employee_id || payslip.user_id.slice(-8).toUpperCase(),
      department: profile?.department || "Business Intelligence",
      job_title: profile?.job_title || "Analyst",
    } as Payslip;
  });

// ==========================================
// 2. Admin: Overview, Structure Config & Generation
// ==========================================

export const getAdminPayrollOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      monthYear: z.string().optional(),
      month_year: z.string().optional(),
      staffSection: z.string().optional(),
      staff_section: z.string().optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const targetMonthYear = data.monthYear || data.month_year || "2026-08";

    // 1. Get all employees
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });

    // 2. Get all salary structures
    let structures: any[] = [];
    try {
      const { data, error } = await supabase
        .from("employee_salary_structures")
        .select("*");
      if (error && isSchemaCacheOrTableMissingError(error)) {
        const local = createLocalSupabaseClient();
        const res = await local.from("employee_salary_structures").select("*");
        structures = res.data || [];
      } else {
        structures = data || [];
      }
    } catch {
      const local = createLocalSupabaseClient();
      const res = await local.from("employee_salary_structures").select("*");
      structures = res.data || [];
    }

    const structMap = new Map<string, SalaryStructure>();
    for (const s of structures || []) {
      structMap.set(s.user_id, s);
    }

    // 3. Get all payslips for targetMonthYear
    let monthPayslips: any[] = [];
    try {
      const { data, error } = await supabase
        .from("payslips")
        .select("*")
        .eq("month_year", targetMonthYear);
      if (error && isSchemaCacheOrTableMissingError(error)) {
        const local = createLocalSupabaseClient();
        const res = await local.from("payslips").select("*").eq("month_year", targetMonthYear);
        monthPayslips = res.data || [];
      } else {
        monthPayslips = data || [];
      }
    } catch {
      const local = createLocalSupabaseClient();
      const res = await local.from("payslips").select("*").eq("month_year", targetMonthYear);
      monthPayslips = res.data || [];
    }

    const payslipMap = new Map<string, Payslip>();
    for (const p of monthPayslips || []) {
      payslipMap.set(p.user_id, p);
    }

    // 4. Calculate overview items per employee
    const [yearStr, monthStr] = targetMonthYear.split("-");
    const year = parseInt(yearStr || "2026", 10);
    const month = parseInt(monthStr || "8", 10);
    const totalDaysInMonth = getDaysInMonth(year, month);

    const result: AdminPayrollEmployeeItem[] = [];

    for (const p of profiles || []) {
      // Filter out admin users from payroll list if needed
      const struct = structMap.get(p.id) || null;
      const monthlyGross = struct?.monthly_gross ?? (p.salary ? Number(p.salary) : 50000);
      const existingPayslip = payslipMap.get(p.id) || null;

      // Calculate LOP days for this month
      const lopDays = existingPayslip
        ? existingPayslip.lop_days
        : await calculateMonthLopDays(supabase, p.id, targetMonthYear);

      const perDaySalary = monthlyGross / totalDaysInMonth;
      const lopDeduction = existingPayslip
        ? existingPayslip.lop_deduction
        : Math.round(perDaySalary * lopDays * 100) / 100;

      const pfDeduction = struct?.pf_deduction ?? 1800;
      const ptDeduction = struct?.pt_deduction ?? 200;
      const tdsDeduction = struct?.tds_deduction ?? 0;
      const otherDeductions = struct?.other_deductions ?? 0;

      const totalDeductions = lopDeduction + pfDeduction + ptDeduction + tdsDeduction + otherDeductions;
      const projectedNet = Math.max(0, monthlyGross - totalDeductions);

      result.push({
        id: p.id,
        userId: p.id,
        user_id: p.id,
        name: p.full_name || p.email || "Employee",
        fullName: p.full_name || p.email || "Employee",
        full_name: p.full_name || p.email || "Employee",
        email: p.email || "",
        employeeCode: p.employee_id || p.id.slice(-8).toUpperCase(),
        employee_id: p.employee_id || p.id.slice(-8).toUpperCase(),
        department: p.department || "Business Intelligence",
        jobTitle: p.job_title || "Staff",
        job_title: p.job_title || "Staff",
        staffSection: p.staff_section || "IT Team",
        staff_section: p.staff_section || "IT Team",
        monthlyGross,
        monthly_gross: monthlyGross,
        structure: struct,
        salaryStructure: struct,
        lopDays,
        lop_days: lopDays,
        lopDeduction,
        calculated_lop_deduction: lopDeduction,
        total_days: totalDaysInMonth,
        paid_days: Math.max(0, totalDaysInMonth - lopDays),
        calculated_net: projectedNet,
        projectedNetSalary: existingPayslip ? existingPayslip.net_salary : projectedNet,
        payslip: existingPayslip,
        isGenerated: Boolean(existingPayslip),
        bankName: p.bank_name || null,
        bankAccount: p.bank_account || null,
      });
    }

    // Filter by staff section if provided
    let filtered = result;
    if (data.staffSection && data.staffSection !== "all") {
      const target = data.staffSection.toUpperCase();
      filtered = filtered.filter((item) => {
        const sec = (item.staffSection || item.staff_section || "").toUpperCase();
        return sec.includes(target) || item.staffSection === data.staffSection;
      });
    }

    // Filter by search term
    if (data.search && data.search.trim()) {
      const q = data.search.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.fullName.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q) ||
          item.employeeCode.toLowerCase().includes(q) ||
          item.department.toLowerCase().includes(q),
      );
    }

    const totalPayroll = filtered.reduce((sum, item) => sum + item.monthlyGross, 0);
    const totalLopDeductions = filtered.reduce((sum, item) => sum + item.lopDeduction, 0);
    const totalNetDisbursed = filtered.reduce((sum, item) => sum + item.projectedNetSalary, 0);
    const generatedCount = filtered.filter((item) => item.isGenerated).length;
    const pendingCount = filtered.length - generatedCount;

    const summary = {
      total_employees: filtered.length,
      total_gross: totalPayroll,
      total_lop_deductions: totalLopDeductions,
      total_net_payout: totalNetDisbursed,
      generated_payslips_count: generatedCount,
      pending_count: pendingCount,
    };

    return {
      monthYear: targetMonthYear,
      month_year: targetMonthYear,
      employees: filtered,
      summary,
      kpis: {
        totalEmployees: filtered.length,
        totalPayroll,
        totalNetDisbursed,
        generatedCount,
        pendingCount,
        totalDaysInMonth,
      },
    };
  });

export const updateEmployeeSalaryStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      userId: z.string().optional(),
      user_id: z.string().optional(),
      monthlyGross: z.number().min(0).optional(),
      monthly_gross: z.number().min(0).optional(),
      basicPay: z.number().min(0).optional(),
      basic_pay: z.number().min(0).optional(),
      hra: z.number().min(0).optional(),
      specialAllowance: z.number().min(0).optional(),
      special_allowance: z.number().min(0).optional(),
      conveyance: z.number().min(0).optional(),
      pfDeduction: z.number().min(0).optional(),
      pf_deduction: z.number().min(0).optional(),
      ptDeduction: z.number().min(0).optional(),
      pt_deduction: z.number().min(0).optional(),
      tdsDeduction: z.number().min(0).optional(),
      tds_deduction: z.number().min(0).optional(),
      otherDeductions: z.number().min(0).optional(),
      other_deductions: z.number().min(0).optional(),
      customNotes: z.string().optional(),
      custom_notes: z.string().optional(),
      // Banking details update
      bankName: z.string().optional(),
      bank_name: z.string().optional(),
      bankAccount: z.string().optional(),
      bank_account: z.string().optional(),
      bankIfsc: z.string().optional(),
      bank_ifsc: z.string().optional(),
      pan: z.string().optional(),
      uan: z.string().optional(),
      pfNumber: z.string().optional(),
      pf_number: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const targetUserId = data.userId || data.user_id;
    if (!targetUserId) throw new Error("User ID is required.");

    const gross = data.monthlyGross ?? data.monthly_gross ?? 50000;
    const basic = data.basicPay ?? data.basic_pay ?? Math.round(gross * 0.5);
    const hra = data.hra ?? Math.round(gross * 0.25);
    const conveyance = data.conveyance ?? Math.round(gross * 0.05);
    const special = data.specialAllowance ?? data.special_allowance ?? Math.max(0, gross - basic - hra - conveyance);
    const pf = data.pfDeduction ?? data.pf_deduction ?? 1800;
    const pt = data.ptDeduction ?? data.pt_deduction ?? 200;
    const tds = data.tdsDeduction ?? data.tds_deduction ?? 0;
    const other = data.otherDeductions ?? data.other_deductions ?? 0;
    const notes = data.customNotes || data.custom_notes || null;

    // 1. Upsert salary structure
    const payload = {
      user_id: targetUserId,
      monthly_gross: gross,
      basic_pay: basic,
      hra: hra,
      conveyance: conveyance,
      special_allowance: special,
      pf_deduction: pf,
      pt_deduction: pt,
      tds_deduction: tds,
      other_deductions: other,
      custom_notes: notes,
      updated_at: new Date().toISOString(),
    };

    let structError: any = null;
    try {
      const res = await supabase.from("employee_salary_structures").upsert(
        payload,
        { onConflict: "user_id" },
      );
      structError = res.error;
      if (structError && isSchemaCacheOrTableMissingError(structError)) {
        const local = createLocalSupabaseClient();
        await local.from("employee_salary_structures").upsert(payload, { onConflict: "user_id" });
        structError = null;
      }
    } catch (e: any) {
      if (isSchemaCacheOrTableMissingError(e)) {
        const local = createLocalSupabaseClient();
        await local.from("employee_salary_structures").upsert(payload, { onConflict: "user_id" });
        structError = null;
      } else {
        structError = e;
      }
    }

    if (structError) throw new Error(structError.message);

    // 2. Update banking & tax details in profiles table
    const profileUpdates: Record<string, any> = {
      salary: gross,
      updated_at: new Date().toISOString(),
    };
    const bankName = data.bankName || data.bank_name;
    const bankAccount = data.bankAccount || data.bank_account;
    const bankIfsc = data.bankIfsc || data.bank_ifsc;
    const pan = data.pan;
    const uan = data.uan;
    const pfNumber = data.pfNumber || data.pf_number;

    if (bankName !== undefined) profileUpdates.bank_name = bankName;
    if (bankAccount !== undefined) profileUpdates.bank_account = bankAccount;
    if (bankIfsc !== undefined) profileUpdates.bank_ifsc = bankIfsc;
    if (pan !== undefined) profileUpdates.pan = pan;
    if (uan !== undefined) profileUpdates.uan = uan;
    if (pfNumber !== undefined) profileUpdates.pf_number = pfNumber;

    await supabase.from("profiles").update(profileUpdates).eq("id", targetUserId);

    return {
      ok: true,
      message: "Employee salary structure & banking details updated successfully.",
    };
  });

export const generateEmployeePayslip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      userId: z.string().optional(),
      user_id: z.string().optional(),
      monthYear: z.string().optional(),
      month_year: z.string().optional(),
      bonus: z.number().default(0),
      customLopDays: z.number().optional(),
      custom_lop_days: z.number().optional(),
      payoutDate: z.string().optional(),
      payout_date: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId: adminUserId } = context;
    const targetUserId = data.userId || data.user_id;
    const targetMonthYear = data.monthYear || data.month_year;
    if (!targetUserId || !targetMonthYear) {
      throw new Error("User ID and Month-Year are required.");
    }

    // Check if payslip already exists and is locked (Immutability Enforcement)
    let existing: any = null;
    try {
      const { data: exData, error } = await supabase
        .from("payslips")
        .select("id, is_locked, month_year")
        .eq("user_id", targetUserId)
        .eq("month_year", targetMonthYear)
        .maybeSingle();
      if (error && isSchemaCacheOrTableMissingError(error)) {
        const local = createLocalSupabaseClient();
        const res = await local.from("payslips").select("id, is_locked, month_year").eq("user_id", targetUserId).eq("month_year", targetMonthYear).maybeSingle();
        existing = res.data;
      } else {
        existing = exData;
      }
    } catch {
      const local = createLocalSupabaseClient();
      const res = await local.from("payslips").select("id, is_locked, month_year").eq("user_id", targetUserId).eq("month_year", targetMonthYear).maybeSingle();
      existing = res.data;
    }

    if (existing?.is_locked) {
      return {
        ok: false,
        message: `Payslip for ${targetMonthYear} is already generated and locked. Immutable records cannot be modified.`,
      };
    }

    // 1. Get employee profile & banking details
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!profile) throw new Error("Employee profile not found.");

    // 2. Get salary structure
    let salaryStructure: any = null;
    try {
      const { data: sData, error } = await supabase
        .from("employee_salary_structures")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (error && isSchemaCacheOrTableMissingError(error)) {
        const local = createLocalSupabaseClient();
        const res = await local.from("employee_salary_structures").select("*").eq("user_id", targetUserId).maybeSingle();
        salaryStructure = res.data;
      } else {
        salaryStructure = sData;
      }
    } catch {
      const local = createLocalSupabaseClient();
      const res = await local.from("employee_salary_structures").select("*").eq("user_id", targetUserId).maybeSingle();
      salaryStructure = res.data;
    }

    const gross = salaryStructure?.monthly_gross ?? (profile.salary ? Number(profile.salary) : 50000);
    const basic = salaryStructure?.basic_pay ?? Math.round(gross * 0.5);
    const hra = salaryStructure?.hra ?? Math.round(gross * 0.25);
    const conveyance = salaryStructure?.conveyance ?? Math.round(gross * 0.05);
    const special = salaryStructure?.special_allowance ?? Math.max(0, gross - basic - hra - conveyance);
    const bonus = data.bonus || 0;
    const totalGrossEarnings = basic + hra + conveyance + special + bonus;

    // 3. Working days and LOP calculation
    const [yearStr, monthStr] = targetMonthYear.split("-");
    const year = parseInt(yearStr || "2026", 10);
    const month = parseInt(monthStr || "8", 10);
    const totalWorkingDays = getDaysInMonth(year, month);

    const lopDays =
      (data.customLopDays !== undefined ? data.customLopDays : data.custom_lop_days) ??
      (await calculateMonthLopDays(supabase, targetUserId, targetMonthYear));

    const perDayRate = gross / totalWorkingDays;
    const lopDeduction = Math.round(perDayRate * lopDays * 100) / 100;
    const paidDays = Math.max(0, totalWorkingDays - lopDays);
    const presentDays = paidDays;

    const pfDeduction = salaryStructure?.pf_deduction ?? 1800;
    const ptDeduction = salaryStructure?.pt_deduction ?? 200;
    const tdsDeduction = salaryStructure?.tds_deduction ?? 0;
    const otherDeductions = salaryStructure?.other_deductions ?? 0;

    const totalDeductions = lopDeduction + pfDeduction + ptDeduction + tdsDeduction + otherDeductions;
    const netSalary = Math.max(0, Math.round((totalGrossEarnings - totalDeductions) * 100) / 100);
    const netSalaryWords = numberToIndianWords(netSalary);

    const payoutDate =
      data.payoutDate ||
      data.payout_date ||
      `${year}-${String(month).padStart(2, "0")}-${String(totalWorkingDays).padStart(2, "0")}`;

    const payslipId = crypto.randomUUID();
    const newPayslip: any = {
      id: payslipId,
      user_id: targetUserId,
      month_year: targetMonthYear,
      payout_date: payoutDate,
      total_working_days: totalWorkingDays,
      present_days: presentDays,
      paid_days: paidDays,
      lop_days: lopDays,
      lop_deduction: lopDeduction,
      basic_pay: basic,
      hra: hra,
      conveyance: conveyance,
      special_allowance: special,
      bonus: bonus,
      gross_earnings: totalGrossEarnings,
      pf_deduction: pfDeduction,
      pt_deduction: ptDeduction,
      tds_deduction: tdsDeduction,
      other_deductions: otherDeductions,
      total_deductions: totalDeductions,
      net_salary: netSalary,
      net_salary_words: netSalaryWords,
      bank_name: profile.bank_name || null,
      bank_account: profile.bank_account || null,
      bank_ifsc: profile.bank_ifsc || null,
      pan: profile.pan || null,
      uan: profile.uan || null,
      pf_number: profile.pf_number || null,
      status: "Generated",
      is_locked: true,
      generated_by: adminUserId,
      generated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      const { error: insertError } = await supabase.from("payslips").insert(newPayslip);
      if (insertError && isSchemaCacheOrTableMissingError(insertError)) {
        const local = createLocalSupabaseClient();
        await local.from("payslips").insert(newPayslip);
      } else if (insertError) {
        throw new Error(insertError.message);
      }
    } catch (e: any) {
      if (isSchemaCacheOrTableMissingError(e)) {
        const local = createLocalSupabaseClient();
        await local.from("payslips").insert(newPayslip);
      } else {
        throw e;
      }
    }

    const enrichedPayslip: Payslip = {
      ...newPayslip,
      employee_name: profile.full_name || "Employee",
      employee_code: profile.employee_id || targetUserId.slice(-8).toUpperCase(),
      department: profile.department || "Business Intelligence",
      job_title: profile.job_title || "Staff",
    };

    return {
      ok: true,
      message: `Payslip for ${profile.full_name} (${targetMonthYear}) successfully generated & locked.`,
      payslip: enrichedPayslip,
    };
  });

export const bulkGenerateMonthPayslips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      monthYear: z.string().optional(),
      month_year: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId: adminUserId } = context;
    const targetMonthYear = data.monthYear || data.month_year || "2026-08";

    // 1. Get all employees
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true);

    // 2. Get existing payslips for this month
    let existingPayslips: any[] = [];
    try {
      const { data: exData, error } = await supabase
        .from("payslips")
        .select("user_id")
        .eq("month_year", targetMonthYear);
      if (error && isSchemaCacheOrTableMissingError(error)) {
        const local = createLocalSupabaseClient();
        const res = await local.from("payslips").select("user_id").eq("month_year", targetMonthYear);
        existingPayslips = res.data || [];
      } else {
        existingPayslips = exData || [];
      }
    } catch {
      const local = createLocalSupabaseClient();
      const res = await local.from("payslips").select("user_id").eq("month_year", targetMonthYear);
      existingPayslips = res.data || [];
    }

    const generatedSet = new Set((existingPayslips || []).map((p) => p.user_id));

    let createdCount = 0;
    for (const p of profiles || []) {
      if (generatedSet.has(p.id)) continue; // Skip already generated

      try {
        await generateEmployeePayslip({
          data: {
            userId: p.id,
            monthYear: targetMonthYear,
          },
        });
        createdCount++;
      } catch (e) {
        console.warn(`Bulk payslip generation failed for user ${p.id}:`, e);
      }
    }

    return {
      ok: true,
      createdCount,
      message: `Successfully generated and locked ${createdCount} payslips for ${targetMonthYear}.`,
    };
  });
