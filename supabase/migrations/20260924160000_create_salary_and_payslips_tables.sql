-- Migration: Create salary structures and immutable monthly payslips tables

CREATE TABLE IF NOT EXISTS employee_salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  monthly_gross NUMERIC(12, 2) NOT NULL DEFAULT 0,
  basic_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  hra NUMERIC(12, 2) NOT NULL DEFAULT 0,
  special_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  conveyance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pf_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pt_deduction NUMERIC(12, 2) NOT NULL DEFAULT 200,
  tds_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  custom_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL, -- Format: YYYY-MM e.g. "2026-08"
  payout_date DATE NOT NULL,
  total_working_days INT NOT NULL DEFAULT 30,
  present_days NUMERIC(5, 1) NOT NULL DEFAULT 30,
  paid_days NUMERIC(5, 1) NOT NULL DEFAULT 30,
  lop_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  lop_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  basic_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  hra NUMERIC(12, 2) NOT NULL DEFAULT 0,
  conveyance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  special_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gross_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pf_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pt_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tds_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_salary_words TEXT,
  bank_name VARCHAR(100),
  bank_account VARCHAR(100),
  bank_ifsc VARCHAR(50),
  pan VARCHAR(50),
  uan VARCHAR(50),
  pf_number VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'Generated', -- 'Generated' | 'Paid'
  is_locked BOOLEAN NOT NULL DEFAULT true, -- Immutable once generated
  generated_by UUID REFERENCES profiles(id),
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_month_payslip UNIQUE (user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_payslips_user_month ON payslips(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_payslips_month ON payslips(month_year);
CREATE INDEX IF NOT EXISTS idx_salary_structures_user ON employee_salary_structures(user_id);
