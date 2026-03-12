import { Router, Request, Response } from "express";
import { redisSubscriber, redisPublisher } from "../../lib/redis";
import { requireSuperAdmin, AuthRequest } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

const router = Router();

export const CHANNELS = {
  TRANSACTIONS: "admin:transactions",
  AGENTS: "admin:agents",
  ALERTS: "admin:alerts",
  FACILITIES: "admin:facilities",
  SYSTEM: "admin:system",
} as const;

export type LiveEventType =
  | "transaction:new"
  | "transaction:updated"
  | "transaction:flagged"
  | "agent:status"
  | "agent:metric"
  | "alert:new"
  | "alert:resolved"
  | "facility:action"
  | "system:metric"
  | "heartbeat";

export interface LiveEvent {
  type: LiveEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

function sendEvent(res: Response, event: LiveEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function sendError(res: Response, message: string): void {
  res.write(`data: ${JSON.stringify({ type: "error", message, timestamp: new Date().toISOString() })}\n\n`);
}

router.get("/stream", requireSuperAdmin, async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const adminId = (req as AuthRequest).user?.id ?? "unknown";

  try {
    const [recentTx] = await Promise.all([
      prisma.transaction.findMany({
        select: { id: true, senderId: true, fromAmount: true, type: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    sendEvent(res, {
      type: "system:metric",
      timestamp: new Date().toISOString(),
      data: {
        snapshot: true,
        recentTx: recentTx.map((t) => ({
          id: t.id,
          facilityId: t.senderId,
          amount: t.fromAmount,
          type: t.type,
          chain: "internal",
          status: t.status,
          createdAt: t.createdAt,
        })),
        agentMetrics: [],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sendError(res, message);
  }

  const channels = Object.values(CHANNELS);
  const subscriber = redisSubscriber.duplicate();
  await subscriber.connect();

  await subscriber.subscribe(channels, (message) => {
    try {
      const event: LiveEvent = JSON.parse(message);
      sendEvent(res, event);
    } catch {
      sendError(res, "Malformed event payload");
    }
  });

  const heartbeat = setInterval(() => {
    sendEvent(res, {
      type: "heartbeat",
      timestamp: new Date().toISOString(),
      data: { uptime: process.uptime(), adminId },
    });
  }, 20_000);

  req.on("close", async () => {
    clearInterval(heartbeat);
    await subscriber.unsubscribe(channels);
    await subscriber.quit();
  });
});

router.post("/stream/publish", requireSuperAdmin, async (req: Request, res: Response) => {
  const { channel, event } = req.body as { channel: keyof typeof CHANNELS; event: LiveEvent };

  if (!CHANNELS[channel]) {
    return res.status(400).json({ error: "Invalid channel" });
  }

  try {
    await publishLiveEvent(channel, event);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Publish failed" });
  }
});

export async function publishLiveEvent(
  channel: keyof typeof CHANNELS,
  event: Omit<LiveEvent, "timestamp">,
): Promise<void> {
  const payload: LiveEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  await redisPublisher.publish(CHANNELS[channel], JSON.stringify(payload));
}

export default router;
