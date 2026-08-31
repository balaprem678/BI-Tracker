export type Role = "admin" | "sub_admin" | "employee";

export type LocalUser = {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  jobTitle?: string | null;
  department?: string | null;
  hourlyRate: number;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

export type LocalProfile = {
  id: string;
  email: string | null;
  full_name: string;
  job_title: string | null;
  department: string | null;
  staff_section?: "IT Team" | "BI Staff" | string | null;
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Extended fields
  gender: string | null;
  date_of_birth: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  photo_url: string | null;
  // Employment
  job_type: string | null;
  joining_date: string | null;
  work_location: string | null;
  // Salary / HR
  salary: number | null;
  salary_type: string | null;
  bank_account: string | null;
  pan: string | null;
  uan: string | null;
  pf_number: string | null;
  experience: string | null;
  previous_company: string | null;
  // Emergency contact
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_address: string | null;
};

export type LocalUserRole = {
  id: string;
  user_id: string;
  role: Role;
  created_at: string;
};

export type LocalShift = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
  created_at: string;
};

export type LocalHourlyLog = {
  id: string;
  user_id: string;
  log_date: string;
  hour_slot: number;
  task: string;
  category: string;
  project: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  created_at: string;
};

export type LocalLeaveRequest = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type LocalProject = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  status: string; // Active, Completed, On Hold
  assigned_sub_admin_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type LocalProjectAssignment = {
  id: string;
  project_id: string;
  user_id: string;
  assigned_at: string;
};

export type LocalProjectSession = {
  id: string;
  user_id: string;
  project_id: string;
  project_name: string;
  session_date: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  status: string; // In Progress, Paused, Completed, On Hold, Blocked, Auto-Stopped
  task_summary: string | null;
  daily_ended: boolean;
  created_at: string;
  updated_at: string;
};

export interface LocalDatabaseSchema {
  users: LocalUser[];
  profiles: LocalProfile[];
  user_roles: LocalUserRole[];
  shifts: LocalShift[];
  hourly_logs: LocalHourlyLog[];
  leave_requests: LocalLeaveRequest[];
  projects: LocalProject[];
  project_assignments: LocalProjectAssignment[];
  project_sessions: LocalProjectSession[];
}

