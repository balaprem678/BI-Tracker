import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyProfile = {
  id: string;
  employee_id: string | null;
  email: string | null;
  full_name: string;
  job_title: string | null;
  department: string | null;
  staff_section: string | null;
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
  "id, email, full_name, job_title, department, staff_section, hourly_rate, is_active, created_at, updated_at";

function mapProfile(data: any, userMeta: any = {}): MyProfile {
  return {
    id: data?.id ?? "",
    employee_id: userMeta?.employee_id ?? data?.employee_id ?? null,
    email: data?.email ?? userMeta?.email ?? null,
    full_name: data?.full_name || userMeta?.full_name || "",
    job_title: data?.job_title ?? userMeta?.job_title ?? null,
    department: data?.department ?? userMeta?.department ?? null,
    staff_section: data?.staff_section ?? userMeta?.staff_section ?? "IT Team",
    hourly_rate: Number(data?.hourly_rate ?? userMeta?.hourly_rate ?? 0),
    is_active: data?.is_active ?? true,
    created_at: data?.created_at ?? "",
    gender: userMeta?.gender ?? data?.gender ?? null,
    date_of_birth: userMeta?.date_of_birth ?? data?.date_of_birth ?? null,
    mobile: userMeta?.mobile ?? data?.mobile ?? null,
    address: userMeta?.address ?? data?.address ?? null,
    city: userMeta?.city ?? data?.city ?? null,
    state: userMeta?.state ?? data?.state ?? null,
    pincode: userMeta?.pincode ?? data?.pincode ?? null,
    photo_url: userMeta?.photo_url ?? data?.photo_url ?? null,
    job_type: userMeta?.job_type ?? data?.job_type ?? null,
    joining_date: userMeta?.joining_date ?? data?.joining_date ?? null,
    work_location: userMeta?.work_location ?? data?.work_location ?? null,
    salary: userMeta?.salary != null ? Number(userMeta.salary) : (data?.salary != null ? Number(data.salary) : null),
    salary_type: userMeta?.salary_type ?? data?.salary_type ?? null,
    bank_account: userMeta?.bank_account ?? data?.bank_account ?? null,
    pan: userMeta?.pan ?? data?.pan ?? null,
    uan: userMeta?.uan ?? data?.uan ?? null,
    pf_number: userMeta?.pf_number ?? data?.pf_number ?? null,
    experience: userMeta?.experience ?? data?.experience ?? null,
    previous_company: userMeta?.previous_company ?? data?.previous_company ?? null,
    emergency_contact_name: userMeta?.emergency_contact_name ?? data?.emergency_contact_name ?? null,
    emergency_contact_relation: userMeta?.emergency_contact_relation ?? data?.emergency_contact_relation ?? null,
    emergency_contact_phone: userMeta?.emergency_contact_phone ?? data?.emergency_contact_phone ?? null,
    emergency_contact_address: userMeta?.emergency_contact_address ?? data?.emergency_contact_address ?? null,
  };
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { data: profileRow, error } = await context.supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    let userMeta: any = {};
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      if (authUser?.user?.user_metadata) {
        userMeta = authUser.user.user_metadata;
      }
    } catch (err) {
      console.error("Failed to load user metadata for my profile:", err);
    }

    return { ...mapProfile(profileRow, userMeta), id: context.userId };
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

    const { data: profileRow, error } = await context.supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    let userMeta: any = {};
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.id);
      if (authUser?.user?.user_metadata) {
        userMeta = authUser.user.user_metadata;
      }
    } catch (err) {
      console.error("Failed to load user metadata for employee profile:", err);
    }

    return { ...mapProfile(profileRow, userMeta), id: data.id };
  });

