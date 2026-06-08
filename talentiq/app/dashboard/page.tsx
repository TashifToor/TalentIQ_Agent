// app/dashboard/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getRole } from "@/lib/api";

export default function RootDashboardRedirector() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const role = getRole();

    if (!token) {
      router.replace("/login");
      return;
    }

    // Role ke mutabiq sahi dashboard par bhejo
    if (role === "hr") {
      router.replace("/hr/dashboard");
    } else if (role === "candidate") {
      router.replace("/candidate/dashboard");
    } else {
      router.replace("/login"); // Kuch gadbad ho toh login par wapis
    }
  }, [router]);

  return (
    <div className="h-screen bg-[#060814] flex items-center justify-center text-xs text-slate-400 font-mono">
      Routing session workspace...
    </div>
  );
}