const LOCAL_STORAGE_KEY = "bi_tracker_local_db_v1";
const LOCAL_SESSION_KEY = "bi_tracker_local_session_v1";

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function sampleDateIso(offsetDays = 0, hour = 9, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const SEED_ADMIN_ID = "a0000000-0000-4000-8000-000000000001";
export const SEED_SUBADMIN_ID = "a0000000-0000-4000-8000-000000000002";
export const SEED_EMPLOYEE_ID = "a0000000-0000-4000-8000-000000000003";

export function generateSeedData(): LocalDatabaseSchema {
  const today = todayStr(0);
  const yesterday = todayStr(-1);

  const users: LocalUser[] = [
    {
      id: SEED_ADMIN_ID,
      email: "BIadmin@bi-tracker.local",
      password: "BiTracker@07",
      fullName: "BI Admin",
      jobTitle: "System Administrator",
      department: "Management",
      hourlyRate: 50,
      role: "admin",
      isActive: true,
      createdAt: sampleDateIso(-30, 9, 0),
    },
    {
      id: SEED_SUBADMIN_ID,
      email: "subadmin@bi-tracker.local",
      password: "BiTracker@07",
      fullName: "Sarah Jenkins",
      jobTitle: "Operations Lead",
      department: "Operations",
      hourlyRate: 38,
      role: "sub_admin",
      isActive: true,
      createdAt: sampleDateIso(-25, 9, 0),
    },
    {
      id: SEED_EMPLOYEE_ID,
      email: "employee@bi-tracker.local",
      password: "BiTracker@07",
      fullName: "Alex Rivera",
      jobTitle: "Senior Analyst",
      department: "Business Intelligence",
      hourlyRate: 30,
      role: "employee",
      isActive: true,
      createdAt: sampleDateIso(-20, 9, 0),
    },
  ];

  const profiles: LocalProfile[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    job_title: u.jobTitle ?? null,
    department: u.department ?? null,
    staff_section: u.id === SEED_EMPLOYEE_ID ? "BI Staff" : "IT Team",
    hourly_rate: u.hourlyRate,
    is_active: u.isActive,
    created_at: u.createdAt,
    updated_at: u.createdAt,
    gender: null,
    date_of_birth: null,
    mobile: null,
    address: null,
    city: null,
    state: null,
    pincode: null,
    photo_url: null,
    job_type: "full-time",
    joining_date: u.createdAt.slice(0, 10),
    work_location: null,
    salary: null,
    salary_type: "monthly",
    bank_account: null,
    pan: null,
    uan: null,
    pf_number: null,
    experience: null,
    previous_company: null,
    emergency_contact_name: null,
    emergency_contact_relation: null,
    emergency_contact_phone: null,
    emergency_contact_address: null,
  }));

  const user_roles: LocalUserRole[] = users.map((u, i) => ({
    id: `role-${i + 1}`,
    user_id: u.id,
    role: u.role,
    created_at: u.createdAt,
  }));

  const shifts: LocalShift[] = [
    // Admin shifts
    {
      id: "shift-1",
      user_id: SEED_ADMIN_ID,
      clock_in: sampleDateIso(0, 8, 30),
      clock_out: null, // currently clocked in
      note: "Morning setup & shift start",
      created_at: sampleDateIso(0, 8, 30),
    },
    {
      id: "shift-2",
      user_id: SEED_ADMIN_ID,
      clock_in: sampleDateIso(-1, 9, 0),
      clock_out: sampleDateIso(-1, 17, 30),
      note: "Full day management",
      created_at: sampleDateIso(-1, 9, 0),
    },
    // Sub-Admin shifts
    {
      id: "shift-3",
      user_id: SEED_SUBADMIN_ID,
      clock_in: sampleDateIso(0, 9, 0),
      clock_out: null,
      note: "Sprint planning & tracking",
      created_at: sampleDateIso(0, 9, 0),
    },
    {
      id: "shift-4",
      user_id: SEED_SUBADMIN_ID,
      clock_in: sampleDateIso(-1, 9, 0),
      clock_out: sampleDateIso(-1, 17, 0),
      note: null,
      created_at: sampleDateIso(-1, 9, 0),
    },
    // Employee shifts
    {
      id: "shift-5",
      user_id: SEED_EMPLOYEE_ID,
      clock_in: sampleDateIso(0, 9, 15),
      clock_out: null,
      note: "BI Analytics pipeline",
      created_at: sampleDateIso(0, 9, 15),
    },
    {
      id: "shift-6",
      user_id: SEED_EMPLOYEE_ID,
      clock_in: sampleDateIso(-1, 9, 0),
      clock_out: sampleDateIso(-1, 17, 0),
      note: "Dashboard ETL tasks",
      created_at: sampleDateIso(-1, 9, 0),
    },
  ];

  const hourly_logs: LocalHourlyLog[] = [
    // Today logs for Admin
    {
      id: "log-1",
      user_id: SEED_ADMIN_ID,
      log_date: today,
      hour_slot: 9,
      task: "Reviewed weekly staffing schedules and team attendance report",
      category: "admin",
      project: "Operations",
      start_time: "09:00",
      end_time: "10:00",
      status: "Completed",
      created_at: sampleDateIso(0, 9, 5),
    },
    {
      id: "log-2",
      user_id: SEED_ADMIN_ID,
      log_date: today,
      hour_slot: 10,
      task: "Client stakeholder alignment meeting on Q3 deliverables",
      category: "meeting",
      project: "BI-Tracker Core",
      start_time: "10:00",
      end_time: "11:00",
      status: "Completed",
      created_at: sampleDateIso(0, 10, 5),
    },
    {
      id: "log-3",
      user_id: SEED_ADMIN_ID,
      log_date: today,
      hour_slot: 11,
      task: "Configured role permissions and reviewed leave approvals",
      category: "admin",
      project: "Operations",
      start_time: "11:00",
      end_time: "12:00",
      status: "Inprogress",
      created_at: sampleDateIso(0, 11, 5),
    },
    // Today logs for Employee
    {
      id: "log-4",
      user_id: SEED_EMPLOYEE_ID,
      log_date: today,
      hour_slot: 9,
      task: "Created PowerBI / Metabase dashboard widget components",
      category: "client work",
      project: "Executive KPI Dashboard",
      start_time: "09:00",
      end_time: "10:00",
      status: "Completed",
      created_at: sampleDateIso(0, 9, 20),
    },
    {
      id: "log-5",
      user_id: SEED_EMPLOYEE_ID,
      log_date: today,
      hour_slot: 10,
      task: "Refined hourly SQL aggregation queries and data validation rules",
      category: "client work",
      project: "Executive KPI Dashboard",
      start_time: "10:00",
      end_time: "11:00",
      status: "Inprogress",
      created_at: sampleDateIso(0, 10, 15),
    },
    // Yesterday logs
    {
      id: "log-6",
      user_id: SEED_EMPLOYEE_ID,
      log_date: yesterday,
      hour_slot: 9,
      task: "Setup automated ETL daily sync pipelines",
      category: "general",
      project: "Data Ingestion",
      start_time: "09:00",
      end_time: "10:00",
      status: "Completed",
      created_at: sampleDateIso(-1, 9, 30),
    },
    {
      id: "log-7",
      user_id: SEED_EMPLOYEE_ID,
      log_date: yesterday,
      hour_slot: 10,
      task: "Tested data accuracy against production data warehouse",
      category: "client work",
      project: "Data Ingestion",
      start_time: "10:00",
      end_time: "11:00",
      status: "Completed",
      created_at: sampleDateIso(-1, 10, 30),
    },
  ];

  const leave_requests: LocalLeaveRequest[] = [
    {
      id: "leave-1",
      user_id: SEED_EMPLOYEE_ID,
      start_date: todayStr(7),
      end_date: todayStr(8),
      leave_type: "Casual",
      reason: "Family personal commitment",
      status: "Approved",
      created_at: sampleDateIso(-3, 11, 0),
      updated_at: sampleDateIso(-2, 14, 0),
    },
    {
      id: "leave-2",
      user_id: SEED_SUBADMIN_ID,
      start_date: todayStr(14),
      end_date: todayStr(15),
      leave_type: "Sick",
      reason: "Medical appointment",
      status: "Pending",
      created_at: sampleDateIso(-1, 15, 0),
      updated_at: sampleDateIso(-1, 15, 0),
    },
  ];

  const projects: LocalProject[] = [
    {
      id: "proj-1",
      name: "Executive KPI Dashboard",
      code: "EKPI-01",
      description: "Executive business intelligence metrics, real-time KPI aggregations, and management dashboards.",
      status: "Active",
      assigned_sub_admin_id: SEED_SUBADMIN_ID,
      created_at: sampleDateIso(-10, 9, 0),
      updated_at: sampleDateIso(-10, 9, 0),
    },
    {
      id: "proj-2",
      name: "Customer Analytics Portal",
      code: "CAP-02",
      description: "Customer lifecycle analytics, churn prediction pipelines, and cohort retention visualizers.",
      status: "Active",
      assigned_sub_admin_id: SEED_SUBADMIN_ID,
      created_at: sampleDateIso(-10, 9, 0),
      updated_at: sampleDateIso(-10, 9, 0),
    },
    {
      id: "proj-3",
      name: "Data Warehouse ETL Migration",
      code: "DW-03",
      description: "Automated ETL extraction pipelines and PostgreSQL warehouse data consolidation.",
      status: "Active",
      assigned_sub_admin_id: SEED_SUBADMIN_ID,
      created_at: sampleDateIso(-8, 9, 0),
      updated_at: sampleDateIso(-8, 9, 0),
    },
  ];

  const project_assignments: LocalProjectAssignment[] = [
    { id: "assign-1", project_id: "proj-1", user_id: SEED_EMPLOYEE_ID, assigned_at: sampleDateIso(-10, 9, 0) },
    { id: "assign-2", project_id: "proj-2", user_id: SEED_EMPLOYEE_ID, assigned_at: sampleDateIso(-10, 9, 0) },
    { id: "assign-3", project_id: "proj-3", user_id: SEED_EMPLOYEE_ID, assigned_at: sampleDateIso(-8, 9, 0) },
    { id: "assign-4", project_id: "proj-1", user_id: SEED_SUBADMIN_ID, assigned_at: sampleDateIso(-10, 9, 0) },
    { id: "assign-5", project_id: "proj-2", user_id: SEED_SUBADMIN_ID, assigned_at: sampleDateIso(-10, 9, 0) },
    { id: "assign-6", project_id: "proj-3", user_id: SEED_SUBADMIN_ID, assigned_at: sampleDateIso(-8, 9, 0) },
  ];

  const project_sessions: LocalProjectSession[] = [
    {
      id: "sess-1",
      user_id: SEED_EMPLOYEE_ID,
      project_id: "proj-1",
      project_name: "Executive KPI Dashboard",
      session_date: today,
      start_time: sampleDateIso(0, 9, 15),
      end_time: sampleDateIso(0, 10, 45),
      duration_seconds: 5400,
      status: "Paused",
      task_summary: "Created PowerBI / Metabase dashboard widget components",
      daily_ended: false,
      created_at: sampleDateIso(0, 9, 15),
      updated_at: sampleDateIso(0, 10, 45),
    },
    {
      id: "sess-2",
      user_id: SEED_EMPLOYEE_ID,
      project_id: "proj-2",
      project_name: "Customer Analytics Portal",
      session_date: today,
      start_time: sampleDateIso(0, 11, 0),
      end_time: sampleDateIso(0, 12, 30),
      duration_seconds: 5400,
      status: "Paused",
      task_summary: "Designed cohort retention heatmaps and data validation queries",
      daily_ended: false,
      created_at: sampleDateIso(0, 11, 0),
      updated_at: sampleDateIso(0, 12, 30),
    },
  ];

  return {
    users,
    profiles,
    user_roles,
    shifts,
    hourly_logs,
    leave_requests,
    projects,
    project_assignments,
    project_sessions,
  };
}

