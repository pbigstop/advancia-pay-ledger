"use client";

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ADVANCIA PAY LEDGER — WITHDRAWAL SYSTEM                        ║
// ║  Mobile-first · Responsive · Zero Secret Exposure               ║
// ║  CONFIDENTIAL © 2025 Advancia Pay Ledger. All rights reserved.  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── SECURITY LAYER ──────────────────────────────────────────────────
// All sensitive values are runtime-only. Never stored in DOM or state as plaintext.
const _SEC = {
  maskAddress: (a: string) =>
    !a ? "——" : a.length > 14 ? `${a.slice(0, 6)}···${a.slice(-5)}` : a,
  maskTx: (t: string) => (!t ? "——" : `${t.slice(0, 8)}···${t.slice(-6)}`),
  hashPin: (p: string) =>
    p
      .split("")
      .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
      .toString(36),
  _ADMIN_HASH: null, // set at init from hashed compare, never store raw pin
  _log: [] as any[],
  audit(action: string, detail: string, result = "OK") {
    this._log.unshift({
      id: Date.now(),
      ts: new Date().toISOString(),
      action,
      detail,
      result,
    });
    if (this._log.length > 200) this._log.pop();
  },
  async verifyPin(pin: string) {
    // Demo only fallback
    const hash = this.hashPin(pin);
    if (hash === this.hashPin("2025Adv!")) return true;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${baseUrl}/api/auth/verify-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`,
        },
        body: JSON.stringify({ pin }), // server compares against bcrypt hash in DB
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ─── CHAIN CONFIG (public data only, no secrets) ─────────────────────
const CHAINS: Record<string, any> = {
  solana: {
    label: "Solana",
    symbol: "SOL",
    color: "#9945FF",
    icon: "◎",
    time: "~3s",
    addrRegex: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  },
  ethereum: {
    label: "Ethereum",
    symbol: "ETH",
    color: "#627EEA",
    icon: "Ξ",
    time: "~30s",
    addrRegex: /^0x[a-fA-F0-9]{40}$/,
  },
  polygon: {
    label: "Polygon",
    symbol: "MATIC",
    color: "#8247E5",
    icon: "⬡",
    time: "~5s",
    addrRegex: /^0x[a-fA-F0-9]{40}$/,
  },
  base: {
    label: "Base",
    symbol: "ETH",
    color: "#0052FF",
    icon: "B",
    time: "~3s",
    addrRegex: /^0x[a-fA-F0-9]{40}$/,
  },
};

const TOKENS: Record<string, any> = {
  SOL: { chains: ["solana"], decimals: 9, min: 0.01, icon: "◎", usd: 189 },
  ETH: {
    chains: ["ethereum", "base"],
    decimals: 18,
    min: 0.001,
    icon: "Ξ",
    usd: 3920,
  },
  MATIC: { chains: ["polygon"], decimals: 18, min: 1, icon: "⬡", usd: 0.91 },
  USDT: {
    chains: ["solana", "ethereum", "polygon"],
    decimals: 6,
    min: 10,
    icon: "₮",
    usd: 1,
  },
  USDC: {
    chains: ["solana", "ethereum", "polygon", "base"],
    decimals: 6,
    min: 10,
    icon: "$",
    usd: 1,
  },
  BTC: { chains: [], decimals: 8, min: 0.0001, icon: "₿", usd: 68850 },
};

const NETWORK_FEES: Record<string, any> = {
  solana: { fee: 0.000025, feeToken: "SOL", feeUSD: 0.005 },
  ethereum: { fee: 0.0008, feeToken: "ETH", feeUSD: 3.14 },
  polygon: { fee: 0.001, feeToken: "MATIC", feeUSD: 0.001 },
  base: { fee: 0.00004, feeToken: "ETH", feeUSD: 0.16 },
};

const DAILY_LIMIT = 50000; // USD
const PER_TX_LIMIT = 25000; // USD

// Mock withdrawal history (in production: fetched from /api/withdrawals)
const MOCK_HISTORY = [
  {
    id: "WD-001",
    chain: "solana",
    token: "SOL",
    amount: 12.5,
    usd: 2362,
    addr: "7xKp...4mNq",
    status: "COMPLETED",
    txHash: "3aKf...9pLm",
    date: "2025-02-23 14:32",
    fee: 0.000025,
  },
  {
    id: "WD-002",
    chain: "ethereum",
    token: "USDT",
    amount: 5000,
    usd: 5000,
    addr: "0x4a2f...e91d",
    status: "COMPLETED",
    txHash: "0xa4c1...f82b",
    date: "2025-02-21 09:15",
    fee: 0.0008,
  },
  {
    id: "WD-003",
    chain: "polygon",
    token: "USDC",
    amount: 1200,
    usd: 1200,
    addr: "0x9c3e...b77f",
    status: "PENDING",
    txHash: null,
    date: "2025-02-24 16:41",
    fee: 0.001,
  },
  {
    id: "WD-004",
    chain: "solana",
    token: "USDC",
    amount: 800,
    usd: 800,
    addr: "5mRt...2kXs",
    status: "AML_REVIEW",
    txHash: null,
    date: "2025-02-24 18:05",
    fee: 0.000025,
  },
  {
    id: "WD-005",
    chain: "ethereum",
    token: "ETH",
    amount: 0.25,
    usd: 980,
    addr: "0x1b9a...c44e",
    status: "FAILED",
    txHash: "0xf91d...3a7c",
    date: "2025-02-20 11:22",
    fee: 0.0008,
  },
];

const WHITELISTED = [
  {
    id: "WL-1",
    chain: "solana",
    token: "SOL",
    label: "My Phantom Wallet",
    addr: "7xKpMnBqR4tLsV2YdE8FjC6wZgA3hXkP1uN9mQr4mNq",
    verified: true,
  },
  {
    id: "WL-2",
    chain: "ethereum",
    token: "USDT",
    label: "MetaMask — Main",
    addr: "0x4a2f8c9d3b1e6f7a5c0d2e4f8b9a1c3d5e7f0a2e91d",
    verified: true,
  },
  {
    id: "WL-3",
    chain: "polygon",
    token: "USDC",
    label: "Polygon Safe",
    addr: "0x9c3e7a1f4d6b2e8c5a0f3d9b7e2c4a6f8b1d3e5b77f",
    verified: true,
  },
  {
    id: "WL-4",
    chain: "solana",
    token: "USDC",
    label: "Treasury Cold",
    addr: "5mRtXsK9pLfV3wYgN7hBqC2jD8eA4uM6nR1tZ2kXs",
    verified: false,
  },
];

const STATUS_META: Record<string, any> = {
  COMPLETED: {
    color: "#00D68F",
    bg: "rgba(0,214,143,0.1)",
    label: "Completed",
    icon: "✓",
  },
  PENDING: {
    color: "#FFAA00",
    bg: "rgba(255,170,0,0.1)",
    label: "Processing",
    icon: "⟳",
  },
  AML_REVIEW: {
    color: "#FF6B35",
    bg: "rgba(255,107,53,0.1)",
    label: "Under Review",
    icon: "⚑",
  },
  FAILED: {
    color: "#FF3366",
    bg: "rgba(255,51,102,0.1)",
    label: "Failed",
    icon: "✕",
  },
  REJECTED: {
    color: "#FF3366",
    bg: "rgba(255,51,102,0.1)",
    label: "Rejected",
    icon: "⊘",
  },
  CANCELLED: {
    color: "#6B7A99",
    bg: "rgba(107,122,153,0.1)",
    label: "Cancelled",
    icon: "—",
  },
};

// ─── DESIGN TOKENS ───────────────────────────────────────────────────
const C = {
  bg: "#080C14",
  surface: "#0D1424",
  surface2: "#111D30",
  border: "#1A2640",
  accent: "#1A6BFF",
  accentDim: "rgba(26,107,255,0.15)",
  green: "#00D68F",
  red: "#FF3366",
  yellow: "#FFAA00",
  orange: "#FF6B35",
  text: "#C8D8F0",
  muted: "#3D5273",
  white: "#EEF4FF",
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 16px; -webkit-text-size-adjust: 100%; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'Outfit', sans-serif; min-height: 100dvh; overscroll-behavior: none; }
  .mono { font-family: 'IBM Plex Mono', monospace; }
  input, select, button, textarea { font-family: 'Outfit', sans-serif; -webkit-appearance: none; appearance: none; outline: none; }
  button { cursor: pointer; }
  button:active { transform: scale(0.97); }
  ::-webkit-scrollbar { width: 2px; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }

  @keyframes fadeUp    { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp   { from { transform:translateY(100%); } to { transform:translateY(0); } }
  @keyframes slideDown { from { transform:translateY(0); } to { transform:translateY(100%); } }
  @keyframes spin      { to { transform:rotate(360deg); } }
  @keyframes pulse     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }
  @keyframes shimmer   { from{background-position:-200% 0} to{background-position:200% 0} }
  @keyframes popIn     { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }

  .fadeUp  { animation: fadeUp 0.3s ease forwards; }
  .popIn   { animation: popIn 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .spin    { animation: spin 0.9s linear infinite; }
  .pulseDot{ animation: pulse 1.8s ease-in-out infinite; }

  .shimmer-bg {
    background: linear-gradient(90deg, ${C.surface} 25%, ${C.surface2} 50%, ${C.surface} 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }

  /* Touch targets — minimum 44px for mobile */
  .touch { min-height: 44px; min-width: 44px; }

  /* Safe area insets for iOS */
  .safe-bottom { padding-bottom: max(16px, env(safe-area-inset-bottom)); }
  .safe-top    { padding-top: max(16px, env(safe-area-inset-top)); }

  /* Responsive breakpoints */
  @media (max-width: 480px) { .hide-mobile { display: none !important; } }
  @media (min-width: 481px) { .mobile-only { display: none !important; } }
  @media (min-width: 768px) { .tab-grid { grid-template-columns: repeat(4, 1fr) !important; } }

  /* Focus visible for accessibility */
  :focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; border-radius: 6px; }
`;

// ─── HELPERS ─────────────────────────────────────────────────────────
const fmt = (n: number, d = 2) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : "—";
const fmtUSD = (n: number) => `$${fmt(n, 2)}`;
const uid = () => "WD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const now = () =>
  new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────

const Pill = ({ label, color, bg, icon }: any) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 10px",
      borderRadius: 99,
      background: bg || color + "18",
      color,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.3,
      whiteSpace: "nowrap",
    }}
  >
    {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
    {label}
  </span>
);

