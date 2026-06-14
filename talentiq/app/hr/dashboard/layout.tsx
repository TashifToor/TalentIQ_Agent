"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, ShieldCheck, UserCheck, 
  CreditCard, LogOut, Terminal 
} from "lucide-react";

export default function HRSystemLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard Console", href: "/hr/dashboard", icon: LayoutDashboard },
    { name: "Knowledge Vault (RAG)", href: "/hr/dashboard", icon: ShieldCheck }, // Map to respective sub-tabs or pages
    { name: "Billing & Credits", href: "/hr/billing-gate", icon: CreditCard },
  ];

  return (
    <div className="flex min-h-screen bg-[#060814]">
      
      {/* LEFT STATIC DOCK NAVIGATION */}
      <aside className="w-64 border-r border-slate-900 bg-[#0b0f19]/60 backdrop-blur-md hidden md:flex flex-col justify-between p-4 sticky top-0 h-screen z-20">
        <div className="space-y-8">
          {/* LOGO INDEX */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center border border-blue-400/20 text-white shadow-lg shadow-blue-600/10">
              <Terminal size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide uppercase">TalentIQ</h2>
              <span className="text-[9px] font-mono font-bold text-blue-400 block tracking-wider uppercase">Enterprise Core</span>
            </div>
          </div>

          {/* DOCK NAV ITERATION */}
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium font-sans tracking-wide transition-all group ${
                    isActive
                      ? "bg-blue-600 text-white border border-blue-400/20 shadow-lg shadow-blue-600/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/40 border border-transparent"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-white" : "text-slate-400 group-hover:text-blue-400 transition-colors"} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* TERMINATE ACTIONS / FOOTER */}
        <div className="border-t border-slate-900 pt-4 space-y-3">
          <Link 
            href="/auth/login" 
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all group"
          >
            <LogOut size={16} className="text-slate-500 group-hover:text-red-400 transition-colors" />
            Exit Console
          </Link>
          <div className="px-3 text-[9px] font-mono text-slate-600 tracking-wider">
            Node NodeCluster // Active-01
          </div>
        </div>
      </aside>

      {/* RENDER VIEW STREAM */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>

    </div>
  );
}