let serverMemoryDb: LocalDatabaseSchema | null = null;

class LocalDatabaseManager {
  public getDb(): LocalDatabaseSchema {
    if (typeof window !== "undefined") {
      // Browser environment
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.warn("[LocalDB] Failed reading from localStorage:", e);
      }
      const initial = generateSeedData();
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
      } catch (e) {
        console.warn("[LocalDB] Failed saving to localStorage:", e);
      }
      return initial;
    }

    // Node / Server environment
    if (serverMemoryDb) {
      return serverMemoryDb;
    }

    try {
      const fs = require("node:fs");
      const path = require("node:path");
      const dbPath = path.resolve(process.cwd(), ".local-db.json");
      if (fs.existsSync(dbPath)) {
        const raw = fs.readFileSync(dbPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users)) {
          serverMemoryDb = parsed;
          return parsed;
        }
      }
    } catch {
      // Fallback
    }

    const seed = generateSeedData();
    this.saveDb(seed);
    return seed;
  }

  public saveDb(data: LocalDatabaseSchema) {
    serverMemoryDb = data;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn("[LocalDB] localStorage write error:", e);
      }
      return;
    }

    try {
      const fs = require("node:fs");
      const path = require("node:path");
      const dbPath = path.resolve(process.cwd(), ".local-db.json");
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // In-memory fallback
    }
  }

  public resetDb(): LocalDatabaseSchema {
    const seed = generateSeedData();
    this.saveDb(seed);
    return seed;
  }
}

