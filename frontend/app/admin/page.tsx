"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
type LiveEventType =
  | "transaction:new"
  | "transaction:updated"
  | "transaction:flagged"
  | "agent:status"
  | "agent:metric"
  | "alert:new"
  | "alert:resolved"
  | "facility:action"
  | "system:metric"
  | "heartbeat"
  | "error";

interface LiveEvent {
  type: LiveEventType;
  timestamp: string;
  data: Record<string, any>;
}

interface LiveTransaction {
  id: string;
  facilityName: string;
  amount: number;
  type: string;
  chain: string;
  status: string;
  timestamp: string;
}
interface LiveAgent {
  name: string;
  type?: string;
  status: string;
  processedCount: number;
  accuracy: number;
  cpuLoad: number;
  updatedAt: string;
}
interface LiveAlert {
  id: string;
  severity: string;
  msg: string;
  facility: string;
  timestamp: string;
  resolved?: boolean;
}
interface SystemMetrics {
  mrr: number;
  activeFacilities: number;
  txVolumeToday: number;
  txCountToday: number;
  uptime: number;
}

// ─── useLiveStream ────────────────────────────────────────────────────────────
function useLiveStream(token: string | null) {
  const [connected, setConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<LiveTransaction[]>([]);
  const [agents, setAgents] = useState<Record<string, LiveAgent>>({});
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [metrics, setMetrics] = useState<Partial<SystemMetrics>>({});
  const [activityLog, setActivityLog] = useState<LiveEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<any>(null);
  const delayRef = useRef(1000);

  const addLog = useCallback((ev: LiveEvent) => {
    setActivityLog((prev) => [ev, ...prev].slice(0, 100));
  }, []);

  const handleEvent = useCallback(
    (event: LiveEvent) => {
      addLog(event);
      switch (event.type) {
        case "heartbeat":
          setLastHeartbeat(event.timestamp);
          break;
        case "transaction:new":
        case "transaction:flagged":
          setTransactions((prev) =>
            [
              { ...event.data, timestamp: event.timestamp } as LiveTransaction,
              ...prev,
            ].slice(0, 50),
          );
          if (event.type === "transaction:flagged") {
            setAlerts((prev) =>
              [
                {
                  id: `alert_${Date.now()}`,
                  severity: "high",
                  msg: `TX ${event.data.id} flagged: unusual pattern`,
                  facility: event.data.facilityName,
                  timestamp: event.timestamp,
                } as LiveAlert,
                ...prev,
              ].slice(0, 50),
            );
          }
          break;
        case "transaction:updated":
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === event.data.txId
                ? { ...t, status: event.data.status }
                : t,
            ),
          );
          break;
        case "agent:status":
        case "agent:metric":
          setAgents((prev) => ({
            ...prev,
            [event.data.name]: {
              ...(prev[event.data.name] ?? {}),
              ...event.data,
              updatedAt: event.timestamp,
            } as LiveAgent,
          }));
          break;
        case "alert:new":
          setAlerts((prev) =>
            [
              { ...event.data, timestamp: event.timestamp } as LiveAlert,
              ...prev,
            ].slice(0, 50),
          );
          break;
        case "alert:resolved":
          setAlerts((prev) =>
            prev.map((a) =>
              a.id === event.data.alertId ? { ...a, resolved: true } : a,
            ),
          );
          break;
        case "system:metric":
          const { snapshot, recentTx, agentMetrics, ...m } = event.data;
          if (snapshot && recentTx) {
            setTransactions(
              recentTx.map((t: any) => ({
                ...t,
                facilityName: t.facilityId,
                timestamp: t.createdAt,
              })),
            );
            const ag: Record<string, LiveAgent> = {};
            agentMetrics?.forEach((a: any) => {
              ag[a.agentName] = { name: a.agentName, ...a };
            });
            setAgents(ag);
          }
          setMetrics((prev) => ({ ...prev, ...m }));
          break;
      }
    },
    [addLog],
  );

  const connect = useCallback(() => {
    if (!token) return;
    esRef.current?.close();

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const es = new EventSource(`${baseUrl}/api/admin/stream`);

    esRef.current = es;
    es.onopen = () => {
      setConnected(true);
      setError(null);
      delayRef.current = 1000;
    };
    es.onerror = () => {
      setConnected(false);
      es.close();
      reconnectRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 2, 30000);
        connect();
      }, delayRef.current);
    };
    es.onmessage = (e) => {
      try {
        handleEvent(JSON.parse(e.data));
      } catch {}
    };
  }, [token, handleEvent]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return {
    connected,
    lastHeartbeat,
    transactions,
    agents,
    alerts,
    metrics,
    activityLog,
    error,
    reconnect: connect,
  };
}

