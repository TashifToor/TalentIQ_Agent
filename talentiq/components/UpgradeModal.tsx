"use client";
import { useState } from "react";
import { X, Zap, Building2, Check, Loader2, Crown, Lock } from "lucide-react";
import { getToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Props {
  isOpen:      boolean;
  onClose:     () => void;
  role:        "candidate" | "hr";
  reason?:     string;  // message to show why modal opened
}

export default function UpgradeModal({ isOpen, onClose, role, reason }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  if (!isOpen) return null;

  const plan = role === "candidate"
    ? { id: "candidate_pro", name: "Candidate Pro", price: "$9", period: "/month",
        icon: Zap, color: "text-g-400",
        features: ["Unlimited CV screenings", "Deep AI eligibility analysis", "Actionable skill gap feedback", "Priority AI processing"] }
    : { id: "hr_suite", name: "HR Suite", price: "$49", period: "/month",
        icon: Building2, color: "text-blue-400",
        features: ["Unlimited CV screening", "Deep candidate analysis", "HR Policy RAG chatbot", "Priority support", "Team access"] };

  const Icon = plan.icon;

  const handleUpgrade = async () => {
    setLoading(true); setError("");
    try {
      const token = getToken();
      const res = await fetch(`${BASE}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: plan.id }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail ?? "Checkout failed"); }
      const data = await res.json();
      window.location.href = data.checkout_url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md card rounded-2xl p-6 animate-scale-in">
        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 text-slate-600 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/5">
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl glass-gold flex items-center justify-center mb-4 animate-glow">
            <Lock size={22} className="text-g-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Upgrade to Continue</h2>
          {reason && (
            <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-sm">{reason}</p>
          )}
        </div>

        {/* Plan card */}
        <div className={`border rounded-2xl p-5 mb-5 ${
          role === "hr" ? "border-blue-500/25 bg-blue-500/5" : "border-g-500/25 bg-g-500/5"
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              role === "hr" ? "bg-blue-500/10 border-blue-500/20" : "glass-gold border-g-500/20"
            }`}>
              <Icon size={18} className={plan.color} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{plan.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{plan.price}</span>
                <span className="text-xs text-slate-500">{plan.period}</span>
              </div>
            </div>
          </div>

          <ul className="space-y-2">
            {plan.features.map(f => (
              <li key={f} className="flex items-center gap-2.5">
                <Check size={12} className="text-green-400 flex-shrink-0" />
                <span className="text-xs text-slate-400">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mb-4">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button onClick={handleUpgrade} disabled={loading}
          className="btn-gold w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm">
          {loading
            ? <><Loader2 size={14} className="animate-spin text-black" />Redirecting to payment...</>
            : <><Crown size={14} />Upgrade Now</>
          }
        </button>

        <p className="text-center text-[10px] text-slate-700 mt-3">
          Secure payment via Lemon Squeezy · Cancel anytime · No card data stored
        </p>
      </div>
    </div>
  );
}