export const localDbManager = new LocalDatabaseManager();

function base64UrlEncode(str: string): string {
  if (typeof window !== "undefined") {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  return Buffer.from(str, "utf-8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  if (typeof window !== "undefined") {
    return decodeURIComponent(escape(atob(base64)));
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function createLocalJwt(user: { id: string; email: string; role: Role; fullName: string }) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      user_metadata: { full_name: user.fullName },
      exp: Math.floor(Date.now() / 1000) + 86400 * 30,
      iat: Math.floor(Date.now() / 1000),
    }),
  );
  const signature = base64UrlEncode("local_mock_signature");
  return `${header}.${payload}.${signature}`;
}

export function parseLocalJwt(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

export interface LocalSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    user_metadata: { full_name?: string };
  };
}

export type DbResult<T> = {
  data: T;
  error: { message: string; code?: string } | null;
  count?: number;
};

export class LocalQueryBuilder {
  private tableName: keyof LocalDatabaseSchema;
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private actionPayload: any = null;
  private actionOptions: any = null;
  private filters: Array<(item: any) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc: boolean = true;
  private limitCount: number | null = null;
  private selectFields: string | null = null;

  constructor(tableName: keyof LocalDatabaseSchema) {
    this.tableName = tableName;
  }

  select(fields = "*", options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    this.action = "select";
    this.selectFields = fields;
    if (options?.head) {
      this.limitCount = 0;
    }
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((item) => {
      if (item[column] == null) return false;
      return String(item[column]) >= String(value);
    });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((item) => {
      if (item[column] == null) return false;
      return String(item[column]) <= String(value);
    });
    return this;
  }