// ─── MOCK SEED (pre-populated before SSE hydrates) ───────────────────────────
const SEED_TX: LiveTransaction[] = [
  {
    id: "tx_9xKp2",
    facilityName: "Capitol Health Network",
    amount: 42800,
    type: "crypto",
    chain: "Solana",
    status: "confirmed",
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "tx_8mRq1",
    facilityName: "St. Mary Medical Center",
    amount: 15200,
    type: "fiat",
    chain: "Stripe",
    status: "confirmed",
    timestamp: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "tx_7nLw3",
    facilityName: "Northgate Hospital",
    amount: 31000,
    type: "crypto",
    chain: "Ethereum",
    status: "pending",
    timestamp: new Date(Date.now() - 480000).toISOString(),
  },
  {
    id: "tx_6kPz9",
    facilityName: "Riverside Urgent Care",
    amount: 8400,
    type: "fiat",
    chain: "Stripe",
    status: "confirmed",
    timestamp: new Date(Date.now() - 720000).toISOString(),
  },
  {
    id: "tx_4hNv8",
    facilityName: "Capitol Health Network",
    amount: 57300,
    type: "crypto",
    chain: "Base",
    status: "flagged",
    timestamp: new Date(Date.now() - 1440000).toISOString(),
  },
];
const SEED_AGENTS: Record<string, LiveAgent> = {
  FraudSentinel: {
    name: "FraudSentinel",
    type: "Fraud Detection",
    status: "running",
    processedCount: 18420,
    accuracy: 99.2,
    cpuLoad: 34,
    updatedAt: new Date().toISOString(),
  },
  ClaimsOrchestrator: {
    name: "ClaimsOrchestrator",
    type: "Claims Automation",
    status: "running",
    processedCount: 8741,
    accuracy: 97.8,
    cpuLoad: 58,
    updatedAt: new Date().toISOString(),
  },
  ComplianceGuard: {
    name: "ComplianceGuard",
    type: "HIPAA Compliance",
    status: "running",
    processedCount: 24103,
    accuracy: 99.9,
    cpuLoad: 22,
    updatedAt: new Date().toISOString(),
  },
  PaymentRouter: {
    name: "PaymentRouter",
    type: "Payment Optimization",
    status: "running",
    processedCount: 31204,
    accuracy: 98.5,
    cpuLoad: 71,
    updatedAt: new Date().toISOString(),
  },
  EHRBridge: {
    name: "EHRBridge",
    type: "EHR Integration",
    status: "idle",
    processedCount: 5291,
    accuracy: 96.4,
    cpuLoad: 8,
    updatedAt: new Date().toISOString(),
  },
  RiskAnalyzer: {
    name: "RiskAnalyzer",
    type: "Risk Assessment",
    status: "running",
    processedCount: 12890,
    accuracy: 99.1,
    cpuLoad: 45,
    updatedAt: new Date().toISOString(),
  },
  AuditLogger: {
    name: "AuditLogger",
    type: "Audit Trail",
    status: "running",
    processedCount: 89201,
    accuracy: 100,
    cpuLoad: 15,
    updatedAt: new Date().toISOString(),
  },
  BillingReconciler: {
    name: "BillingReconciler",
    type: "Billing Automation",
    status: "warning",
    processedCount: 6204,
    accuracy: 94.1,
    cpuLoad: 88,
    updatedAt: new Date().toISOString(),
  },
};
const SEED_ALERTS: LiveAlert[] = [
  {
    id: "a1",
    severity: "high",
    msg: "TX tx_4hNv8 flagged: unusual volume pattern",
    facility: "Capitol Health Network",
    timestamp: new Date(Date.now() - 1440000).toISOString(),
  },
  {
    id: "a2",
    severity: "medium",
    msg: "BillingReconciler load at 88% — near threshold",
    facility: "System",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "a3",
    severity: "low",
    msg: "Harmony Behavioral Health trial expires in 3 days",
    facility: "Harmony Behavioral Health",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
];
const MRR_HISTORY = [
  47000, 68000, 89000, 112000, 138000, 159000, 182000, 198000, 214000, 231000,
  239000, 247000,
];

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }: { n: string; s?: number }) => {
  const m: Record<string, JSX.Element> = {
    dashboard: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    facilities: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M3 21V7l9-4 9 4v14" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
    tx: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" />
      </svg>
    ),
    agents: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
      </svg>
    ),
    bell: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    shield: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    settings: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    activity: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    wifi: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
    wifiOff: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
    logout: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
    check: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    trend: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    eye: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    ban: (
      <svg
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
  };
  return m[n] ?? null;
};

