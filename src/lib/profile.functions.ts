import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyProfile = {
  id: string;
  email: string | null;
  full_name: string;
  job_title: string | null;
  department: string | null;
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
  // Basic info
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

const PROFILE_SELECT =
  "id, email, full_name, job_title, department, hourly_rate, is_active, created_at, " +
  "gender, date_of_birth, mobile, address, city, state, pincode, photo_url, " +
  "job_type, joining_date, work_location, " +
  "salary, salary_type, bank_account, pan, uan, pf_number, experience, previous_company, " +
  "emergency_contact_name, emergency_contact_relation, emergency_contact_phone, emergency_contact_address";

function mapProfile(data: any): MyProfile {
  return {
    id: data?.id ?? "",
    email: data?.email ?? null,
    full_name: data?.full_name ?? "",
    job_title: data?.job_title ?? null,
    department: data?.department ?? null,
    hourly_rate: Number(data?.hourly_rate ?? 0),
    is_active: data?.is_active ?? true,
    created_at: data?.created_at ?? "",
    gender: data?.gender ?? null,
    date_of_birth: data?.date_of_birth ?? null,
    mobile: data?.mobile ?? null,
    address: data?.address ?? null,
    city: data?.city ?? null,
    state: data?.state ?? null,
    pincode: data?.pincode ?? null,
    photo_url: data?.photo_url ?? null,
    job_type: data?.job_type ?? null,
    joining_date: data?.joining_date ?? null,
    work_location: data?.work_location ?? null,
    salary: data?.salary != null ? Number(data.salary) : null,
    salary_type: data?.salary_type ?? null,
    bank_account: data?.bank_account ?? null,
    pan: data?.pan ?? null,
    uan: data?.uan ?? null,
    pf_number: data?.pf_number ?? null,
    experience: data?.experience ?? null,
    previous_company: data?.previous_company ?? null,
    emergency_contact_name: data?.emergency_contact_name ?? null,
    emergency_contact_relation: data?.emergency_contact_relation ?? null,
    emergency_contact_phone: data?.emergency_contact_phone ?? null,
    emergency_contact_address: data?.emergency_contact_address ?? null,
  };
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ...mapProfile(data), id: context.userId };
  });

export const getEmployeeProfileById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }): Promise<MyProfile> => {
    // Only admin/sub_admin can view other profiles
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    const canView = roles.includes("admin") || roles.includes("sub_admin") || context.userId === data.id;
    if (!canView) throw new Error("Forbidden");

    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ...mapProfile(profile), id: data.id };
  });

const updateInput = z.object({
  // Basic info
  fullName: z.string().trim().min(1, "Name is required").max(120),
  gender: z.string().trim().max(20).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  mobile: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(255).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pincode: z.string().trim().max(10).optional().or(z.literal("")),
  photoUrl: z.string().optional().or(z.literal("")),
  // Employment
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  jobType: z.string().trim().max(20).optional().or(z.literal("")),
  joiningDate: z.string().optional().or(z.literal("")),
  workLocation: z.string().trim().max(120).optional().or(z.literal("")),
  // Salary / HR (can only be set by admin; employee sends these too but we allow if they own)
  salary: z.number().nullable().optional(),
  salaryType: z.string().trim().max(30).optional().or(z.literal("")),
  bankAccount: z.string().trim().max(50).optional().or(z.literal("")),
  pan: z.string().trim().max(20).optional().or(z.literal("")),
  uan: z.string().trim().max(30).optional().or(z.literal("")),
  pfNumber: z.string().trim().max(30).optional().or(z.literal("")),
  experience: z.string().trim().max(255).optional().or(z.literal("")),
  previousCompany: z.string().trim().max(120).optional().or(z.literal("")),
  // Emergency contact
  emergencyContactName: z.string().trim().max(120).optional().or(z.literal("")),
  emergencyContactRelation: z.string().trim().max(60).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(20).optional().or(z.literal("")),
  emergencyContactAddress: z.string().trim().max(255).optional().or(z.literal("")),
  // Target profile id (admin editing someone else)
  targetId: z.string().optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof updateInput>) => updateInput.parse(input))
  .handler(async ({ data, context }) => {
    const targetId = data.targetId ?? context.userId;

    // If editing someone else, require admin role
    if (targetId !== context.userId) {
      const { data: roleRows } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const roles = (roleRows ?? []).map((r: any) => r.role);
      if (!roles.includes("admin") && !roles.includes("sub_admin")) {
        throw new Error("Forbidden: admin only");
      }
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        gender: data.gender || null,
        date_of_birth: data.dateOfBirth || null,
        mobile: data.mobile || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        photo_url: data.photoUrl || null,
        job_title: data.jobTitle || null,
        department: data.department || null,
        job_type: data.jobType || null,
        joining_date: data.joiningDate || null,
        work_location: data.workLocation || null,
        salary: data.salary ?? null,
        salary_type: data.salaryType || null,
        bank_account: data.bankAccount || null,
        pan: data.pan || null,
        uan: data.uan || null,
        pf_number: data.pfNumber || null,
        experience: data.experience || null,
        previous_company: data.previousCompany || null,
        emergency_contact_name: data.emergencyContactName || null,
        emergency_contact_relation: data.emergencyContactRelation || null,
        emergency_contact_phone: data.emergencyContactPhone || null,
        emergency_contact_address: data.emergencyContactAddress || null,
      })
      .eq("id", targetId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
