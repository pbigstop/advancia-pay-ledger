import { publishLiveEvent } from "../routes/admin/live-stream";

export async function publishTransactionEvent(tx: {
  id: string;
  facilityId: string;
  facilityName: string;
  amount: number;
  type: "crypto" | "fiat";
  chain: string;
  status: "pending" | "confirmed" | "failed" | "flagged";
}): Promise<void> {
  const isFlag = tx.status === "flagged";

  await publishLiveEvent("TRANSACTIONS", {
    type: isFlag ? "transaction:flagged" : "transaction:new",
    data: tx,
  });

  if (isFlag) {
    await publishLiveEvent("ALERTS", {
      type: "alert:new",
      data: {
        id: `alert_${Date.now()}`,
        severity: "high",
        msg: `Transaction ${tx.id} flagged: unusual pattern detected`,
        facility: tx.facilityName,
        txId: tx.id,
      },
    });
  }
}

export async function publishTransactionUpdate(txId: string, status: string, reason?: string): Promise<void> {
  await publishLiveEvent("TRANSACTIONS", {
    type: "transaction:updated",
    data: { txId, status, reason },
  });
}

export async function publishAgentStatus(agent: {
  name: string;
  status: "running" | "idle" | "warning" | "error";
  message?: string;
}): Promise<void> {
  await publishLiveEvent("AGENTS", {
    type: "agent:status",
    data: agent,
  });
}

export async function publishAgentMetric(agent: {
  name: string;
  processedCount: number;
  accuracy: number;
  cpuLoad: number;
  memoryMb?: number;
}): Promise<void> {
  await publishLiveEvent("AGENTS", {
    type: "agent:metric",
    data: agent,
  });
}

export async function publishAlert(alert: {
  id: string;
  severity: "high" | "medium" | "low";
  msg: string;
  facility: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await publishLiveEvent("ALERTS", {
    type: "alert:new",
    data: alert,
  });
}

export async function resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
  await publishLiveEvent("ALERTS", {
    type: "alert:resolved",
    data: { alertId, resolvedBy },
  });
}

export async function publishFacilityAction(action: {
  facilityId: string;
  facilityName: string;
  action: "login" | "payment_submitted" | "suspended" | "upgraded" | "onboarded";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await publishLiveEvent("FACILITIES", {
    type: "facility:action",
    data: action,
  });
}

export async function publishSystemMetric(metrics: {
  mrr?: number;
  activeFacilities?: number;
  txVolumeToday?: number;
  txCountToday?: number;
  uptime?: number;
}): Promise<void> {
  await publishLiveEvent("SYSTEM", {
    type: "system:metric",
    data: { snapshot: false, ...metrics },
  });
}