// ─── Sparkline ────────────────────────────────────────────────────────────────
const Spark = ({
  data,
  w = 280,
  h = 64,
  color = "#00ffc2",
}: {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
}) => {
  const max = Math.max(...data),
    min = Math.min(...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#sg)" />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ─── LoadBar ──────────────────────────────────────────────────────────────────
const LoadBar = ({ v }: { v: number }) => (
  <div
    style={{
      background: "rgba(255,255,255,0.06)",
      borderRadius: 4,
      height: 5,
      width: "100%",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        width: `${v}%`,
        height: "100%",
        background: v > 80 ? "#ff4757" : v > 60 ? "#ffa726" : "#00ffc2",
        borderRadius: 4,
        transition: "width 0.8s ease",
      }}
    />
  </div>
);

// ─── Time ago ─────────────────────────────────────────────────────────────────
function ago(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, any> = {
  active: { bg: "rgba(0,255,194,0.12)", color: "#00ffc2" },
  confirmed: { bg: "rgba(0,255,194,0.12)", color: "#00ffc2" },
  running: { bg: "rgba(0,255,194,0.12)", color: "#00ffc2" },
  trial: { bg: "rgba(255,167,38,0.12)", color: "#ffa726" },
  pending: { bg: "rgba(255,167,38,0.12)", color: "#ffa726" },
  medium: { bg: "rgba(255,167,38,0.12)", color: "#ffa726" },
  warning: { bg: "rgba(255,71,87,0.12)", color: "#ff4757" },
  suspended: { bg: "rgba(255,71,87,0.12)", color: "#ff4757" },
  flagged: { bg: "rgba(255,71,87,0.12)", color: "#ff4757" },
  high: { bg: "rgba(255,71,87,0.12)", color: "#ff4757" },
  idle: { bg: "rgba(200,216,240,0.07)", color: "rgba(200,216,240,0.4)" },
  low: { bg: "rgba(200,216,240,0.07)", color: "rgba(200,216,240,0.4)" },
};
const Badge = ({ t }: { t: string }) => {
  const s = BADGE_STYLES[t] ?? BADGE_STYLES.idle;
  return (
    <span
      style={{
        padding: "2px 9px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
        background: s.bg,
        color: s.color,
      }}
    >
      {t}
    </span>
  );
};

export default function SuperAdmin() {
  const [nav, setNav] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(
    null,
  );
  const [tick, setTick] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.push("/login");
    }
  }, [router]);

  // Read token from localStorage for SSE connection
  const token =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  const live = useLiveStream(token);

  // Merge seed data with live data (seed is fallback while SSE hydrates)
  const transactions =
    live.transactions.length > 0 ? live.transactions : SEED_TX;
  const agents =
    Object.keys(live.agents).length > 0 ? live.agents : SEED_AGENTS;
  const alerts = live.alerts.length > 0 ? live.alerts : SEED_ALERTS;
  const metrics = {
    mrr: 247000,
    activeFacilities: 24,
    txVolumeToday: 3412900,
    txCountToday: 1842,
    uptime: 99.97,
    ...live.metrics,
  };

  // Re-render for "X ago" freshness
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  const fmt = (n: number) =>
    n >= 1000000
      ? `$${(n / 1000000).toFixed(2)}M`
      : `$${(n / 1000).toFixed(0)}K`;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "tx", label: "Transactions", icon: "tx" },
    { id: "agents", label: "AI Agents", icon: "agents" },
    {
      id: "alerts",
      label: `Alerts (${alerts.filter((a) => !a.resolved).length})`,
      icon: "bell",
    },
    { id: "activity", label: "Live Activity", icon: "activity" },
    { id: "security", label: "Security", icon: "shield" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  // ── Styles ──────────────────────────────────────────────────────────────────
  const C = {
    app: {
      display: "flex" as const,
      height: "100vh",
      background: "#060b18",
      fontFamily: "'DM Mono','Fira Code','Courier New',monospace",
      color: "#c8d8f0",
      overflow: "hidden" as const,
    },
    sidebar: {
      width: sidebarOpen ? 240 : 64,
      background: "#090e1e",
      borderRight: "1px solid rgba(0,255,194,0.07)",
      display: "flex" as const,
      flexDirection: "column" as const,
      transition: "width 0.3s",
      flexShrink: 0,
      overflow: "hidden" as const,
    },
    main: {
      flex: 1,
      display: "flex" as const,
      flexDirection: "column" as const,
      overflow: "hidden" as const,
      minWidth: 0,
    },
    topbar: {
      padding: "14px 28px",
      borderBottom: "1px solid rgba(0,255,194,0.06)",
      display: "flex" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      background: "rgba(9,14,30,0.8)",
      backdropFilter: "blur(8px)",
      flexShrink: 0,
    },
    content: { flex: 1, overflow: "auto" as const, padding: "24px 28px" },
    card: {
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(0,255,194,0.09)",
      borderRadius: 12,
      padding: 22,
    },
    input: {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(0,255,194,0.15)",
      borderRadius: 8,
      padding: "7px 13px",
      color: "#c8d8f0",
      fontSize: 12,
      outline: "none" as const,
      fontFamily: "inherit",
    },
    btn: (v = "primary") => ({
      padding: "6px 14px",
      borderRadius: 8,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.07em",
      cursor: "pointer",
      border: "none",
      fontFamily: "inherit",
      transition: "all 0.15s",
      ...(v === "primary"
        ? {
            background: "linear-gradient(135deg,#00ffc2,#0080ff)",
            color: "#060b18",
          }
        : v === "ghost"
          ? {
              background: "rgba(255,255,255,0.05)",
              color: "rgba(200,216,240,0.7)",
              border: "1px solid rgba(255,255,255,0.1)",
            }
          : {
              background: "rgba(255,71,87,0.12)",
              color: "#ff4757",
              border: "1px solid rgba(255,71,87,0.2)",
            }),
    }),
    navItem: (a: boolean) => ({
      display: "flex" as const,
      alignItems: "center" as const,
      gap: 12,
      padding: "10px 20px",
      cursor: "pointer",
      transition: "all 0.15s",
      background: a ? "rgba(0,255,194,0.07)" : "transparent",
      borderLeft: a ? "2px solid #00ffc2" : "2px solid transparent",
      color: a ? "#00ffc2" : "rgba(200,216,240,0.45)",
      whiteSpace: "nowrap" as const,
      overflow: "hidden" as const,
      fontSize: 12,
      letterSpacing: "0.04em",
    }),
    th: {
      padding: "9px 14px",
      textAlign: "left" as const,
      fontSize: 10,
      letterSpacing: "0.12em",
      textTransform: "uppercase" as const,
      color: "rgba(200,216,240,0.3)",
      borderBottom: "1px solid rgba(0,255,194,0.07)",
    },
    td: {
      padding: "13px 14px",
      fontSize: 12,
      borderBottom: "1px solid rgba(255,255,255,0.035)",
    },
  };

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Connection indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: live.connected ? "#00ffc2" : "#ff4757",
        }}
      >
        <Ic n={live.connected ? "wifi" : "wifiOff"} s={13} />
        {live.connected
          ? `Live — last heartbeat ${live.lastHeartbeat ? ago(live.lastHeartbeat) : "…"}`
          : "Connecting to live stream…"}
        {!live.connected && (
          <button
            style={{ ...C.btn("ghost"), fontSize: 10, padding: "3px 10px" }}
            onClick={live.reconnect}
          >
            Reconnect
          </button>
        )}
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
        }}
      >
        {[
          {
            label: "Monthly Revenue",
            value: fmt(metrics.mrr ?? 0),
            sub: `+42% MoM`,
            accent: "#00ffc2",
            icon: "trend",
          },
          {
            label: "Active Facilities",
            value: metrics.activeFacilities ?? 0,
            sub: "4 in onboarding",
            accent: "#0080ff",
            icon: "facilities",
          },
          {
            label: "TX Volume Today",
            value: fmt(metrics.txVolumeToday ?? 0),
            sub: `${(metrics.txCountToday ?? 0).toLocaleString()} transactions`,
            accent: "#a78bfa",
            icon: "tx",
          },
          {
            label: "Platform Uptime",
            value: `${metrics.uptime ?? 0}%`,
            sub: "Last 30 days",
            accent: "#00ffc2",
            icon: "shield",
          },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              ...C.card,
              borderColor: `${s.accent}22`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                color: `${s.accent}55`,
              }}
            >
              <Ic n={s.icon} s={20} />
            </div>
            <div
              style={{
                fontSize: 9,
                color: "rgba(200,216,240,0.35)",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginBottom: 6,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: s.accent,
                marginBottom: 2,
                letterSpacing: "-0.02em",
              }}
            >
              {String(s.value)}
            </div>
            <div style={{ fontSize: 10, color: "rgba(200,216,240,0.35)" }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* MRR + Live TX */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}
      >
        <div style={C.card}>
          <div
            style={{
              fontSize: 10,
              color: "rgba(200,216,240,0.35)",
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              marginBottom: 4,
            }}
          >
            MRR Trend
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#00ffc2",
              marginBottom: 14,
            }}
          >
            {fmt(metrics.mrr ?? 247000)} / mo
          </div>
          <Spark data={MRR_HISTORY} w={280} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              fontSize: 9,
              color: "rgba(200,216,240,0.25)",
            }}
          >
            {[
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
              "Jan",
              "Feb",
            ].map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>

        <div style={C.card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "rgba(200,216,240,0.35)",
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
              }}
            >
              Live Transactions
            </div>
            {live.connected && (
              <span
                style={{
                  fontSize: 9,
                  color: "#00ffc2",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#00ffc2",
                    display: "block",
                    animation: "pulse 2s infinite",
                  }}
                />
                LIVE
              </span>
            )}
          </div>
          {transactions.slice(0, 6).map((tx) => (
            <div
              key={tx.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <div>
                <div
                  style={{ fontSize: 11, color: "#c8d8f0", marginBottom: 1 }}
                >
                  {tx.facilityName}
                </div>
                <div style={{ fontSize: 9, color: "rgba(200,216,240,0.3)" }}>
                  {tx.id} · {tx.chain} · {ago(tx.timestamp)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: tx.status === "flagged" ? "#ff4757" : "#c8d8f0",
                  }}
                >
                  ${(tx.amount / 100).toFixed(0)}
                </span>
                <Badge t={tx.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active alerts strip */}
      {alerts.filter((a) => !a.resolved).length > 0 && (
        <div style={{ ...C.card, borderColor: "rgba(255,71,87,0.18)" }}>
          <div
            style={{
              fontSize: 10,
              color: "#ff4757",
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              marginBottom: 10,
            }}
          >
            ⚠ Active Alerts
          </div>
          {alerts
            .filter((a) => !a.resolved)
            .map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  fontSize: 12,
                }}
              >
                <Badge t={a.severity} />
                <span style={{ flex: 1 }}>{a.msg}</span>
                <span
                  style={{
                    fontSize: 9,
                    color: "rgba(200,216,240,0.3)",
                    flexShrink: 0,
                  }}
                >
                  {ago(a.timestamp)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  // ── Transactions ───────────────────────────────────────────────────────────
  const Transactions = () => (
    <div style={C.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "rgba(200,216,240,0.35)",
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
          }}
        >
          Transaction Ledger{" "}
          {live.connected && (
            <span style={{ color: "#00ffc2", marginLeft: 8 }}>● LIVE</span>
          )}
        </div>
        <input
          style={C.input}
          placeholder="Filter TX / facility…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {[
              "TX ID",
              "Facility",
              "Amount",
              "Type",
              "Chain",
              "Status",
              "Time",
            ].map((h) => (
              <th key={h} style={C.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions
            .filter(
              (t) =>
                !search ||
                t.id.includes(search) ||
                t.facilityName.toLowerCase().includes(search.toLowerCase()),
            )
            .map((tx) => (
              <tr
                key={tx.id}
                style={{
                  animation:
                    live.transactions.indexOf(tx) === 0
                      ? "flashRow 1s ease"
                      : "none",
                }}
              >
                <td
                  style={{
                    ...C.td,
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "#a78bfa",
                  }}
                >
                  {tx.id}
                </td>
                <td style={C.td}>{tx.facilityName}</td>
                <td
                  style={{
                    ...C.td,
                    fontWeight: 600,
                    color: tx.status === "flagged" ? "#ff4757" : "#00ffc2",
                  }}
                >
                  ${(tx.amount / 100).toFixed(2)}
                </td>
                <td
                  style={{
                    ...C.td,
                    fontSize: 10,
                    color: "rgba(200,216,240,0.4)",
                  }}
                >
                  {tx.type}
                </td>
                <td style={C.td}>{tx.chain}</td>
                <td style={C.td}>
                  <Badge t={tx.status} />
                </td>
                <td
                  style={{
                    ...C.td,
                    fontSize: 10,
                    color: "rgba(200,216,240,0.35)",
                  }}
                >
                  {ago(tx.timestamp)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );

  // ── Agents ─────────────────────────────────────────────────────────────────
  const Agents = () => {
    const agList = Object.values(agents);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 14,
          }}
        >
          {[
            {
              label: "Running",
              value: agList.filter((a) => a.status === "running").length,
              color: "#00ffc2",
            },
            {
              label: "Processed",
              value: agList
                .reduce((s, a) => s + (a.processedCount ?? 0), 0)
                .toLocaleString(),
              color: "#0080ff",
            },
            {
              label: "Warnings",
              value: agList.filter(
                (a) => a.status === "warning" || a.status === "error",
              ).length,
              color: "#ff4757",
            },
          ].map((s, i) => (
            <div key={i} style={{ ...C.card, borderColor: `${s.color}22` }}>
              <div
                style={{
                  fontSize: 9,
                  color: "rgba(200,216,240,0.35)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  marginBottom: 5,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>
                {String(s.value)}
              </div>
            </div>
          ))}
        </div>
        <div style={C.card}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "Agent",
                  "Type",
                  "Status",
                  "Processed",
                  "Accuracy",
                  "Load",
                  "Updated",
                ].map((h) => (
                  <th key={h} style={C.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agList.map((a) => (
                <tr key={a.name}>
                  <td style={{ ...C.td, fontWeight: 600 }}>{a.name}</td>
                  <td
                    style={{
                      ...C.td,
                      fontSize: 10,
                      color: "rgba(200,216,240,0.45)",
                    }}
                  >
                    {a.type ?? "-"}
                  </td>
                  <td style={C.td}>
                    <Badge t={a.status} />
                  </td>
                  <td style={C.td}>
                    {(a.processedCount ?? 0).toLocaleString()}
                  </td>
                  <td
                    style={{
                      ...C.td,
                      fontWeight: 600,
                      color:
                        a.accuracy > 98
                          ? "#00ffc2"
                          : a.accuracy > 95
                            ? "#ffa726"
                            : "#ff4757",
                    }}
                  >
                    {a.accuracy}%
                  </td>
                  <td style={{ ...C.td, minWidth: 130 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 7 }}
                    >
                      <LoadBar v={a.cpuLoad} />
                      <span
                        style={{
                          fontSize: 9,
                          color: "rgba(200,216,240,0.35)",
                          flexShrink: 0,
                          width: 28,
                        }}
                      >
                        {a.cpuLoad}%
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      ...C.td,
                      fontSize: 9,
                      color: "rgba(200,216,240,0.3)",
                    }}
                  >
                    {ago(a.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const Alerts = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {alerts.map((a) => (
        <div
          key={a.id}
          style={{
            ...C.card,
            borderColor:
              a.severity === "high"
                ? "rgba(255,71,87,0.25)"
                : a.severity === "medium"
                  ? "rgba(255,167,38,0.18)"
                  : "rgba(0,255,194,0.09)",
            opacity: a.resolved ? 0.45 : 1,
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
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 7,
                }}
              >
                <Badge t={a.severity} />
                {a.resolved && (
                  <span
                    style={{ fontSize: 9, color: "rgba(200,216,240,0.35)" }}
                  >
                    resolved
                  </span>
                )}
                <span style={{ fontSize: 9, color: "rgba(200,216,240,0.3)" }}>
                  {ago(a.timestamp)} · {a.facility}
                </span>
              </div>
              <div style={{ fontSize: 13 }}>{a.msg}</div>
            </div>
            {!a.resolved && (
              <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                <button
                  style={{
                    ...C.btn("ghost"),
                    fontSize: 10,
                    padding: "4px 11px",
                  }}
                  onClick={() => showToast("Investigating alert")}
                >
                  Investigate
                </button>
                <button
                  style={{ ...C.btn(), fontSize: 10, padding: "4px 11px" }}
                  onClick={() => {
                    showToast("Alert resolved");
                  }}
                >
                  Resolve
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // ── Live Activity Log ──────────────────────────────────────────────────────
  const ActivityLog = () => {
    const logItems =
      live.activityLog.length > 0
        ? live.activityLog
        : ([
            {
              type: "transaction:new",
              timestamp: new Date(Date.now() - 15000).toISOString(),
              data: {
                id: "tx_demo1",
                facilityName: "St. Mary Medical Center",
                amount: 18200,
                chain: "Solana",
                status: "confirmed",
              },
            },
            {
              type: "agent:metric",
              timestamp: new Date(Date.now() - 42000).toISOString(),
              data: {
                name: "FraudSentinel",
                cpuLoad: 34,
                accuracy: 99.2,
                processedCount: 18420,
              },
            },
            {
              type: "alert:new",
              timestamp: new Date(Date.now() - 90000).toISOString(),
              data: {
                id: "a_demo",
                severity: "high",
                msg: "TX flagged: unusual volume",
                facility: "Capitol Health Network",
              },
            },
            {
              type: "facility:action",
              timestamp: new Date(Date.now() - 180000).toISOString(),
              data: { facilityName: "Lakewood Clinic", action: "login" },
            },
            {
              type: "system:metric",
              timestamp: new Date(Date.now() - 300000).toISOString(),
              data: { mrr: 247000, activeFacilities: 24, txCountToday: 1842 },
            },
            {
              type: "agent:status",
              timestamp: new Date(Date.now() - 420000).toISOString(),
              data: { name: "BillingReconciler", status: "warning" },
            },
            {
              type: "transaction:flagged",
              timestamp: new Date(Date.now() - 540000).toISOString(),
              data: {
                id: "tx_4hNv8",
                facilityName: "Capitol Health Network",
                amount: 57300,
                chain: "Base",
              },
            },
          ] as LiveEvent[]);

    const typeColor: Record<string, string> = {
      "transaction:new": "#00ffc2",
      "transaction:flagged": "#ff4757",
      "transaction:updated": "#ffa726",
      "agent:metric": "#0080ff",
      "agent:status": "#a78bfa",
      "alert:new": "#ff4757",
      "alert:resolved": "#00ffc2",
      "facility:action": "#ffa726",
      "system:metric": "rgba(200,216,240,0.4)",
      heartbeat: "rgba(200,216,240,0.2)",
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 11,
            color: live.connected ? "#00ffc2" : "rgba(200,216,240,0.35)",
          }}
        >
          <Ic n={live.connected ? "wifi" : "wifiOff"} s={13} />
          {live.connected
            ? "Streaming live events"
            : "Showing recent events (not connected)"}
          <span style={{ fontSize: 10, color: "rgba(200,216,240,0.3)" }}>
            {logItems.length} events
          </span>
        </div>
        <div style={C.card}>
          <div
            style={{
              fontFamily: "'DM Mono','Fira Code',monospace",
              fontSize: 11,
            }}
          >
            {logItems.map((ev, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "9px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}
              >
                <span
                  style={{
                    color: "rgba(200,216,240,0.25)",
                    flexShrink: 0,
                    fontSize: 10,
                    paddingTop: 1,
                  }}
                >
                  {ago(ev.timestamp)}
                </span>
                <span
                  style={{
                    color: typeColor[ev.type] ?? "rgba(200,216,240,0.5)",
                    flexShrink: 0,
                    minWidth: 180,
                    fontSize: 10,
                  }}
                >
                  {ev.type}
                </span>
                <span
                  style={{
                    color: "rgba(200,216,240,0.55)",
                    fontSize: 10,
                    wordBreak: "break-all" as const,
                  }}
                >
                  {JSON.stringify(ev.data).slice(0, 120)}
                  {JSON.stringify(ev.data).length > 120 ? "…" : ""}
                </span>
              </div>
            ))}
            {logItems.length === 0 && (
              <div
                style={{
                  color: "rgba(200,216,240,0.25)",
                  padding: "24px 0",
                  textAlign: "center" as const,
                }}
              >
                Waiting for events…
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Security ───────────────────────────────────────────────────────────────
  const Security = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 14,
        }}
      >
        {[
          {
            label: "HIPAA Compliance",
            value: "100%",
            sub: "All facilities",
            color: "#00ffc2",
          },
          {
            label: "PCI-DSS",
            value: "Level 1",
            sub: "Last audit: Jan 2025",
            color: "#0080ff",
          },
          {
            label: "Failed Logins 24h",
            value: "3",
            sub: "Auto-blocked after 5",
            color: "#ffa726",
          },
        ].map((s, i) => (
          <div key={i} style={{ ...C.card, borderColor: `${s.color}22` }}>
            <div
              style={{
                fontSize: 9,
                color: "rgba(200,216,240,0.35)",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginBottom: 5,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: s.color,
                marginBottom: 3,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 10, color: "rgba(200,216,240,0.3)" }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>
      <div style={C.card}>
        <div
          style={{
            fontSize: 10,
            color: "#00ffc2",
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            marginBottom: 14,
          }}
        >
          Security Controls
        </div>
        {[
          "2FA / TOTP Enforcement — Enabled",
          "JWT Token Rotation (24h) — Active",
          "AES-256 Blockchain Encryption — Active",
          "Data Residency (US-only) — Enforced",
          "AI Agent Audit Trail — Logging All",
          "Automated PHI Masking — Active",
          "Redis Pub/Sub TLS — Enabled",
          "SSE Admin Stream — Authenticated",
        ].map((row, i) => {
          const [label, status] = row.split(" — ");
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "11px 0",
                borderBottom: "1px solid rgba(255,255,255,0.035)",
              }}
            >
              <span style={{ fontSize: 12 }}>{label}</span>
              <span
                style={{
                  fontSize: 11,
                  color: "#00ffc2",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Ic n="check" s={12} />
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Settings ───────────────────────────────────────────────────────────────
  const Settings = () => (
    <div
      style={{
        maxWidth: 600,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {[
        {
          section: "Platform",
          fields: [
            { label: "Company", val: "Advancia Pay Ledger" },
            { label: "Admin Email", val: "admin@advanciapayledger.com" },
          ],
        },
        {
          section: "Live Stream",
          fields: [
            { label: "SSE Endpoint", val: "/api/admin/stream" },
            { label: "Heartbeat Interval", val: "20s" },
          ],
        },
        {
          section: "Fundraising",
          fields: [
            { label: "Seed Round Target", val: "$1,500,000" },
            { label: "Post-Money Valuation", val: "$8,000,000" },
          ],
        },
      ].map((s, i) => (
        <div key={i} style={C.card}>
          <div
            style={{
              fontSize: 10,
              color: "#00ffc2",
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              marginBottom: 14,
            }}
          >
            {s.section}
          </div>
          {s.fields.map((f, j) => (
            <div key={j} style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 9,
                  color: "rgba(200,216,240,0.35)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  display: "block",
                  marginBottom: 5,
                }}
              >
                {f.label}
              </label>
              <input
                defaultValue={f.val}
                style={{ ...C.input, width: "100%" }}
              />
            </div>
          ))}
          <button style={C.btn()} onClick={() => showToast("Settings saved")}>
            Save Changes
          </button>
        </div>
      ))}
    </div>
  );

  const pages: Record<string, JSX.Element> = {
    dashboard: <Dashboard />,
    tx: <Transactions />,
    agents: <Agents />,
    alerts: <Alerts />,
    activity: <ActivityLog />,
    security: <Security />,
    settings: <Settings />,
  };

  return (
    <div style={C.app}>
      {/* Sidebar */}
      <div style={C.sidebar}>
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid rgba(0,255,194,0.07)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            flexShrink: 0,
          }}
          onClick={() => setSidebarOpen((x) => !x)}
        >
          <div
            style={{
              width: 30,
              height: 30,
              background: "linear-gradient(135deg,#00ffc2,#0080ff)",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#060b18",
              flexShrink: 0,
            }}
          >
            A
          </div>
          {sidebarOpen && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#00ffc2",
                }}
              >
                Advancia
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "rgba(200,216,240,0.35)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Super Admin
              </div>
            </div>
          )}
        </div>
        <nav style={{ flex: 1, paddingTop: 10 }}>
          {navItems.map((item) => (
            <div
              key={item.id}
              style={C.navItem(nav === item.id)}
              onClick={() => {
                setNav(item.id);
                setSearch("");
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <Ic n={item.icon} s={15} />
              </div>
              {sidebarOpen && <span>{item.label}</span>}
            </div>
          ))}
        </nav>
        <div style={C.navItem(false)}>
          <div style={{ flexShrink: 0 }}>
            <Ic n="logout" s={15} />
          </div>
          {sidebarOpen && <span>Sign Out</span>}
        </div>
      </div>

      {/* Main */}
      <div style={C.main}>
        <div style={C.topbar}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link
                href="/"
                style={{
                  color: "rgba(200,216,240,0.5)",
                  textDecoration: "none",
                  fontSize: 13,
                }}
              >
                ← Hub
              </Link>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#c8d8f0",
                  letterSpacing: "0.02em",
                }}
              >
                {navItems
                  .find((n) => n.id === nav)
                  ?.label?.replace(/ \(\d+\)/, "")}
              </div>
            </div>
            <div
              style={{
                fontSize: 9,
                color: "rgba(200,216,240,0.3)",
                marginTop: 2,
              }}
            >
              {new Date().toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                color: live.connected ? "#00ffc2" : "rgba(200,216,240,0.3)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: live.connected
                    ? "#00ffc2"
                    : "rgba(200,216,240,0.3)",
                  display: "block",
                  animation: live.connected ? "pulse 2s infinite" : "none",
                }}
              />
              {live.connected ? "LIVE" : "OFFLINE"}
            </div>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#00ffc2,#0080ff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#060b18",
              }}
            >
              S
            </div>
          </div>
        </div>
        <div style={C.content}>{pages[nav]}</div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 22,
            right: 22,
            zIndex: 9999,
            background:
              toast.type === "danger"
                ? "rgba(255,71,87,0.97)"
                : "rgba(0,255,194,0.97)",
            color: "#060b18",
            padding: "11px 18px",
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "'DM Mono',monospace",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            animation: "fadeUp 0.3s ease",
          }}
        >
          {toast.msg}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,194,0.18); border-radius: 4px; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(1.5)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes flashRow { 0%{background:rgba(0,255,194,0.08)} 100%{background:transparent} }
        body { margin: 0; }
      `}</style>
    </div>
  );
}