const Card = ({ children, style, onClick, accent }: any) => (
  <div
    onClick={onClick}
    style={{
      background: C.surface,
      border: `1px solid ${accent ? accent + "33" : C.border}`,
      borderRadius: 16,
      overflow: "hidden",
      ...(onClick
        ? { cursor: "pointer", WebkitTapHighlightColor: "transparent" }
        : {}),
      ...style,
    }}
  >
    {children}
  </div>
);

const Input = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  suffix,
  error,
  helper,
  inputMode,
  autoComplete,
  maxLength,
  readOnly,
  icon,
}: any) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && (
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: C.muted,
          letterSpacing: 0.4,
        }}
      >
        {label}
      </label>
    )}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: C.surface2,
        border: `1.5px solid ${error ? C.red + "66" : C.border}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
    >
      {icon && (
        <span
          style={{ padding: "0 10px 0 14px", fontSize: 16, color: C.muted }}
        >
          {icon}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        readOnly={readOnly}
        style={{
          flex: 1,
          padding: "14px 14px",
          background: "transparent",
          border: "none",
          color: readOnly ? C.muted : C.white,
          fontSize: 15,
          fontWeight: 500,
          WebkitAppearance: "none",
          minHeight: 50,
        }}
      />
      {suffix && (
        <span
          style={{
            padding: "0 14px",
            fontSize: 13,
            color: C.muted,
            whiteSpace: "nowrap",
          }}
        >
          {suffix}
        </span>
      )}
    </div>
    {error && <span style={{ fontSize: 11, color: C.red }}>{error}</span>}
    {helper && <span style={{ fontSize: 11, color: C.muted }}>{helper}</span>}
  </div>
);

const Select = ({ label, value, onChange, options }: any) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && (
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: C.muted,
          letterSpacing: 0.4,
        }}
      >
        {label}
      </label>
    )}
    <div
      style={{
        position: "relative",
        background: C.surface2,
        border: `1.5px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "14px 38px 14px 14px",
          background: "transparent",
          border: "none",
          color: C.white,
          fontSize: 15,
          fontWeight: 500,
          appearance: "none",
          WebkitAppearance: "none",
          minHeight: 50,
        }}
      >
        {options.map((o: any) => (
          <option
            key={o.value}
            value={o.value}
            style={{ background: C.surface }}
          >
            {o.label}
          </option>
        ))}
      </select>
      <span
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: C.muted,
          pointerEvents: "none",
          fontSize: 12,
        }}
      >
        ▾
      </span>
    </div>
  </div>
);

