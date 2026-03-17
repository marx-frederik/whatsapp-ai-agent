import { env } from "@/data/env/server";
import { createClient } from "redis";

let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedis() {
  if (!redisClient) {
    const redisUrl = env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL is required when using Redis.");
    }

    redisClient = createClient({
      username: "default",
      password: env.REDIS_KEY,
      socket: {
        host: env.REDIS_URL,
        port: env.REDIS_PORT,
      },
    });

    redisClient.on("error", (err) => {
      console.error("Redis Client Error", err);
    });

    await redisClient.connect();
  }

  return redisClient;
}