const updateInput = z.object({
  // Basic info
  employeeId: z.string().trim().max(50).optional().or(z.literal("")),
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
  staffSection: z.string().optional().or(z.literal("")),
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

    // Require admin or sub_admin role to update profile details
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("admin") && !roles.includes("sub_admin")) {
      throw new Error("Forbidden: Profile editing is disabled for employees. Contact an administrator to update account details.");
    }

    // 1. Update core fields in profiles table
    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        job_title: data.jobTitle || null,
        department: data.department || null,
        staff_section: data.staffSection || "IT Team",
      })
      .eq("id", targetId);
    if (error) throw new Error(error.message);

    // 2. Persist all profile & HR metadata via auth.admin updateUserById
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(targetId);
      const prevMeta = existingUser?.user?.user_metadata || {};

      await supabaseAdmin.auth.admin.updateUserById(targetId, {
        user_metadata: {
          ...prevMeta,
          employee_id: data.employeeId || prevMeta.employee_id || null,
          full_name: data.fullName,
          job_title: data.jobTitle || null,
          department: data.department || null,
          staff_section: data.staffSection || "IT Team",
          gender: data.gender || null,
          date_of_birth: data.dateOfBirth || null,
          mobile: data.mobile || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          pincode: data.pincode || null,
          photo_url: data.photoUrl || null,
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
        },
      });
    } catch (err) {
      console.error("Failed to update user_metadata in auth:", err);
    }

    return { ok: true as const };
  });

const uploadImageInput = z.object({
  targetUserId: z.string().min(1),
  fileBase64: z.string().min(1),
  fileName: z.string().default("avatar.jpg"),
  contentType: z.string().default("image/jpeg"),
});

export const uploadEmployeeProfileImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof uploadImageInput>) => uploadImageInput.parse(input))
  .handler(async ({ data, context }) => {
    // 1. Enforce admin or sub_admin permission
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("admin") && !roles.includes("sub_admin")) {
      throw new Error("Forbidden: Only administrators can upload employee profile pictures.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clean base64 string
    const base64Data = data.fileBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Get file extension from contentType or fileName
    let ext = "jpg";
    if (data.contentType.includes("png")) ext = "png";
    else if (data.contentType.includes("webp")) ext = "webp";
    else if (data.contentType.includes("gif")) ext = "gif";
    else if (data.fileName.includes(".")) {
      ext = data.fileName.split(".").pop() || "jpg";
    }

    const filePath = `user_${data.targetUserId}_${Date.now()}.${ext}`;

    // Upload to avatars bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: data.contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error("Failed to store image: " + uploadError.message);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // Update target employee user_metadata in Auth
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(data.targetUserId);
    const prevMeta = existingUser?.user?.user_metadata || {};

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      data.targetUserId,
      {
        user_metadata: {
          ...prevMeta,
          photo_url: publicUrl,
        },
      }
    );

    if (authUpdateError) {
      console.error("Failed to set photo_url in auth user_metadata:", authUpdateError);
      throw new Error("Failed to link profile photo: " + authUpdateError.message);
    }

    return { ok: true as const, photoUrl: publicUrl };
  });

const removeImageInput = z.object({
  targetUserId: z.string().min(1),
});

export const removeEmployeeProfileImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof removeImageInput>) => removeImageInput.parse(input))
  .handler(async ({ data, context }) => {
    // 1. Enforce admin or sub_admin permission
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("admin") && !roles.includes("sub_admin")) {
      throw new Error("Forbidden: Only administrators can remove employee profile pictures.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Update target employee user_metadata in Auth
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(data.targetUserId);
    const prevMeta = existingUser?.user?.user_metadata || {};

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      data.targetUserId,
      {
        user_metadata: {
          ...prevMeta,
          photo_url: null,
        },
      }
    );

    if (authUpdateError) {
      throw new Error("Failed to remove profile photo: " + authUpdateError.message);
    }

    return { ok: true as const, message: "Profile photo removed." };
  });

const setImageUrlInput = z.object({
  targetUserId: z.string().min(1),
  photoUrl: z.string().url("Invalid image URL").max(2000),
});

export const setEmployeeProfileImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof setImageUrlInput>) => setImageUrlInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("admin") && !roles.includes("sub_admin")) {
      throw new Error("Forbidden: Only administrators can set employee profile pictures.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(data.targetUserId);
    const prevMeta = existingUser?.user?.user_metadata || {};

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      data.targetUserId,
      {
        user_metadata: {
          ...prevMeta,
          photo_url: data.photoUrl,
        },
      }
    );

    if (authUpdateError) {
      throw new Error("Failed to set profile photo URL: " + authUpdateError.message);
    }

    return { ok: true as const, photoUrl: data.photoUrl };
  });

