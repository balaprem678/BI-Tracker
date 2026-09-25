import * as React from "react";
import {
  Printer,
  Download,
  Building2,
  CheckCircle2,
  Calendar,
  CreditCard,
  User,
  FileText,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { type Payslip, numberToIndianWords } from "@/lib/salary.functions";

interface PayslipViewModalProps {
  payslip: Payslip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function generatePrintablePayslipHtml(payslip: Payslip): string {
  const formatCurrency = (val: number | undefined | null) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatMonthName = (monthYear?: string) => {
    if (!monthYear) return "Current Month";
    const parts = monthYear.split("-");
    if (parts.length < 2) return monthYear;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return monthYear;
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const formatDateSafe = (dStr?: string) => {
    if (!dStr) return new Date().toLocaleDateString("en-IN");
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? new Date().toLocaleDateString("en-IN") : d.toLocaleDateString("en-IN");
  };

  const payslipRef = payslip.id
    ? String(payslip.id).slice(0, 8).toUpperCase()
    : payslip.user_id
    ? String(payslip.user_id).slice(-8).toUpperCase()
    : "REF-001";

  const netWords = payslip.net_salary_words || numberToIndianWords(payslip.net_salary || 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Salary Slip - ${payslip.employee_name || "Employee"} - ${formatMonthName(payslip.month_year)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.45;
    }
    .sheet {
      width: 100%;
      max-width: 780px;
      margin: 0 auto;
      border: 1.5px solid #0f172a;
      padding: 20px 24px;
      background: #ffffff;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .company-logo {
      width: 44px;
      height: 44px;
      background: #0284c7;
      color: #ffffff;
      font-weight: 900;
      font-size: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }
    .company-name {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 10.5px;
      color: #475569;
      margin: 0 0 2px 0;
    }
    .company-address {
      font-size: 9.5px;
      color: #64748b;
      margin: 0;
    }
    .payslip-badge {
      display: inline-block;
      background: #f0fdf4;
      border: 1px solid #86efac;
      color: #166534;
      font-weight: 700;
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .month-banner {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #0284c7;
      padding: 8px 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .banner-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .banner-meta {
      font-size: 10px;
      color: #475569;
      font-weight: 500;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      border: 1px solid #cbd5e1;
    }
    .grid-table th {
      background: #f8fafc;
      color: #0f172a;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    .grid-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      font-size: 10.5px;
      vertical-align: middle;
    }
    .grid-table .lbl {
      color: #475569;
      font-weight: 600;
      width: 20%;
      background: #fafafa;
    }
    .grid-table .val {
      color: #0f172a;
      font-weight: 600;
      width: 30%;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .text-right {
      text-align: right;
    }
    .breakdown-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      border: 1.5px solid #94a3b8;
    }
    .breakdown-table th {
      padding: 7px 10px;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #94a3b8;
    }
    .th-earn {
      background: #ecfdf5;
      color: #065f46;
      border-bottom: 2px solid #059669 !important;
    }
    .th-ded {
      background: #fff1f2;
      color: #9f1239;
      border-bottom: 2px solid #e11d48 !important;
    }
    .breakdown-table td {
      padding: 5px 10px;
      border-left: 1px solid #cbd5e1;
      border-right: 1px solid #cbd5e1;
      border-bottom: 1px solid #f1f5f9;
      font-size: 10.5px;
    }
    .breakdown-table tr:nth-child(even) td {
      background: #fafafa;
    }
    .total-row td {
      font-weight: 800 !important;
      border-top: 1.5px solid #94a3b8 !important;
      border-bottom: 1.5px solid #94a3b8 !important;
      background: #f1f5f9 !important;
      color: #0f172a;
      padding: 6px 10px !important;
    }
    .net-box {
      background: #f0fdf4;
      border: 1.5px solid #4ade80;
      border-radius: 6px;
      padding: 10px 16px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .net-label {
      font-size: 11px;
      font-weight: 800;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .net-words {
      font-size: 10.5px;
      color: #334155;
      font-style: italic;
      margin-top: 2px;
    }
    .net-amount {
      font-size: 22px;
      font-weight: 900;
      color: #15803d;
      font-family: ui-monospace, SFMono-Regular, monospace;
      text-align: right;
    }
    .net-disbursal-note {
      font-size: 9.5px;
      color: #166534;
      font-weight: 600;
      text-align: right;
    }
    .signature-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 24px;
      margin-bottom: 10px;
    }
    .signature-table td {
      width: 50%;
      vertical-align: bottom;
      padding: 0 16px;
    }
    .sig-line {
      border-top: 1px solid #475569;
      padding-top: 4px;
      text-align: center;
      font-size: 10px;
      color: #334155;
      font-weight: 600;
    }
    .footer-note {
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      font-size: 9px;
      color: #64748b;
      text-align: center;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <table class="header-table">
      <tr>
        <td style="width: 56px; vertical-align: top;">
          <div class="company-logo">BI</div>
        </td>
        <td style="vertical-align: top;">
          <h1 class="company-name">BI Tracker Enterprise</h1>
          <div class="company-sub">Business Intelligence & Technology Solutions Pvt. Ltd.</div>
          <div class="company-address">Corporate HQ: Tech Park, Sector 4, Bangalore, Karnataka - 560100 • payroll@bi-tracker.io</div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div class="payslip-badge">✓ Official Payslip</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Status: <strong>${payslip.status || "Generated"}</strong></div>
        </td>
      </tr>
    </table>

    <div class="month-banner">
      <div>
        <span class="banner-title">Salary Slip for the Month of ${formatMonthName(payslip.month_year)}</span>
      </div>
      <div class="banner-meta">
        Payslip Ref: <strong class="font-mono">${payslipRef}</strong> &nbsp;|&nbsp; Pay Date: <strong>${formatDateSafe(payslip.payout_date)}</strong>
      </div>
    </div>

    <table class="grid-table">
      <thead>
        <tr>
          <th colspan="4">Employee Particulars &amp; Bank Settlement</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="lbl">Employee Name</td>
          <td class="val">${payslip.employee_name || "Employee"}</td>
          <td class="lbl">Employee ID / Code</td>
          <td class="val font-mono">${payslip.employee_code || "EMP-000"}</td>
        </tr>
        <tr>
          <td class="lbl">Department</td>
          <td class="val">${payslip.department || "Business Intelligence"}</td>
          <td class="lbl">Designation</td>
          <td class="val">${payslip.job_title || "Staff"}</td>
        </tr>
        <tr>
          <td class="lbl">Income Tax PAN</td>
          <td class="val font-mono">${payslip.pan || "XXXXX0000X"}</td>
          <td class="lbl">PF UAN / No.</td>
          <td class="val font-mono">${payslip.uan || payslip.pf_number || "N/A"}</td>
        </tr>
        <tr>
          <td class="lbl">Bank Name</td>
          <td class="val">${payslip.bank_name || "Corporate Bank"}</td>
          <td class="lbl">Bank Account No.</td>
          <td class="val font-mono">${payslip.bank_account || "•••• •••• 9840"}</td>
        </tr>
        <tr>
          <td class="lbl">Bank IFSC Code</td>
          <td class="val font-mono">${payslip.bank_ifsc || "HDFC0001234"}</td>
          <td class="lbl">Payment Method</td>
          <td class="val">Bank Transfer / NEFT</td>
        </tr>
        <tr>
          <td class="lbl">Total Month Days</td>
          <td class="val font-mono">${payslip.total_working_days || 30} Days</td>
          <td class="lbl">Paid / Payable Days</td>
          <td class="val font-mono" style="color: #15803d;">${payslip.paid_days || 30} Days (LOP: ${payslip.lop_days || 0}d)</td>
        </tr>
      </tbody>
    </table>

    <table class="breakdown-table">
      <thead>
        <tr>
          <th class="th-earn" style="text-align: left; width: 35%;">Earnings</th>
          <th class="th-earn text-right" style="width: 15%;">Amount (INR)</th>
          <th class="th-ded" style="text-align: left; width: 35%;">Deductions</th>
          <th class="th-ded text-right" style="width: 15%;">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Basic Pay</td>
          <td class="text-right font-mono">${formatCurrency(payslip.basic_pay)}</td>
          <td>Loss of Pay (LOP) (${payslip.lop_days || 0} days)</td>
          <td class="text-right font-mono" style="color: #b91c1c;">${formatCurrency(payslip.lop_deduction)}</td>
        </tr>
        <tr>
          <td>House Rent Allowance (HRA)</td>
          <td class="text-right font-mono">${formatCurrency(payslip.hra)}</td>
          <td>Provident Fund (Employee PF)</td>
          <td class="text-right font-mono">${formatCurrency(payslip.pf_deduction)}</td>
        </tr>
        <tr>
          <td>Special Allowance</td>
          <td class="text-right font-mono">${formatCurrency(payslip.special_allowance)}</td>
          <td>Professional Tax (PT)</td>
          <td class="text-right font-mono">${formatCurrency(payslip.pt_deduction)}</td>
        </tr>
        <tr>
          <td>Conveyance Allowance</td>
          <td class="text-right font-mono">${formatCurrency(payslip.conveyance)}</td>
          <td>Tax Deducted at Source (TDS)</td>
          <td class="text-right font-mono">${formatCurrency(payslip.tds_deduction)}</td>
        </tr>
        <tr>
          <td>Performance Bonus / Incentive</td>
          <td class="text-right font-mono">${formatCurrency(payslip.bonus)}</td>
          <td>Other Deductions / Advances</td>
          <td class="text-right font-mono">${formatCurrency(payslip.other_deductions)}</td>
        </tr>
        <tr class="total-row">
          <td>Total Gross Earnings</td>
          <td class="text-right font-mono" style="color: #0369a1;">${formatCurrency(payslip.gross_earnings)}</td>
          <td>Total Deductions</td>
          <td class="text-right font-mono" style="color: #b91c1c;">${formatCurrency(payslip.total_deductions)}</td>
        </tr>
      </tbody>
    </table>

    <div class="net-box">
      <div>
        <div class="net-label">Net Salary Disbursed</div>
        <div class="net-words">Amount in Words: <strong>${netWords}</strong></div>
      </div>
      <div>
        <div class="net-amount">${formatCurrency(payslip.net_salary)}</div>
        <div class="net-disbursal-note">Credited to Account on ${formatDateSafe(payslip.payout_date)}</div>
      </div>
    </div>

    <table class="signature-table">
      <tr>
        <td>
          <div style="height: 36px;"></div>
          <div class="sig-line">Employee Signature</div>
        </td>
        <td>
          <div style="height: 36px; text-align: center; font-size: 11px; font-weight: 700; color: #0284c7;">
            BI Tracker Enterprise HR
          </div>
          <div class="sig-line">Authorized Signatory (HR / Accounts)</div>
        </td>
      </tr>
    </table>

    <div class="footer-note">
      * Note: This is an official system-generated electronic payslip and does not require a physical wet signature. Generated on ${formatDateSafe(payslip.generated_at)} by BI Tracker Enterprise Payroll Engine. For questions or discrepancies, please contact hr-payroll@bi-tracker.io within 7 days of payout.
    </div>
  </div>
</body>
</html>`;
}

export function PayslipViewModal({
  payslip,
  open,
  onOpenChange,
}: PayslipViewModalProps) {
  if (!payslip) return null;

  const formatCurrency = (val: number | undefined | null) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatMonthName = (monthYear?: string) => {
    if (!monthYear) return "Current Month";
    const parts = monthYear.split("-");
    if (parts.length < 2) return monthYear;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return monthYear;
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const formatDateSafe = (dStr?: string) => {
    if (!dStr) return new Date().toLocaleDateString("en-IN");
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? new Date().toLocaleDateString("en-IN") : d.toLocaleDateString("en-IN");
  };

  const handlePrint = () => {
    const html = generatePrintablePayslipHtml(payslip);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 250);
  };

  const payslipRef = payslip.id
    ? String(payslip.id).slice(0, 8).toUpperCase()
    : payslip.user_id
    ? String(payslip.user_id).slice(-8).toUpperCase()
    : "REF-001";

  const netWords = payslip.net_salary_words || numberToIndianWords(payslip.net_salary || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background text-foreground max-h-[92vh] flex flex-col">
        <DialogHeader className="p-4 sm:px-6 sm:py-4 border-b flex flex-row items-center justify-between no-print bg-muted/40">
          <div>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Salary Slip - {formatMonthName(payslip.month_year)}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Payslip Ref: <span className="font-mono">{payslipRef}</span> • Generated on{" "}
              {formatDateSafe(payslip.generated_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs py-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {payslip.status || "Generated"}
            </Badge>
            {payslip.is_locked && (
              <Badge
                variant="secondary"
                className="text-xs py-1 flex items-center gap-1"
              >
                <Lock className="w-3 h-3 text-muted-foreground" />
                Locked Snapshot
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
          <div className="border border-border/80 rounded-xl p-5 sm:p-7 bg-card shadow-sm space-y-5">
            {/* Header / Org Branding */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-border/60 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl">
                  BI
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">
                    BI TRACKER ENTERPRISE
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Business Intelligence & Technical Solutions Pvt. Ltd.
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Tech Park, Sector 4, Bangalore, KA - 560100 • info@bi-tracker.io
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right bg-muted/40 p-3 rounded-lg border border-border/40 min-w-[200px]">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                  Payslip For The Month Of
                </span>
                <span className="text-base font-bold text-foreground block">
                  {formatMonthName(payslip.month_year)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Payout Date: {formatDateSafe(payslip.payout_date)}
                </span>
              </div>
            </div>

            {/* Employee & Attendance Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Employee Particulars */}
              <div className="rounded-lg border border-border/60 p-4 space-y-2.5 bg-muted/20">
                <div className="font-semibold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border/40">
                  <User className="w-3.5 h-3.5" />
                  Employee Particulars
                </div>
                <div className="grid grid-cols-2 gap-y-2 pt-1 text-muted-foreground">
                  <div>Employee Name:</div>
                  <div className="font-semibold text-foreground">{payslip.employee_name || "Employee"}</div>
                  <div>Employee Code:</div>
                  <div className="font-semibold text-foreground font-mono">{payslip.employee_code || "EMP-000"}</div>
                  <div>Department:</div>
                  <div className="font-medium text-foreground">{payslip.department || "Business Intelligence"}</div>
                  <div>Designation:</div>
                  <div className="font-medium text-foreground">{payslip.job_title || "Staff"}</div>
                  <div>PAN:</div>
                  <div className="font-medium text-foreground font-mono">{payslip.pan || "XXXXX0000X"}</div>
                  <div>PF UAN:</div>
                  <div className="font-medium text-foreground font-mono">{payslip.uan || payslip.pf_number || "N/A"}</div>
                </div>
              </div>

              {/* Attendance & Bank Details */}
              <div className="rounded-lg border border-border/60 p-4 space-y-2.5 bg-muted/20">
                <div className="font-semibold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border/40">
                  <CreditCard className="w-3.5 h-3.5" />
                  Attendance & Bank Settlement
                </div>
                <div className="grid grid-cols-2 gap-y-2 pt-1 text-muted-foreground">
                  <div>Total Month Days:</div>
                  <div className="font-medium text-foreground font-mono">{payslip.total_working_days || 30} Days</div>
                  <div>Paid Days:</div>
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    {payslip.paid_days || 30} Days
                  </div>
                  <div>Loss of Pay (LOP) Days:</div>
                  <div className="font-semibold text-rose-600 dark:text-rose-400 font-mono">
                    {payslip.lop_days || 0} Days
                  </div>
                  <div>Bank Name:</div>
                  <div className="font-medium text-foreground">{payslip.bank_name || "Corporate Bank"}</div>
                  <div>Account No.:</div>
                  <div className="font-medium text-foreground font-mono">{payslip.bank_account || "•••• •••• 9840"}</div>
                  <div>IFSC Code:</div>
                  <div className="font-medium text-foreground font-mono">{payslip.bank_ifsc || "HDFC0001234"}</div>
                </div>
              </div>
            </div>

            {/* Earnings vs Deductions Table */}
            <div className="border border-border/80 rounded-xl overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/80">
                {/* Earnings Section */}
                <div className="flex flex-col">
                  <div className="bg-emerald-500/10 dark:bg-emerald-500/15 p-3 font-semibold text-xs text-emerald-700 dark:text-emerald-300 flex justify-between uppercase tracking-wider">
                    <span>Earnings</span>
                    <span>Amount</span>
                  </div>
                  <div className="p-3.5 space-y-2 text-xs flex-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Basic Pay</span>
                      <span className="font-mono font-medium">{formatCurrency(payslip.basic_pay)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">House Rent Allowance (HRA)</span>
                      <span className="font-mono font-medium">{formatCurrency(payslip.hra)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Special Allowance</span>
                      <span className="font-mono font-medium">{formatCurrency(payslip.special_allowance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conveyance Allowance</span>
                      <span className="font-mono font-medium">{formatCurrency(payslip.conveyance)}</span>
                    </div>
                    {(payslip.bonus ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Performance Bonus</span>
                        <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(payslip.bonus)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-muted/40 border-t border-border/60 flex justify-between font-semibold text-xs">
                    <span>Total Gross Earnings</span>
                    <span className="font-mono text-foreground font-bold">{formatCurrency(payslip.gross_earnings)}</span>
                  </div>
                </div>

                {/* Deductions Section */}
                <div className="flex flex-col">
                  <div className="bg-rose-500/10 dark:bg-rose-500/15 p-3 font-semibold text-xs text-rose-700 dark:text-rose-300 flex justify-between uppercase tracking-wider">
                    <span>Deductions</span>
                    <span>Amount</span>
                  </div>
                  <div className="p-3.5 space-y-2 text-xs flex-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        Loss of Pay (LOP)
                        {(payslip.lop_days ?? 0) > 0 && (
                          <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.2 rounded font-medium">
                            {payslip.lop_days}d
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                        {formatCurrency(payslip.lop_deduction)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provident Fund (Employee PF)</span>
                      <span className="font-mono font-medium">{formatCurrency(payslip.pf_deduction)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Professional Tax (PT)</span>
                      <span className="font-mono font-medium">{formatCurrency(payslip.pt_deduction)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax Deducted at Source (TDS)</span>
                      <span className="font-mono font-medium">{formatCurrency(payslip.tds_deduction)}</span>
                    </div>
                    {(payslip.other_deductions ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Other Deductions / Advances</span>
                        <span className="font-mono font-medium">{formatCurrency(payslip.other_deductions)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-muted/40 border-t border-border/60 flex justify-between font-semibold text-xs">
                    <span>Total Deductions</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                      {formatCurrency(payslip.total_deductions)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary Highlight & Rupee in Words */}
            <div className="p-4 sm:p-5 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Net Salary Payable
                </span>
                <span className="text-xs text-muted-foreground italic mt-0.5 block">
                  Amount in words:{" "}
                  <strong className="text-foreground not-italic">
                    {netWords}
                  </strong>
                </span>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-primary font-mono block">
                  {formatCurrency(payslip.net_salary)}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Direct Credit to Bank Account
                </span>
              </div>
            </div>

            {/* Footer / Disclaimer & Digital Verification */}
            <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground gap-3">
              <div className="max-w-md text-left">
                <p>
                  * This document is an official computer-generated salary slip and requires no physical signature.
                  Generated via BI Tracker Payroll Management Engine.
                </p>
              </div>
              <div className="text-right flex items-center gap-2 border border-border/60 px-3 py-1.5 rounded-lg bg-muted/20">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">BI Tracker Enterprise Payroll System</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <DialogFooter className="p-4 sm:px-6 sm:py-3 border-t bg-muted/30 flex flex-row items-center justify-between no-print gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 font-medium"
            >
              <Printer className="w-4 h-4" />
              Download / Print PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
