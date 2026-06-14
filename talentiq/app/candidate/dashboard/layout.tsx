"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Sparkles, Award, HelpCircle, LogOut, Compass 
} from "lucide-react";

export default function CandidateSystemLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navigation = [
    { name: "My Career Deck", href: "/candidate/dashboard", icon: Compass },
    { name: "Interview Sandbox", href: "/candidate/dashboard", icon: HelpCircle }, // Map to conditional sections later
  ];

  return (
    <div className="flex min-h-screen bg-[#050711]">
      
      {/* LEFT STATIC CANDIDATE DOCK */}
      <aside className="w-64 border-r border-slate-900/60 bg-[#0a0d1d]/40 backdrop-blur-md hidden md:flex flex-col justify-between p-4 sticky top-0 h-screen z-20">
        <div className="space-y-8">
          {/* BRAND EMBLEM */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center border border-indigo-400/20 text-white shadow-lg shadow-indigo-600/10">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide uppercase">TalentIQ</h2>
              <span className="text-[9px] font-mono font-bold text-indigo-400 block tracking-wider uppercase">Career Co-Pilot</span>
            </div>
          </div>

          {/* ACTIVE NAV STREAM */}
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all group ${
                    isActive
                      ? "bg-indigo-600 text-white border border-indigo-400/20 shadow-lg shadow-indigo-600/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/40 border border-transparent"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-400 transition-colors"} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* LOGOUT BLOCK */}
        <div className="border-t border-slate-900/60 pt-4">
          <Link 
            href="/auth/login" 
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all group"
          >
            <LogOut size={16} className="text-slate-500 group-hover:text-red-400 transition-colors" />
            Sign Out
          </Link>
        </div>
      </aside>

      {/* BASE INGEST CONTAINER FEED */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>

    </div>
  );
}