import { createClient, RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL ?? "";

let publisherClient: RedisClientType | null = null;
export let redisPublisher: RedisClientType;
export let redisSubscriber: RedisClientType;

export async function getRedisPublisher(): Promise<RedisClientType> {
  if (!REDIS_URL) {
    throw new Error("REDIS_URL not configured");
  }
  if (!publisherClient) {
    publisherClient = createClient({ url: REDIS_URL }) as RedisClientType;
    publisherClient.on("error", (err) => console.error("[Redis Publisher]", err));
    await publisherClient.connect();
  }
  return publisherClient;
}

export function createRedisSubscriber(): RedisClientType {
  if (!REDIS_URL) {
    throw new Error("REDIS_URL not configured");
  }
  const sub = createClient({ url: REDIS_URL }) as RedisClientType;
  sub.on("error", (err) => console.error("[Redis Subscriber]", err));
  return sub;
}

export async function initRedis(): Promise<void> {
  if (!REDIS_URL) {
    return;
  }
  redisPublisher = await getRedisPublisher();
  redisSubscriber = createClient({ url: REDIS_URL }) as RedisClientType;
  redisSubscriber.on("error", (err) => console.error("[Redis Subscriber Base]", err));
  await redisSubscriber.connect();
}

export async function closeRedis(): Promise<void> {
  await publisherClient?.quit();
  await redisSubscriber?.quit();
}
