import { and, eq, lt } from 'drizzle-orm';

import { topics } from '../../schemas';
import type { LobeChatDatabase } from '../../type';

export const TEMP_TOPIC_TTL_MS = 24 * 60 * 60 * 1000;

export interface CleanupTempTopicsOptions {
  now?: Date;
  ttlMs?: number;
  userId: string;
}

/**
 * Delete expired incognito topics (mode='temp' AND updatedAt < now - ttl).
 * Cascades to `messages` via FK onDelete: cascade.
 *
 * Three-layer guard:
 *  1. userId scope — never crosses users
 *  2. strict mode='temp' match — leaves default/test alone
 *  3. updatedAt < cutoff — only expired
 */
export const cleanupTempTopics = async (
  db: LobeChatDatabase,
  { now = new Date(), ttlMs = TEMP_TOPIC_TTL_MS, userId }: CleanupTempTopicsOptions,
) => {
  const cutoff = new Date(now.getTime() - ttlMs);

  const deletedTopics = await db
    .delete(topics)
    .where(
      and(eq(topics.userId, userId), eq(topics.mode, 'temp'), lt(topics.updatedAt, cutoff)),
    )
    .returning({ id: topics.id });

  return { cutoff, deletedCount: deletedTopics.length };
};