  is(column: string, value: any) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.orderCol = column;
    this.orderAsc = ascending;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  insert(data: any | any[]) {
    this.action = "insert";
    this.actionPayload = data;
    return this;
  }

  update(updates: any) {
    this.action = "update";
    this.actionPayload = updates;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  upsert(values: any | any[], options?: { onConflict?: string }) {
    this.action = "upsert";
    this.actionPayload = values;
    this.actionOptions = options;
    return this;
  }

  async execute(): Promise<DbResult<any>> {
    const db = localDbManager.getDb();

    if (this.action === "insert") {
      const rows = Array.isArray(this.actionPayload) ? this.actionPayload : [this.actionPayload];
      const targetTable = (db[this.tableName] as any[]) || [];
      const inserted: any[] = [];
      for (const r of rows) {
        const newRow = {
          id: r.id || crypto.randomUUID(),
          created_at: r.created_at || new Date().toISOString(),
          ...r,
        };
        targetTable.push(newRow);
        inserted.push(newRow);
      }
      db[this.tableName] = targetTable as any;
      localDbManager.saveDb(db);
      return { data: Array.isArray(this.actionPayload) ? inserted : inserted[0], error: null };
    }

    if (this.action === "update") {
      const table = (db[this.tableName] as any[]) || [];
      let updatedCount = 0;
      const updatedRows: any[] = [];
      const updates = this.actionPayload || {};

      const newTable = table.map((item) => {
        const match = this.filters.every((f) => f(item));
        if (match) {
          updatedCount++;
          const updated = {
            ...item,
            ...updates,
            updated_at: new Date().toISOString(),
          };
          updatedRows.push(updated);

          if (this.tableName === "profiles" && updates.is_active !== undefined) {
            const user = db.users.find((u) => u.id === item.id);
            if (user) user.isActive = updates.is_active;
          }

          return updated;
        }
        return item;
      });

      db[this.tableName] = newTable as any;
      localDbManager.saveDb(db);
      return { data: updatedRows, error: null, count: updatedCount };
    }

    if (this.action === "delete") {
      const table = (db[this.tableName] as any[]) || [];
      const remaining: any[] = [];
      const deleted: any[] = [];

      for (const item of table) {
        if (this.filters.every((f) => f(item))) {
          deleted.push(item);
        } else {
          remaining.push(item);
        }
      }

      db[this.tableName] = remaining as any;
      localDbManager.saveDb(db);
      return { data: deleted, error: null };
    }

    if (this.action === "upsert") {
      const rows = Array.isArray(this.actionPayload) ? this.actionPayload : [this.actionPayload];
      const table = (db[this.tableName] as any[]) || [];
      const conflictKeys = this.actionOptions?.onConflict
        ? this.actionOptions.onConflict.split(",").map((k: string) => k.trim())
        : ["id"];

      for (const row of rows) {
        const existingIdx = table.findIndex((item) =>
          conflictKeys.every((k: string) => item[k] === row[k]),
        );

        if (existingIdx >= 0) {
          table[existingIdx] = {
            ...table[existingIdx],
            ...row,
            updated_at: new Date().toISOString(),
          };
        } else {
          table.push({
            id: row.id || crypto.randomUUID(),
            created_at: new Date().toISOString(),
            ...row,
          });
        }

        if (this.tableName === "user_roles" && row.user_id && row.role) {
          const user = db.users.find((u) => u.id === row.user_id);
          if (user) user.role = row.role;
        }
      }

      db[this.tableName] = table as any;
      localDbManager.saveDb(db);
      return { data: this.actionPayload, error: null };
    }

    // Default: Select action
    let rows = ((db[this.tableName] as any[]) || []).slice();

    for (const f of this.filters) {
      rows = rows.filter(f);
    }

    const exactCount = rows.length;

    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAsc;
      rows.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA == null) return asc ? -1 : 1;
        if (valB == null) return asc ? 1 : -1;
        return asc ? (valA < valB ? -1 : 1) : valA > valB ? -1 : 1;
      });
    }

    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.selectFields && this.selectFields !== "*") {
      const fields = this.selectFields.split(",").map((s) => s.trim());
      rows = rows.map((r) => {
        const out: any = {};
        for (const f of fields) {
          out[f] = r[f];
        }
        return out;
      });
    }

    return { data: rows, error: null, count: exactCount };
  }

  async maybeSingle(): Promise<DbResult<any>> {
    const res = await this.execute();
    return { data: Array.isArray(res.data) ? res.data[0] || null : res.data, error: null };
  }

  async single(): Promise<DbResult<any>> {
    const res = await this.execute();
    const item = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!item) {
      return { data: null, error: { message: "Row not found", code: "PGRST116" } };
    }
    return { data: item, error: null };
  }

  then<TResult1 = DbResult<any>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function createLocalSupabaseClient() {
  const authListeners = new Set<(event: string, session: LocalSession | null) => void>();

  const getStoredSession = (): LocalSession | null => {
    if (typeof window === "undefined") return null;
    try {
      const str = localStorage.getItem(LOCAL_SESSION_KEY);
      if (str) return JSON.parse(str);
    } catch {
      // ignore
    }
    return null;
  };

  const setStoredSession = (session: LocalSession | null) => {
    if (typeof window === "undefined") return;
    try {
      if (session) {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(LOCAL_SESSION_KEY);
      }
    } catch {
      // ignore
    }
  };

  return {
    from: (table: string) => new LocalQueryBuilder(table as keyof LocalDatabaseSchema),
    rpc: async (name: string, params: any): Promise<{ data: any; error: { message: string } | null }> => {
      const db = localDbManager.getDb();
      if (name === "has_role") {
        const { _user_id, _role } = params;
        const exists = db.user_roles.some((r) => r.user_id === _user_id && r.role === _role);
        return { data: exists, error: null };
      }
      return { data: null, error: null };
    },
    auth: {
      getSession: async () => {
        const session = getStoredSession();
        return { data: { session }, error: null };
      },
      getUser: async (token?: string) => {
        if (token) {
          const payload = parseLocalJwt(token);
          if (payload) {
            const db = localDbManager.getDb();
            const user = db.users.find((u) => u.id === payload.sub);
            if (user) {
              return {
                data: {
                  user: {
                    id: user.id,
                    email: user.email,
                    user_metadata: { full_name: user.fullName },
                  },
                },
                error: null,
              };
            }
          }
        }

        const session = getStoredSession();
        if (session?.user) {
          return { data: { user: session.user }, error: null };
        }
        return { data: { user: null }, error: { message: "No user logged in" } };
      },
      getClaims: async (token: string) => {
        const payload = parseLocalJwt(token);
        if (payload) {
          return { data: { claims: payload }, error: null };
        }
        return { data: null, error: { message: "Invalid local token" } };
      },
      signInWithPassword: async ({ email, password }: { email: string; password?: string }) => {
        const db = localDbManager.getDb();
        const cleanEmail = email.trim().toLowerCase();

        const user = db.users.find(
          (u) =>
            u.email.toLowerCase() === cleanEmail ||
            (cleanEmail === "biadmin" && u.email.toLowerCase().includes("biadmin")),
        );

        if (!user) {
          return { data: { user: null, session: null }, error: { message: "User not found." } };
        }

        if (password && user.password && user.password !== password) {
          return { data: { user: null, session: null }, error: { message: "Invalid password." } };
        }

        if (!user.isActive) {
          return {
            data: { user: null, session: null },
            error: { message: "Your account is inactive. Please contact an administrator." },
          };
        }

        const token = createLocalJwt({
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        });

        const session: LocalSession = {
          access_token: token,
          token_type: "bearer",
          expires_in: 86400 * 30,
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { full_name: user.fullName },
          },
        };

        setStoredSession(session);
        authListeners.forEach((fn) => fn("SIGNED_IN", session));

        return { data: { user: session.user, session }, error: null };
      },
      signUp: async ({ email, password, options }: any) => {
        const db = localDbManager.getDb();
        const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          return { data: { user: null, session: null }, error: { message: "User already exists." } };
        }

        const isFirst = db.users.length === 0;
        const role: Role = isFirst ? "admin" : "employee";
        const fullName = options?.data?.full_name || email.split("@")[0];

        const newUser: LocalUser = {
          id: crypto.randomUUID(),
          email,
          password: password || "BiTracker@07",
          fullName,
          jobTitle: options?.data?.job_title || null,
          department: options?.data?.department || null,
          hourlyRate: Number(options?.data?.hourly_rate || 0),
          role,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        db.users.push(newUser);
        db.profiles.push({
          id: newUser.id,
          email: newUser.email,
          full_name: newUser.fullName,
          job_title: newUser.jobTitle ?? null,
          department: newUser.department ?? null,
          hourly_rate: newUser.hourlyRate,
          is_active: newUser.isActive,
          created_at: newUser.createdAt,
          updated_at: newUser.createdAt,
          gender: null, date_of_birth: null, mobile: null, address: null,
          city: null, state: null, pincode: null, photo_url: null,
          job_type: "full-time", joining_date: newUser.createdAt.slice(0, 10),
          work_location: null, salary: null, salary_type: "monthly",
          bank_account: null, pan: null, uan: null, pf_number: null,
          experience: null, previous_company: null,
          emergency_contact_name: null, emergency_contact_relation: null,
          emergency_contact_phone: null, emergency_contact_address: null,
        });
        db.user_roles.push({
          id: `role-${Date.now()}`,
          user_id: newUser.id,
          role: newUser.role,
          created_at: newUser.createdAt,
        });

        localDbManager.saveDb(db);

        const token = createLocalJwt(newUser);
        const session: LocalSession = {
          access_token: token,
          token_type: "bearer",
          expires_in: 86400 * 30,
          user: {
            id: newUser.id,
            email: newUser.email,
            user_metadata: { full_name: newUser.fullName },
          },
        };

        setStoredSession(session);
        authListeners.forEach((fn) => fn("SIGNED_IN", session));

        return { data: { user: session.user, session }, error: null };
      },
      signOut: async () => {
        setStoredSession(null);
        authListeners.forEach((fn) => fn("SIGNED_OUT", null));
        return { error: null };
      },
      onAuthStateChange: (callback: (event: string, session: LocalSession | null) => void) => {
        authListeners.add(callback);
        const session = getStoredSession();
        if (session) {
          setTimeout(() => callback("INITIAL_SESSION", session), 0);
        }
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authListeners.delete(callback);
              },
            },
          },
        };
      },
      admin: {
        createUser: async ({
          email,
          password,
          user_metadata,
        }: {
          email: string;
          password?: string;
          user_metadata?: any;
          email_confirm?: boolean;
        }) => {
          const db = localDbManager.getDb();
          const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
          if (existing) {
            return {
              data: { user: null },
              error: { message: "A user with this email already exists." },
            };
          }

          const newUser: LocalUser = {
            id: crypto.randomUUID(),
            email,
            password: password || "BiTracker@07",
            fullName: user_metadata?.full_name || email.split("@")[0],
            jobTitle: user_metadata?.job_title || null,
            department: user_metadata?.department || null,
            hourlyRate: Number(user_metadata?.hourly_rate || 0),
            role: "employee",
            isActive: true,
            createdAt: new Date().toISOString(),
          };

          db.users.push(newUser);
          db.profiles.push({
            id: newUser.id,
            email: newUser.email,
            full_name: newUser.fullName,
            job_title: newUser.jobTitle ?? null,
            department: newUser.department ?? null,
            hourly_rate: newUser.hourlyRate,
            is_active: newUser.isActive,
            created_at: newUser.createdAt,
            updated_at: newUser.createdAt,
            gender: null, date_of_birth: null, mobile: null, address: null,
            city: null, state: null, pincode: null, photo_url: null,
            job_type: "full-time", joining_date: newUser.createdAt.slice(0, 10),
            work_location: null, salary: null, salary_type: "monthly",
            bank_account: null, pan: null, uan: null, pf_number: null,
            experience: null, previous_company: null,
            emergency_contact_name: null, emergency_contact_relation: null,
            emergency_contact_phone: null, emergency_contact_address: null,
          });
          db.user_roles.push({
            id: `role-${Date.now()}`,
            user_id: newUser.id,
            role: newUser.role,
            created_at: newUser.createdAt,
          });

          localDbManager.saveDb(db);

          return {
            data: {
              user: {
                id: newUser.id,
                email: newUser.email,
                user_metadata: { full_name: newUser.fullName },
              },
            },
            error: null,
          };
        },
      },
    },
  };
}
