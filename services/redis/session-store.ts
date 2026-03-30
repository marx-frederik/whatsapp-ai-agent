import z from "zod";
import { getRedis } from "./client";

const PREFIX = "chat:session";

const PendingFollowUpSchema = z.object({
  toolName: z.string(),
  message: z.string(),
  options: z.array(z.string()).default([]),
  createdAt: z.string(),
});

export const ChatSessionSchema = z.object({
  chatId: z.string(),
  lastResponseId: z.string().optional(),
  pending: PendingFollowUpSchema.optional(),
  updatedAt: z.string(),
});

export type ChatSession = z.infer<typeof ChatSessionSchema>;

export async function getChatSession(chatId: string) {
  const redis = await getRedis();
  const data = await redis.get(`${PREFIX}:${chatId}`);

  if (!data) return null;

  const result = ChatSessionSchema.safeParse(JSON.parse(data));

  if (!result.success) {
    console.error("Invalid session in Redis", result.error);
    return null;
  }

  return result.data;
}

export async function setChatSession(session: ChatSession) {
  const redis = await getRedis();
  await redis.set(`${PREFIX}:${session.chatId}`, JSON.stringify(session), {
    EX: 60 * 60 * 24, // 24h TTL
  });
}