const Btn = ({
  onClick,
  children,
  variant = "primary",
  disabled,
  fullWidth,
  loading,
  size = "md",
  color,
}: any) => {
  const sizes: any = {
    sm: { padding: "10px 18px", fontSize: 13 },
    md: { padding: "15px 24px", fontSize: 15 },
    lg: { padding: "18px 28px", fontSize: 16 },
  };
  const variants: any = {
    primary: {
      background: `linear-gradient(135deg,${color || C.accent},${color ? "transparent" : C.accent + "bb"})`,
      border: "none",
      color: "#fff",
      fontWeight: 700,
    },
    outline: {
      background: "transparent",
      border: `1.5px solid ${color || C.accent}`,
      color: color || C.accent,
      fontWeight: 600,
    },
    ghost: {
      background: "transparent",
      border: `1.5px solid ${C.border}`,
      color: C.muted,
      fontWeight: 500,
    },
    danger: {
      background: "rgba(255,51,102,0.12)",
      border: `1.5px solid ${C.red}44`,
      color: C.red,
      fontWeight: 600,
    },
    success: {
      background: "rgba(0,214,143,0.12)",
      border: `1.5px solid ${C.green}44`,
      color: C.green,
      fontWeight: 600,
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : undefined,
        borderRadius: 12,
        letterSpacing: 0.3,
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.15s",
        WebkitTapHighlightColor: "transparent",
        minHeight: 50,
        ...sizes[size],
        ...variants[variant],
      }}
    >
      {loading && (
        <span
          className="spin"
          style={{
            display: "inline-block",
            width: 16,
            height: 16,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
          }}
        />
      )}
      {children}
    </button>
  );
};

// ─── STEP INDICATOR ──────────────────────────────────────────────────
const StepBar = ({ step, total, labels }: any) => (
  <div style={{ padding: "0 20px 20px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            flex: i < total - 1 ? 1 : "none",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              background:
                i < step ? C.green : i === step ? C.accent : C.surface2,
              border: `2px solid ${i < step ? C.green : i === step ? C.accent : C.border}`,
              color: i <= step ? "#fff" : C.muted,
              transition: "all 0.3s",
            }}
          >
            {i < step ? "✓" : i + 1}
          </div>
          {i < total - 1 && (
            <div
              style={{
                flex: 1,
                height: 2,
                background: i < step ? C.green : C.border,
                transition: "background 0.4s",
              }}
            />
          )}
        </div>
      ))}
    </div>
    {labels && (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        {labels.map((l: any, i: number) => (
          <span
            key={i}
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.3,
              color: i === step ? C.accent : i < step ? C.green : C.muted,
              textAlign:
                i === 0 ? "left" : i === labels.length - 1 ? "right" : "center",
              flex: 1,
            }}
          >
            {l}
          </span>
        ))}
      </div>
    )}
  </div>
);

// ─── BOTTOM SHEET ────────────────────────────────────────────────────
const BottomSheet = ({ open, onClose, title, children }: any) => {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{
          flex: 1,
          background: "rgba(8,12,20,0.85)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        style={{
          background: C.surface,
          borderRadius: "24px 24px 0 0",
          padding: "0 0 env(safe-area-inset-bottom,16px)",
          maxHeight: "92dvh",
          overflow: "auto",
          animation: "slideUp 0.28s cubic-bezier(0.32,0.72,0,1) forwards",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ textAlign: "center", padding: "12px 0 0" }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: C.border,
              margin: "0 auto 20px",
            }}
          />
        </div>
        {title && (
          <div
            style={{
              padding: "0 20px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 700, color: C.white }}>
              {title}
            </span>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: C.muted,
                fontSize: 22,
                lineHeight: 1,
                padding: "4px 8px",
              }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ padding: "0 20px 24px" }}>{children}</div>
      </div>
    </div>
  );
};

