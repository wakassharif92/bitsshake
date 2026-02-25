import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      // Check if admin gate is enabled
      const { data: gateConfig } = await supabase
        .from("config")
        .select("value")
        .eq("key", "admin_gate_enabled")
        .single();

      const gateEnabled = gateConfig?.value === "true";

      if (gateEnabled) {
        // Check if user passed the gate
        const gateToken = localStorage.getItem("ehandshake_gate_token");
        if (gateToken !== "passed") {
          router.push("/admin-gate");
          return;
        }
      }

      // Check auth
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    };

    checkAccess();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
    </div>
  );
}
