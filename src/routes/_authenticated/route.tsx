import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: sessionData, error } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (error || !user) {
      if (location.pathname.startsWith("/admin")) {
        throw redirect({ to: "/admin-login" });
      }
      if (location.pathname.startsWith("/project")) {
        throw redirect({ to: "/sub-admin-login" });
      }
      throw redirect({ to: "/auth" });
    }

    if (location.pathname.startsWith("/admin")) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isDefaultAdmin = user.email?.toLowerCase() === "biadmin@bi-tracker.local";
      const isAdmin = (roleData ?? []).some((r: any) => r.role === "admin") || isDefaultAdmin;

      if (!isAdmin) {
        throw redirect({ to: "/dashboard" });
      }
    }

    return { user };
  },
  component: () => <Outlet />,
});