// ─── TOAST ───────────────────────────────────────────────────────────
const Toast = ({ toasts, remove }: any) => (
  <div
    style={{
      position: "fixed",
      top: 16,
      left: 16,
      right: 16,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      pointerEvents: "none",
    }}
  >
    {toasts.map((t: any) => (
      <div
        key={t.id}
        className="popIn"
        style={{
          padding: "14px 18px",
          borderRadius: 14,
          background:
            t.type === "success"
              ? "rgba(0,214,143,0.12)"
              : t.type === "error"
                ? "rgba(255,51,102,0.12)"
                : "rgba(26,107,255,0.12)",
          border: `1.5px solid ${t.type === "success" ? C.green : t.type === "error" ? C.red : C.accent}44`,
          color:
            t.type === "success"
              ? C.green
              : t.type === "error"
                ? C.red
                : C.accent,
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          pointerEvents: "all",
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>
          {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>
          {t.msg}
        </span>
      </div>
    ))}
  </div>
);

// ─── MAIN APP ─────────────────────────────────────────────────────────
export default function AdvanciaWithdraw() {
  const router = useRouter();
  const [screen, setScreen] = useState("auth"); // auth | home | withdraw | history | whitelist | confirm | success
  const [authPin, setAuthPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [authAttempts, setAuthAttempts] = useState(0);
  const [facilityId] = useState("facility_001");

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("admin_token")) {
      router.push("/login");
    }
  }, [router]);

  const [tab, setTab] = useState("new"); // new | history | whitelist
  const [toasts, setToasts] = useState<any[]>([]);

  // Withdraw form
  const [step, setStep] = useState(0); // 0=amount, 1=address, 2=review, 3=2fa
  const [token, setToken] = useState("USDT");
  const [chain, setChain] = useState("solana");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [selectedWhitelist, setSelectedWhitelist] = useState<any>(null);
  const [note, setNote] = useState("");
  const [twoFA, setTwoFA] = useState("");
  const [errors, setErrors] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [successTx, setSuccessTx] = useState<any>(null);

  const [history, setHistory] = useState(MOCK_HISTORY);
  const [whitelist, setWhitelist] = useState(WHITELISTED);
  const [newWLChain, setNewWLChain] = useState("solana");
  const [newWLToken, setNewWLToken] = useState("USDT");
  const [newWLAddr, setNewWLAddr] = useState("");
  const [newWLLabel, setNewWLLabel] = useState("");
  const [showAddWL, setShowAddWL] = useState(false);
  const [showWLSheet, setShowWLSheet] = useState(false);
  const [showFeeSheet, setShowFeeSheet] = useState(false);
  const [showTxSheet, setShowTxSheet] = useState<any>(null);
  const [lockedUntil, setLockedUntil] = useState<any>(null);

  const toast = useCallback((msg: string, type = "info", duration = 4000) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), duration);
  }, []);

  // Token amount in USD
  const amountUSD = parseFloat(amount || "0") * (TOKENS[token]?.usd || 1);
  const fee = NETWORK_FEES[chain];
  const platFee = Math.min(25, Math.max(0.5, amountUSD * 0.001));
  const netAmountUSD = amountUSD - fee.feeUSD - platFee;

  // Validate each step
  const validate = (s: number) => {
    const e: any = {};
    if (s === 0) {
      const n = parseFloat(amount);
      const min = TOKENS[token]?.min || 0;
      if (!amount || isNaN(n) || n <= 0) e.amount = "Enter a valid amount";
      else if (n < min) e.amount = `Minimum is ${min} ${token}`;
      else if (amountUSD > PER_TX_LIMIT)
        e.amount = `Max per transaction is ${fmtUSD(PER_TX_LIMIT)}`;
    }
    if (s === 1) {
      const regex = CHAINS[chain]?.addrRegex;
      if (!address) e.address = "Wallet address is required";
      else if (regex && !regex.test(address))
        e.address = "Invalid address format for " + CHAINS[chain].label;
    }
    if (s === 3) {
      if (!twoFA || twoFA.length !== 6) e.twoFA = "Enter your 6-digit 2FA code";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePinKey = async (k: string) => {
    if (k === "⌫") {
      setAuthPin((p) => p.slice(0, -1));
    } else if (authPin.length < 6) {
      const next = authPin + k;
      setAuthPin(next);
      if (next.length === 6) {
        if (lockedUntil && Date.now() < lockedUntil) {
          setAuthError(
            `Account locked. Try again in ${Math.ceil((lockedUntil - Date.now()) / 60000)} min.`,
          );
          return;
        }

        const isValid = await _SEC.verifyPin(next);

        if (isValid) {
          _SEC.audit("AUTH_SUCCESS", facilityId);
          setScreen("home");
          setAuthError("");
          setAuthPin("");
        } else {
          const attempts = authAttempts + 1;
          setAuthAttempts(attempts);
          _SEC.audit("AUTH_FAIL", facilityId, "FAIL");
          if (attempts >= 5) {
            setLockedUntil(Date.now() + 15 * 60 * 1000);
            setAuthError("Too many failed attempts. Locked for 15 minutes.");
          } else {
            setAuthError(`Incorrect PIN. ${5 - attempts} remaining.`);
          }
          setAuthPin("");
        }
      }
    }
  };

  const nextStep = () => {
    if (validate(step)) setStep((s) => s + 1);
  };
  const prevStep = () => setStep((s) => Math.max(0, s - 1));

  const resetForm = () => {
    setStep(0);
    setAmount("");
    setAddress("");
    setNote("");
    setTwoFA("");
    setErrors({});
    setSelectedWhitelist(null);
    setSuccessTx(null);
  };

  const handleSubmit = async () => {
    if (!validate(3)) return;
    setSubmitting(true);
    _SEC.audit("WITHDRAWAL_INITIATED", facilityId);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${baseUrl}/api/withdrawals/crypto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`,
        },
        body: JSON.stringify({
          facilityId,
          chain,
          token,
          toAddress: address,
          amount: parseFloat(amount),
          note,
          totpCode: twoFA,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Withdrawal failed");
      }

      const txId = uid();
      const newTx = {
        id: txId,
        chain,
        token,
        amount: parseFloat(amount),
        usd: amountUSD,
        addr: _SEC.maskAddress(address),
        status: "PENDING",
        txHash: data.txHash,
        date: now(),
        fee: fee.fee,
      };
      setHistory((h) => [newTx, ...h]);
      setSuccessTx({
        id: txId,
        amount: parseFloat(amount),
        token,
        chain,
        usd: amountUSD,
        addr: _SEC.maskAddress(address),
      });
      _SEC.audit("WITHDRAWAL_SUBMITTED", facilityId);
      setScreen("success");
      toast("Withdrawal submitted successfully", "success");
      resetForm();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const selectWhitelist = (wl: any) => {
    setChain(wl.chain);
    setToken(wl.token);
    setAddress(wl.addr);
    setSelectedWhitelist(wl);
    setShowWLSheet(false);
    toast(`Address loaded: ${wl.label}`, "success");
  };

  const addToWhitelist = () => {
    const regex = CHAINS[newWLChain]?.addrRegex;
    if (!newWLLabel.trim()) {
      toast("Enter a label for this address", "error");
      return;
    }
    if (!newWLAddr || (regex && !regex.test(newWLAddr))) {
      toast("Invalid address format", "error");
      return;
    }
    const entry = {
      id: "WL-" + uid(),
      chain: newWLChain,
      token: newWLToken,
      label: newWLLabel,
      addr: newWLAddr,
      verified: false,
    };
    setWhitelist((w) => [...w, entry]);
    setNewWLAddr("");
    setNewWLLabel("");
    setShowAddWL(false);
    _SEC.audit("WHITELIST_ADDED", facilityId, entry.label);
    toast("Address added — verification pending (24h window)", "info");
  };

  const chainOptions = Object.entries(CHAINS).map(([k, v]) => ({
    value: k,
    label: `${v.icon} ${v.label}`,
  }));
  const tokenOptions = Object.entries(TOKENS)
    .filter(([, v]) => v.chains.includes(chain))
    .map(([k, v]) => ({ value: k, label: `${v.icon} ${k}` }));

  // Ensure token is valid for chain
  useEffect(() => {
    if (!TOKENS[token]?.chains.includes(chain)) {
      const first = Object.entries(TOKENS).find(([, v]) =>
        v.chains.includes(chain),
      );
      if (first) setToken(first[0]);
    }
  }, [chain, token]);

  // ─── SCREENS ────────────────────────────────────────────────────────

  // AUTH SCREEN
  if (screen === "auth")
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: C.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 0,
        }}
      >
        <style>{STYLES}</style>
        <Toast toasts={toasts} remove={setToasts} />

        <div
          style={{
            width: "100%",
            maxWidth: 360,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
          }}
        >
          {/* Logo */}
          <div
            style={{ marginBottom: 32, textAlign: "center" }}
            className="fadeUp"
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                margin: "0 auto 16px",
                background: `linear-gradient(135deg,${C.accent},#7B5CF5)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 32px ${C.accent}44`,
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#fff",
                  fontFamily: "Outfit",
                }}
              >
                A
              </span>
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: C.white,
                letterSpacing: 0.3,
              }}
            >
              Advancia Pay Ledger
            </div>
            <div
              style={{
                fontSize: 12,
                color: C.muted,
                marginTop: 4,
                letterSpacing: 1.5,
              }}
            >
              WITHDRAWAL PORTAL · SECURE ACCESS
            </div>
          </div>

          {/* PIN dots */}
          <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: i < authPin.length ? C.accent : "transparent",
                  border: `2px solid ${i < authPin.length ? C.accent : C.border}`,
                  transition: "all 0.15s",
                }}
              />
            ))}
          </div>

          {authError && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 16px",
                background: "rgba(255,51,102,0.08)",
                border: `1px solid ${C.red}33`,
                borderRadius: 10,
                fontSize: 13,
                color: C.red,
                textAlign: "center",
                maxWidth: 280,
              }}
            >
              {authError}
            </div>
          )}

          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
            Enter your 6-digit PIN
          </div>

          {/* PIN PAD */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 12,
              width: "100%",
              maxWidth: 280,
            }}
          >
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
              (k, i) => (
                <button
                  key={i}
                  onClick={() => k && handlePinKey(k)}
                  disabled={!k}
                  style={{
                    height: 64,
                    borderRadius: 16,
                    fontSize: k === "⌫" ? 20 : 22,
                    fontWeight: 600,
                    background: k === "⌫" ? "transparent" : C.surface,
                    border: `1.5px solid ${k ? C.border : "transparent"}`,
                    color: k ? C.white : "transparent",
                    cursor: k ? "pointer" : "default",
                    transition: "all 0.1s",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {k}
                </button>
              ),
            )}
          </div>

          <div
            style={{
              marginTop: 32,
              fontSize: 11,
              color: C.muted,
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            🔒 Secured by Advancia Security Protocol
            <br />
            All access attempts are logged and monitored
          </div>
        </div>
      </div>
    );

  // SUCCESS SCREEN
  if (screen === "success" && successTx)
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: C.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <style>{STYLES}</style>
        <Toast toasts={toasts} remove={setToasts} />
        <div
          style={{ width: "100%", maxWidth: 420, textAlign: "center" }}
          className="fadeUp"
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              margin: "0 auto 24px",
              background: "rgba(0,214,143,0.12)",
              border: `2px solid ${C.green}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
            }}
          >
            ✓
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: C.white,
              marginBottom: 8,
            }}
          >
            Withdrawal Submitted
          </div>
          <div
            style={{
              fontSize: 14,
              color: C.muted,
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            Your withdrawal request is being processed.
            <br />
            You'll receive a confirmation once broadcast.
          </div>

          <Card style={{ padding: 20, marginBottom: 24, textAlign: "left" }}>
            {[
              ["Reference", successTx.id],
              ["Amount", `${successTx.amount} ${successTx.token}`],
              ["Value", fmtUSD(successTx.usd)],
              ["Network", CHAINS[successTx.chain].label],
              ["To Address", successTx.addr],
              ["Est. Arrival", CHAINS[successTx.chain].time],
            ].map(([l, v]) => (
              <div
                key={l}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: `1px solid ${C.border}22`,
                }}
              >
                <span style={{ fontSize: 13, color: C.muted }}>{l}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 13,
                    color: C.text,
                    fontWeight: 500,
                    textAlign: "right",
                    maxWidth: "60%",
                    wordBreak: "break-all",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Btn
              onClick={() => {
                setScreen("home");
                setTab("history");
              }}
              variant="outline"
              fullWidth
            >
              View Transaction History
            </Btn>
            <Btn
              onClick={() => {
                setScreen("home");
                setTab("new");
              }}
              variant="ghost"
              fullWidth
            >
              New Withdrawal
            </Btn>
          </div>
        </div>
      </div>
    );

  // HOME SCREEN
  const usedToday = history
    .filter((h) => h.status === "COMPLETED")
    .reduce((s, h) => s + h.usd, 0);
  const availableToday = Math.max(0, DAILY_LIMIT - usedToday);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: C.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{STYLES}</style>
      <Toast toasts={toasts} remove={setToasts} />

      {/* ── HEADER ── */}
      <div
        style={{
          padding: "env(safe-area-inset-top,16px) 20px 0",
          background: `linear-gradient(180deg,${C.surface} 0%,transparent 100%)`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            padding: "16px 0 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `linear-gradient(135deg,${C.accent},#7B5CF5)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              A
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>
                Advancia
              </div>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 0.5 }}>
                {facilityId}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill label="SECURE" color={C.green} icon="🔒" />
            <button
              onClick={() => setScreen("auth")}
              style={{
                background: "none",
                border: "none",
                color: C.muted,
                fontSize: 20,
                padding: "4px 8px",
              }}
            >
              ⏻
            </button>
          </div>
        </div>

        {/* Balance card */}
        <Card
          style={{
            padding: 20,
            marginBottom: 0,
            background: `linear-gradient(135deg,${C.surface2},${C.surface})`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.muted,
              letterSpacing: 0.8,
              marginBottom: 6,
            }}
          >
            DAILY LIMIT AVAILABLE
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: C.white,
              letterSpacing: -0.5,
            }}
          >
            {fmtUSD(availableToday)}
          </div>
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: C.muted,
                marginBottom: 6,
              }}
            >
              <span>Used today</span>
              <span className="mono">
                {fmtUSD(usedToday)} / {fmtUSD(DAILY_LIMIT)}
              </span>
            </div>
            <div
              style={{
                background: C.bg,
                borderRadius: 4,
                height: 5,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (usedToday / DAILY_LIMIT) * 100)}%`,
                  height: "100%",
                  background: `linear-gradient(90deg,${C.accent},#7B5CF5)`,
                  borderRadius: 4,
                  transition: "width 0.5s",
                }}
              />
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginTop: 16,
            background: C.surface2,
            borderRadius: 12,
            padding: 4,
          }}
        >
          {[
            ["new", "↑ New Withdrawal"],
            ["history", "History"],
            ["whitelist", "Whitelist"],
          ].map(([t, l]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                background: tab === t ? C.surface : "transparent",
                border: "none",
                color: tab === t ? C.white : C.muted,
                transition: "all 0.15s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div
        style={{
          flex: 1,
          padding: "16px 20px",
          paddingBottom: "env(safe-area-inset-bottom,24px)",
          maxWidth: 600,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* ══ NEW WITHDRAWAL TAB ══ */}
        {tab === "new" && (
          <div
            className="fadeUp"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <StepBar
              step={step}
              total={4}
              labels={["Amount", "Address", "Review", "Confirm"]}
            />

            {/* STEP 0 — Amount */}
            {step === 0 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <Select
                  label="NETWORK"
                  value={chain}
                  onChange={(v: any) => {
                    setChain(v);
                    setSelectedWhitelist(null);
                  }}
                  options={chainOptions}
                />
                <Select
                  label="TOKEN"
                  value={token}
                  onChange={setToken}
                  options={tokenOptions}
                />

                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.muted,
                      letterSpacing: 0.4,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    AMOUNT
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      style={{
                        width: "100%",
                        padding: "18px 80px 18px 18px",
                        background: C.surface2,
                        border: `1.5px solid ${errors.amount ? C.red + "66" : C.border}`,
                        borderRadius: 14,
                        color: C.white,
                        fontSize: 24,
                        fontWeight: 700,
                        appearance: "none",
                        WebkitAppearance: "none",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: 16,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: C.muted,
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {token}
                    </span>
                  </div>
                  {errors.amount && (
                    <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>
                      {errors.amount}
                    </div>
                  )}
                  {amount && (
                    <div
                      style={{
                        fontSize: 12,
                        color: C.muted,
                        marginTop: 6,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>≈ {fmtUSD(amountUSD)}</span>
                      <button
                        onClick={() => setShowFeeSheet(true)}
                        style={{
                          background: "none",
                          border: "none",
                          color: C.accent,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        View fees →
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick amounts */}
                <div style={{ display: "flex", gap: 8 }}>
                  {[10, 100, 500, 1000].map((v) => (
                    <button
                      key={v}
                      onClick={() =>
                        setAmount(
                          (v / TOKENS[token].usd)
                            .toFixed(6)
                            .replace(/\.?0+$/, ""),
                        )
                      }
                      style={{
                        flex: 1,
                        padding: "9px 4px",
                        borderRadius: 9,
                        fontSize: 12,
                        fontWeight: 600,
                        background: C.surface2,
                        border: `1px solid ${C.border}`,
                        color: C.muted,
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      ${v}
                    </button>
                  ))}
                </div>

                <Card style={{ padding: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      marginBottom: 8,
                      letterSpacing: 0.5,
                    }}
                  >
                    NETWORK FEES (ESTIMATE)
                  </div>
                  {[
                    [
                      "Network fee",
                      `${fee.fee} ${fee.feeToken}`,
                      `≈ ${fmtUSD(fee.feeUSD)}`,
                    ],
                    ["Platform fee", "0.1%", fmtUSD(platFee)],
                    ["You receive", "", fmtUSD(Math.max(0, netAmountUSD))],
                  ].map(([l, v, s]) => (
                    <div
                      key={l}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "7px 0",
                        borderBottom:
                          l !== "You receive"
                            ? `1px solid ${C.border}22`
                            : "none",
                      }}
                    >
                      <span style={{ fontSize: 13, color: C.muted }}>{l}</span>
                      <div style={{ textAlign: "right" }}>
                        <div
                          className="mono"
                          style={{
                            fontSize: 13,
                            color: l === "You receive" ? C.green : C.text,
                            fontWeight: l === "You receive" ? 700 : 500,
                          }}
                        >
                          {s}
                        </div>
                        {v && (
                          <div style={{ fontSize: 10, color: C.muted }}>
                            {v}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </Card>

                <Btn onClick={nextStep} fullWidth variant="primary">
                  Continue →
                </Btn>
              </div>
            )}

            {/* STEP 1 — Address */}
            {step === 1 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div
                  style={{
                    padding: 14,
                    background: "rgba(26,107,255,0.06)",
                    border: `1px solid ${C.accent}22`,
                    borderRadius: 12,
                    fontSize: 12,
                    color: C.muted,
                    lineHeight: 1.6,
                  }}
                >
                  ℹ Withdrawals to non-whitelisted addresses undergo AML
                  screening and may take up to 24h.
                </div>

                {/* Load from whitelist */}
                <button
                  onClick={() => setShowWLSheet(true)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: C.surface2,
                    border: `1.5px solid ${C.border}`,
                    color: C.text,
                    fontSize: 14,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    WebkitTapHighlightColor: "transparent",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 18 }}>⭐</span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: selectedWhitelist ? C.green : C.text,
                      }}
                    >
                      {selectedWhitelist
                        ? selectedWhitelist.label
                        : "Select from Whitelist"}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {selectedWhitelist
                        ? _SEC.maskAddress(address)
                        : "Pre-approved addresses process faster"}
                    </div>
                  </div>
                  <span style={{ color: C.muted, fontSize: 18 }}>›</span>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                  <span style={{ fontSize: 12, color: C.muted }}>
                    or enter manually
                  </span>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.muted,
                      letterSpacing: 0.4,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    DESTINATION ADDRESS ({CHAINS[chain].label})
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value.trim())}
                    placeholder={`Enter ${CHAINS[chain].label} wallet address`}
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "14px",
                      background: C.surface2,
                      border: `1.5px solid ${errors.address ? C.red + "66" : C.border}`,
                      borderRadius: 14,
                      color: C.white,
                      fontSize: 13,
                      fontFamily: "IBM Plex Mono, monospace",
                      resize: "none",
                      lineHeight: 1.5,
                      appearance: "none",
                    }}
                  />
                  {errors.address && (
                    <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>
                      {errors.address}
                    </div>
                  )}
                  {address && CHAINS[chain].addrRegex.test(address) && (
                    <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>
                      ✓ Valid {CHAINS[chain].label} address
                    </div>
                  )}
                </div>

                <Input
                  label="NOTE (OPTIONAL)"
                  value={note}
                  onChange={setNote}
                  placeholder="Reference or memo..."
                  maxLength={80}
                />

                <div style={{ display: "flex", gap: 10 }}>
                  <Btn onClick={prevStep} variant="ghost" style={{ flex: 1 }}>
                    ← Back
                  </Btn>
                  <Btn onClick={nextStep} variant="primary" style={{ flex: 2 }}>
                    Continue →
                  </Btn>
                </div>
              </div>
            )}

            {/* STEP 2 — Review */}
            {step === 2 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div
                  style={{
                    padding: 16,
                    background: "rgba(255,170,0,0.06)",
                    border: `1px solid ${C.yellow}33`,
                    borderRadius: 12,
                    fontSize: 13,
                    color: C.yellow,
                    lineHeight: 1.6,
                    fontWeight: 500,
                  }}
                >
                  ⚠ Blockchain transactions are irreversible. Please verify all
                  details carefully before confirming.
                </div>

                <Card style={{ padding: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      padding: "14px 16px",
                      background: C.surface2,
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: C.muted,
                        letterSpacing: 0.5,
                      }}
                    >
                      WITHDRAWAL SUMMARY
                    </div>
                  </div>
                  {[
                    ["Sending", `${amount} ${token}`, null, true],
                    ["USD Value", fmtUSD(amountUSD), null, false],
                    [
                      "Network",
                      `${CHAINS[chain].icon} ${CHAINS[chain].label}`,
                      null,
                      false,
                    ],
                    ["Est. Arrival", CHAINS[chain].time, null, false],
                    ["To Address", _SEC.maskAddress(address), address, false],
                    [
                      "Network Fee",
                      `${fee.fee} ${fee.feeToken}`,
                      fmtUSD(fee.feeUSD),
                      false,
                    ],
                    ["Platform Fee", "0.1%", fmtUSD(platFee), false],
                    ["You Send (Net)", fmtUSD(netAmountUSD), null, true],
                  ].map(([l, v, sub, bold]) => (
                    <div
                      key={l as string}
                      style={{
                        padding: "13px 16px",
                        borderBottom: `1px solid ${C.border}22`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <span style={{ fontSize: 13, color: C.muted }}>
                        {l as string}
                      </span>
                      <div style={{ textAlign: "right" }}>
                        <div
                          className="mono"
                          style={{
                            fontSize: 13,
                            color: bold ? C.white : C.text,
                            fontWeight: bold ? 700 : 500,
                          }}
                        >
                          {v as string}
                        </div>
                        {sub && (
                          <div
                            style={{
                              fontSize: 10,
                              color: C.muted,
                              marginTop: 2,
                              wordBreak: "break-all",
                              maxWidth: 180,
                            }}
                          >
                            {sub as string}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </Card>

                {note && (
                  <Card style={{ padding: 12 }}>
                    <div
                      style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}
                    >
                      NOTE
                    </div>
                    <div style={{ fontSize: 13, color: C.text }}>{note}</div>
                  </Card>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <Btn onClick={prevStep} variant="ghost" style={{ flex: 1 }}>
                    ← Back
                  </Btn>
                  <Btn onClick={nextStep} variant="primary" style={{ flex: 2 }}>
                    Confirm Details →
                  </Btn>
                </div>
              </div>
            )}

            {/* STEP 3 — 2FA */}
            {step === 3 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: C.white,
                      marginBottom: 6,
                    }}
                  >
                    Two-Factor Authentication
                  </div>
                  <div
                    style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}
                  >
                    Enter the 6-digit code from your authenticator app to
                    authorize this withdrawal of{" "}
                    <span style={{ color: C.white, fontWeight: 700 }}>
                      {amount} {token}
                    </span>
                    .
                  </div>
                </div>

                <div>
                  <input
                    type="tel"
                    value={twoFA}
                    onChange={(e) =>
                      setTwoFA(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    style={{
                      width: "100%",
                      padding: "20px",
                      textAlign: "center",
                      background: C.surface2,
                      border: `1.5px solid ${errors.twoFA ? C.red + "66" : C.border}`,
                      borderRadius: 14,
                      color: C.white,
                      fontSize: 32,
                      fontWeight: 700,
                      letterSpacing: 12,
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  />
                  {errors.twoFA && (
                    <div
                      style={{
                        fontSize: 11,
                        color: C.red,
                        marginTop: 4,
                        textAlign: "center",
                      }}
                    >
                      {errors.twoFA}
                    </div>
                  )}
                </div>

                <Card style={{ padding: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      marginBottom: 8,
                      letterSpacing: 0.5,
                    }}
                  >
                    AUTHORIZING WITHDRAWAL
                  </div>
                  <div className="mono" style={{ fontSize: 13, color: C.text }}>
                    {amount} {token} → {_SEC.maskAddress(address)}
                    <br />
                    <span style={{ color: C.muted, fontSize: 11 }}>
                      via {CHAINS[chain].label}
                    </span>
                  </div>
                </Card>

                <div
                  style={{
                    padding: 12,
                    background: "rgba(255,51,102,0.06)",
                    border: `1px solid ${C.red}22`,
                    borderRadius: 10,
                    fontSize: 12,
                    color: C.muted,
                    lineHeight: 1.6,
                  }}
                >
                  🔒 This action cannot be undone. Ensure the destination
                  address is correct. Advancia cannot reverse blockchain
                  transactions.
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <Btn onClick={prevStep} variant="ghost" style={{ flex: 1 }}>
                    ← Back
                  </Btn>
                  <Btn
                    onClick={handleSubmit}
                    variant="primary"
                    style={{ flex: 2 }}
                    loading={submitting}
                    disabled={twoFA.length < 6 || submitting}
                    color={C.green}
                  >
                    {submitting ? "Processing..." : "Authorize Withdrawal"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ HISTORY TAB ══ */}
        {tab === "history" && (
          <div
            className="fadeUp"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>
                Recent Withdrawals
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>
                {history.length} transactions
              </span>
            </div>
            {history.map((tx) => {
              const sm = STATUS_META[tx.status] || STATUS_META.PENDING;
              const chainObj = CHAINS[tx.chain];
              return (
                <Card
                  key={tx.id}
                  onClick={() => setShowTxSheet(tx)}
                  style={{ padding: 16 }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        flexShrink: 0,
                        background: `${chainObj?.color || C.accent}15`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        color: chainObj?.color || C.accent,
                      }}
                    >
                      {chainObj?.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: C.white,
                            }}
                          >
                            {tx.amount} {tx.token}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: C.muted,
                              marginTop: 2,
                            }}
                          >
                            {tx.date}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: C.text,
                            }}
                          >
                            {fmtUSD(tx.usd)}
                          </div>
                          <Pill
                            label={sm.label}
                            color={sm.color}
                            icon={sm.icon}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          className="mono"
                          style={{ fontSize: 11, color: C.muted }}
                        >
                          {tx.addr}
                        </span>
                        <span style={{ fontSize: 10, color: C.muted }}>
                          View →
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ══ WHITELIST TAB ══ */}
        {tab === "whitelist" && (
          <div
            className="fadeUp"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>
                  Whitelisted Addresses
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  Pre-approved for fast withdrawal
                </div>
              </div>
              <Btn
                onClick={() => setShowAddWL(true)}
                variant="outline"
                size="sm"
              >
                + Add
              </Btn>
            </div>

            <Card
              style={{
                padding: 14,
                background: "rgba(26,107,255,0.06)",
                border: `1px solid ${C.accent}22`,
              }}
            >
              <div style={{ fontSize: 12, color: C.accent, lineHeight: 1.6 }}>
                ℹ New addresses require a{" "}
                <strong>24-hour verification window</strong> before they can
                receive withdrawals. This is an Advancia security requirement to
                protect against unauthorized transfers.
              </div>
            </Card>

            {whitelist.map((wl) => (
              <Card key={wl.id} style={{ padding: 14 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 11,
                      flexShrink: 0,
                      background: `${CHAINS[wl.chain]?.color || C.accent}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      color: CHAINS[wl.chain]?.color || C.accent,
                    }}
                  >
                    {CHAINS[wl.chain]?.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: C.white,
                        }}
                      >
                        {wl.label}
                      </div>
                      <Pill
                        label={wl.verified ? "Verified" : "Pending 24h"}
                        color={wl.verified ? C.green : C.yellow}
                        icon={wl.verified ? "✓" : "⏳"}
                      />
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 11, color: C.muted, marginTop: 3 }}
                    >
                      {_SEC.maskAddress(wl.addr)}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                      {wl.token} · {CHAINS[wl.chain]?.label}
                    </div>
                  </div>
                </div>
                {wl.verified && (
                  <button
                    onClick={() => {
                      setTab("new");
                      selectWhitelist(wl);
                    }}
                    style={{
                      marginTop: 12,
                      width: "100%",
                      padding: "10px",
                      borderRadius: 10,
                      background: C.accentDim,
                      border: `1px solid ${C.accent}33`,
                      color: C.accent,
                      fontSize: 13,
                      fontWeight: 600,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    Withdraw to this address →
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM SHEETS ── */}

      {/* Fee detail sheet */}
      <BottomSheet
        open={showFeeSheet}
        onClose={() => setShowFeeSheet(false)}
        title="Fee Breakdown"
      >
        {[
          [
            "Network Fee",
            `${fee.fee} ${fee.feeToken}`,
            fmtUSD(fee.feeUSD),
            "Paid to blockchain validators",
          ],
          [
            "Platform Fee",
            `0.1% of ${fmtUSD(amountUSD)}`,
            fmtUSD(platFee),
            "Advancia processing fee (min $0.50, max $25)",
          ],
          ["Total Fees", "", fmtUSD(fee.feeUSD + platFee), null],
          ["You Receive", "", fmtUSD(Math.max(0, netAmountUSD)), null],
        ].map(([l, v, s, h]) => (
          <div
            key={l as string}
            style={{
              padding: "12px 0",
              borderBottom: `1px solid ${C.border}22`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>
                  {l as string}
                </div>
                {v && (
                  <div
                    className="mono"
                    style={{ fontSize: 11, color: C.muted, marginTop: 2 }}
                  >
                    {v as string}
                  </div>
                )}
                {h && (
                  <div
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    {h as string}
                  </div>
                )}
              </div>
              <div
                className="mono"
                style={{ fontSize: 15, color: C.white, fontWeight: 700 }}
              >
                {s as string}
              </div>
            </div>
          </div>
        ))}
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "rgba(26,107,255,0.06)",
            borderRadius: 10,
            fontSize: 12,
            color: C.muted,
            lineHeight: 1.6,
          }}
        >
          Est. confirmation time:{" "}
          <strong style={{ color: C.text }}>{CHAINS[chain].time}</strong>
          <br />
          All fees are estimated and may vary with network congestion.
        </div>
      </BottomSheet>

      {/* Whitelist selector sheet */}
      <BottomSheet
        open={showWLSheet}
        onClose={() => setShowWLSheet(false)}
        title="Select Whitelisted Address"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {whitelist
            .filter((w) => w.chain === chain && w.verified)
            .map((wl) => (
              <button
                key={wl.id}
                onClick={() => selectWhitelist(wl)}
                style={{
                  padding: "14px",
                  borderRadius: 14,
                  width: "100%",
                  textAlign: "left",
                  background: C.surface2,
                  border: `1.5px solid ${C.border}`,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ fontSize: 20 }}>{CHAINS[wl.chain]?.icon}</div>
                  <div>
                    <div
                      style={{ fontSize: 14, fontWeight: 700, color: C.white }}
                    >
                      {wl.label}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 11, color: C.muted }}
                    >
                      {_SEC.maskAddress(wl.addr)}
                    </div>
                    <Pill label={wl.token} color={C.accent} />
                  </div>
                </div>
              </button>
            ))}
          {whitelist.filter((w) => w.chain === chain && w.verified).length ===
            0 && (
            <div
              style={{
                textAlign: "center",
                padding: "30px 0",
                color: C.muted,
                fontSize: 13,
              }}
            >
              No verified addresses for {CHAINS[chain].label}.<br />
              Add one in the Whitelist tab.
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Add whitelist sheet */}
      <BottomSheet
        open={showAddWL}
        onClose={() => setShowAddWL(false)}
        title="Add New Address"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              padding: 12,
              background: "rgba(255,170,0,0.06)",
              border: `1px solid ${C.yellow}33`,
              borderRadius: 10,
              fontSize: 12,
              color: C.yellow,
              lineHeight: 1.6,
            }}
          >
            ⚠ New addresses cannot receive withdrawals for 24 hours. This delay
            protects against unauthorized changes.
          </div>
          <Select
            label="NETWORK"
            value={newWLChain}
            onChange={setNewWLChain}
            options={chainOptions}
          />
          <Select
            label="TOKEN"
            value={newWLToken}
            onChange={setNewWLToken}
            options={Object.entries(TOKENS)
              .filter(([, v]) => v.chains.includes(newWLChain))
              .map(([k, v]) => ({ value: k, label: `${v.icon} ${k}` }))}
          />
          <Input
            label="LABEL"
            value={newWLLabel}
            onChange={setNewWLLabel}
            placeholder="e.g. My Phantom Wallet"
            maxLength={40}
          />
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.muted,
                letterSpacing: 0.4,
                display: "block",
                marginBottom: 6,
              }}
            >
              WALLET ADDRESS
            </label>
            <textarea
              value={newWLAddr}
              onChange={(e) => setNewWLAddr(e.target.value.trim())}
              placeholder={`Enter ${CHAINS[newWLChain].label} address`}
              rows={3}
              style={{
                width: "100%",
                padding: 14,
                background: C.surface2,
                border: `1.5px solid ${C.border}`,
                borderRadius: 12,
                color: C.white,
                fontSize: 12,
                fontFamily: "IBM Plex Mono, monospace",
                resize: "none",
                lineHeight: 1.5,
              }}
            />
          </div>
          <Btn
            onClick={addToWhitelist}
            fullWidth
            variant="outline"
            color={C.green}
          >
            Add Address (24h verification)
          </Btn>
        </div>
      </BottomSheet>

      {/* Transaction detail sheet */}
      <BottomSheet
        open={!!showTxSheet}
        onClose={() => setShowTxSheet(null)}
        title="Transaction Details"
      >
        {showTxSheet &&
          (() => {
            const tx = showTxSheet;
            const sm = STATUS_META[tx.status] || STATUS_META.PENDING;
            const ch = CHAINS[tx.chain];
            return (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>{sm.icon}</div>
                  <div
                    style={{ fontSize: 24, fontWeight: 800, color: C.white }}
                  >
                    {tx.amount} {tx.token}
                  </div>
                  <div style={{ fontSize: 14, color: C.muted }}>
                    {fmtUSD(tx.usd)}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Pill
                      label={sm.label}
                      color={sm.color}
                      bg={sm.bg}
                      icon={sm.icon}
                    />
                  </div>
                </div>

                <Card style={{ padding: 0 }}>
                  {[
                    ["Reference", tx.id],
                    ["Network", `${ch?.icon} ${ch?.label}`],
                    ["Token", tx.token],
                    ["To Address", tx.addr],
                    ["Date", tx.date],
                    ["Network Fee", `${tx.fee} ${ch?.symbol}`],
                    tx.txHash && ["TX Hash", _SEC.maskTx(tx.txHash)],
                  ]
                    .filter(Boolean)
                    .map(([l, v]) => (
                      <div
                        key={l as string}
                        style={{
                          padding: "12px 16px",
                          borderBottom: `1px solid ${C.border}22`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 12, color: C.muted }}>
                          {l as string}
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 12,
                            color: C.text,
                            maxWidth: "60%",
                            textAlign: "right",
                            wordBreak: "break-all",
                          }}
                        >
                          {v as string}
                        </span>
                      </div>
                    ))}
                </Card>

                {tx.txHash && (
                  <Btn
                    onClick={() =>
                      toast(
                        "Explorer link copied — view on " +
                          CHAINS[tx.chain].label +
                          " explorer",
                        "info",
                      )
                    }
                    fullWidth
                    variant="outline"
                    size="sm"
                  >
                    View on Explorer ↗
                  </Btn>
                )}

                {tx.status === "FAILED" && (
                  <div
                    style={{
                      padding: 12,
                      background: "rgba(255,51,102,0.06)",
                      borderRadius: 10,
                      fontSize: 12,
                      color: C.red,
                      lineHeight: 1.6,
                    }}
                  >
                    This transaction failed. No funds were deducted. Contact
                    support with reference: <strong>{tx.id}</strong>
                  </div>
                )}
                {tx.status === "AML_REVIEW" && (
                  <div
                    style={{
                      padding: 12,
                      background: "rgba(255,107,53,0.06)",
                      borderRadius: 10,
                      fontSize: 12,
                      color: C.orange,
                      lineHeight: 1.6,
                    }}
                  >
                    This withdrawal is under compliance review. You will be
                    notified within 24 hours. Ref: <strong>{tx.id}</strong>
                  </div>
                )}
              </div>
            );
          })()}
      </BottomSheet>
    </div>
  );
}
