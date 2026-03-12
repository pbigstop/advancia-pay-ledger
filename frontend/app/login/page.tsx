"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@advancia-healthcare.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Check if already logged in
  useEffect(() => {
    if (localStorage.getItem("admin_token")) {
      router.push("/");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store token and user data
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("user_data", JSON.stringify(data.user));

      // Redirect to hub
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C14] flex flex-col items-center justify-center p-6 font-['Outfit',sans-serif] text-[#C8D8F0]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center animate-[fadeUp_0.4s_ease_forwards]">
          <div className="w-16 h-16 rounded-[20px] mx-auto mb-4 bg-gradient-to-br from-[#1A6BFF] to-[#7B5CF5] flex items-center justify-center shadow-[0_0_32px_rgba(26,107,255,0.25)]">
            <span className="text-3xl font-extrabold text-white">A</span>
          </div>
          <div className="text-2xl font-extrabold text-white tracking-wide">Advancia Pay Ledger</div>
          <div className="text-xs text-[#3D5273] mt-2 tracking-[2px] uppercase">Secure Access Portal</div>
        </div>

        {/* Login Form */}
        <div className="bg-[#0D1424] border border-[#1A2640] rounded-2xl p-8 shadow-2xl animate-[fadeUp_0.5s_ease_forwards]">
          <h2 className="text-lg font-bold text-white mb-6">Sign In to Continue</h2>
          
          {error && (
            <div className="mb-6 p-3 bg-[#FF3366]/10 border border-[#FF3366]/20 rounded-lg text-sm text-[#FF3366] text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#3D5273] tracking-wide mb-2">EMAIL ADDRESS</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111D30] border border-[#1A2640] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#1A6BFF] transition-colors"
                placeholder="name@facility.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[#3D5273] tracking-wide mb-2">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111D30] border border-[#1A2640] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#1A6BFF] transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-4 bg-gradient-to-br from-[#1A6BFF] to-[#0052CC] hover:from-[#1A6BFF] hover:to-[#1A6BFF] disabled:opacity-50 rounded-xl font-bold text-white transition-all transform active:scale-[0.98] shadow-[0_4px_14px_rgba(26,107,255,0.25)]"
            >
              {loading ? "Authenticating..." : "Secure Login"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#1A2640] text-center">
            <div className="text-[11px] text-[#3D5273] leading-relaxed">
              🔒 Protected by Advancia Enterprise Security<br/>
              HIPAA & PCI-DSS Compliant Infrastructure
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
