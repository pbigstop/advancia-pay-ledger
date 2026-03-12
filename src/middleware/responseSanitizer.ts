import { Request, Response, NextFunction } from "express";

const FORBIDDEN_KEYS = new Set([
  "agentType", "agentName", "llm", "model", "aiModel", "openai", "anthropic",
  "claudeResponse", "gptResponse", "aiGenerated", "aiPowered", "isAi",
  "agentTask", "agentId", "orchestrator", "internalAgentType",
  "internalNotes", "debugInfo", "rawPrompt", "systemPrompt", "promptTokens",
  "completionTokens", "totalTokens", "modelVersion", "temperature", "topP",
  "apiKey", "secretKey", "privateKey", "jwtSecret", "encryptionKey",
  "password", "passwordHash", "salt", "totpSecret", "backupCodes",
  "stripeSecretKey", "webhookSecret", "sendgridKey", "rpcUrl",
  "databaseUrl", "redisUrl", "connectionString", "adminToken",
  "rawCardData", "cvv", "cardNumber", "bankAccountNumber", "routingNumber",
  "internalRiskFlags", "fraudModel", "mlScore", "predictionModel",
  "_count", "executionPath", "agentChain", "modelChain",
]);

const FORBIDDEN_VALUE_PATTERNS = [
  /sk-[a-zA-Z0-9]{32,}/,
  /whsec_[a-zA-Z0-9]{32,}/,
  /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/,
  /postgresql:\/\/[^:]+:[^@]+@/,
  /redis:\/\/:[^@]+@/,
  /[0-9a-f]{64}/,
  /(claude|anthropic|openai|gpt-4|gpt-3)/i,
  /\b(AI agent|language model|LLM|neural network|machine learning model)\b/i,
];

function sanitizeValue(val: any, depth = 0): any {
  if (depth > 10) return val;
  if (val === null || val === undefined) return val;
  
  if (typeof val === "string") {
    for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
      if (pattern.test(val)) return "[REDACTED]";
    }
    return val;
  }
  
  if (Array.isArray(val)) {
    return val.map(item => sanitizeValue(item, depth + 1));
  }
  
  if (typeof val === "object") {
    return sanitizeObject(val, depth + 1);
  }
  
  return val;
}

function sanitizeObject(obj: Record<string, any>, depth = 0): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (key.startsWith("_") && key !== "__typename") continue;
    clean[key] = sanitizeValue(value, depth);
  }
  return clean;
}

export function responseSanitizer(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  
  res.json = (body: any) => {
    if (res.statusCode >= 500) {
      return originalJson({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        requestId: req.headers["x-request-id"] || "unknown",
      });
    }
    
    const sanitized = typeof body === "object" && body !== null
      ? sanitizeValue(body)
      : body;
    
    return originalJson(sanitized);
  };
  
  next();
}

export function sanitizeLogData(data: any): any {
  return sanitizeValue(data);
}

export function auditEnvironmentExposure() {
  const dangerousEnvVars = [
    "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "JWT_SECRET",
    "ENCRYPTION_KEY", "STRIPE_SECRET_KEY", "SENDGRID_API_KEY",
    "DATABASE_URL", "REDIS_URL",
  ];
  
  const exposed: string[] = [];
  for (const envVar of dangerousEnvVars) {
    if (process.env[envVar]) {
      const val = process.env[envVar]!;
      if (val.length > 0) {
        console.log(`[Security] ${envVar}: ✓ Present (${val.length} chars, hidden)`);
      }
    } else {
      exposed.push(envVar);
    }
  }
  
  if (exposed.length > 0) {
    console.warn(`[Security] Missing environment variables: ${exposed.join(", ")}`);
  }
  return exposed;
}

export function buildResponse(data: any, meta?: {
  processedBy?: string;
  requestId?: string;
}) {
  return {
    data: sanitizeValue(data),
    meta: {
      processedBy: meta?.processedBy || "Advancia Platform",
      platform: "advancia-healthcare.com",
      timestamp: new Date().toISOString(),
      ...(meta?.requestId && { requestId: meta.requestId }),
    },
  };
}
