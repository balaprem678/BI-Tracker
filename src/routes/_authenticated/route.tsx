import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      if (location.pathname.startsWith("/admin")) {
        throw redirect({ to: "/admin-login" });
      }
      if (location.pathname.startsWith("/project")) {
        throw redirect({ to: "/sub-admin-login" });
      }
      throw redirect({ to: "/auth" });
    }

    // Verify account is active in database
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile && (profile as any).is_active === false) {
      await supabase.auth.signOut();
      throw redirect({
        to: "/auth",
        search: { deactivated: "true" },
      });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
