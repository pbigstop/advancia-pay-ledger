"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HubPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const userData = localStorage.getItem("user_data");
    
    if (!token) {
      router.push("/login");
      return;
    }
    
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error("Failed to parse user data");
      }
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("user_data");
    router.push("/login");
  };

  if (!user) return <div className="min-h-screen bg-[#080C14] flex items-center justify-center text-[#1A6BFF]">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#080C14] font-['Outfit',sans-serif] text-[#C8D8F0] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-6 border-b border-[#1A2640] bg-[#0D1424]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A6BFF] to-[#7B5CF5] flex items-center justify-center shadow-[0_0_20px_rgba(26,107,255,0.2)]">
            <span className="text-xl font-extrabold text-white">A</span>
          </div>
          <div>
            <div className="font-bold text-white text-lg">Advancia Hub</div>
            <div className="text-xs text-[#3D5273] uppercase tracking-wider">{user.facilityId || "System Admin"}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <div className="text-sm text-white font-medium">{user.firstName} {user.lastName}</div>
            <div className="text-xs text-[#3D5273] capitalize">{user.role}</div>
          </div>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 text-sm border border-[#1A2640] hover:bg-[#1A2640] rounded-lg transition-colors text-[#3D5273] hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 md:p-12 max-w-6xl mx-auto w-full">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {user.firstName}</h1>
          <p className="text-[#3D5273]">Select an application module to continue.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Module 1: Admin Streaming */}
          <Link href="/admin" className="group">
            <div className="h-full bg-[#0D1424] border border-[#1A2640] hover:border-[#1A6BFF] rounded-2xl p-6 transition-all transform hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(26,107,255,0.1)]">
              <div className="w-12 h-12 rounded-xl bg-[#1A6BFF]/10 flex items-center justify-center text-[#1A6BFF] mb-6 text-2xl group-hover:scale-110 transition-transform">
                📊
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Super Admin Stream</h2>
              <p className="text-sm text-[#3D5273] leading-relaxed mb-6">
                Real-time dashboard of all platform transactions, agent metrics, and live alerts.
              </p>
              <div className="flex items-center text-xs font-semibold text-[#1A6BFF] tracking-wide">
                ENTER MODULE <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>

          {/* Module 2: Trading Engine */}
          <Link href="/trading" className="group">
            <div className="h-full bg-[#0D1424] border border-[#1A2640] hover:border-[#00D68F] rounded-2xl p-6 transition-all transform hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,214,143,0.1)]">
              <div className="w-12 h-12 rounded-xl bg-[#00D68F]/10 flex items-center justify-center text-[#00D68F] mb-6 text-2xl group-hover:scale-110 transition-transform">
                📈
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Trading AI Engine</h2>
              <p className="text-sm text-[#3D5273] leading-relaxed mb-6">
                Manage automated trading bots, monitor portfolio risk, and review ML scanner signals.
              </p>
              <div className="flex items-center text-xs font-semibold text-[#00D68F] tracking-wide">
                ENTER MODULE <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>

          {/* Module 3: Withdrawals */}
          <Link href="/withdrawal" className="group">
            <div className="h-full bg-[#0D1424] border border-[#1A2640] hover:border-[#FF6B35] rounded-2xl p-6 transition-all transform hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(255,107,53,0.1)]">
              <div className="w-12 h-12 rounded-xl bg-[#FF6B35]/10 flex items-center justify-center text-[#FF6B35] mb-6 text-2xl group-hover:scale-110 transition-transform">
                💸
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Crypto Withdrawals</h2>
              <p className="text-sm text-[#3D5273] leading-relaxed mb-6">
                Execute secure on-chain settlements with 2FA, AML screening, and Fireblocks integration.
              </p>
              <div className="flex items-center text-xs font-semibold text-[#FF6B35] tracking-wide">
                ENTER MODULE <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
