import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../../core/getTestDB';
import { topics, users } from '../../../schemas';
import type { LobeChatDatabase } from '../../../type';
import { cleanupTempTopics, TEMP_TOPIC_TTL_MS } from '../cleanup-temp-topics';

const userId = 'cleanup-temp-user';
const otherUserId = 'cleanup-temp-other';
const serverDB: LobeChatDatabase = await getTestDB();

const now = new Date('2026-05-19T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

const seedTopic = async (overrides: Partial<typeof topics.$inferInsert>) => {
  const [row] = await serverDB
    .insert(topics)
    .values({
      id: `topic-${Math.random().toString(36).slice(2, 10)}`,
      userId,
      title: 'seed',
      ...overrides,
    })
    .returning();
  return row;
};

describe('cleanupTempTopics', () => {
  beforeEach(async () => {
    await serverDB.delete(users);
    await serverDB.insert(users).values([{ id: userId }, { id: otherUserId }]);
  });

  afterEach(async () => {
    await serverDB.delete(users);
  });

  it('removes temp topics older than the default TTL (24h)', async () => {
    const stale = await seedTopic({ mode: 'temp', updatedAt: hoursAgo(25) });

    const result = await cleanupTempTopics(serverDB, { now, userId });

    expect(result.deletedCount).toBe(1);
    const remaining = await serverDB.select().from(topics).where(eq(topics.id, stale.id));
    expect(remaining).toHaveLength(0);
  });

  it('keeps temp topics younger than the TTL', async () => {
    const fresh = await seedTopic({ mode: 'temp', updatedAt: hoursAgo(1) });

    const result = await cleanupTempTopics(serverDB, { now, userId });

    expect(result.deletedCount).toBe(0);
    const remaining = await serverDB.select().from(topics).where(eq(topics.id, fresh.id));
    expect(remaining).toHaveLength(1);
  });

  it('never deletes topics with mode="default" even if very old', async () => {
    const persistent = await seedTopic({ mode: 'default', updatedAt: hoursAgo(24 * 30) });

    const result = await cleanupTempTopics(serverDB, { now, userId });

    expect(result.deletedCount).toBe(0);
    const remaining = await serverDB.select().from(topics).where(eq(topics.id, persistent.id));
    expect(remaining).toHaveLength(1);
  });

  it('never deletes legacy topics with mode=null (pre-migration data)', async () => {
    const legacy = await seedTopic({ mode: null, updatedAt: hoursAgo(24 * 30) });

    const result = await cleanupTempTopics(serverDB, { now, userId });

    expect(result.deletedCount).toBe(0);
    const remaining = await serverDB.select().from(topics).where(eq(topics.id, legacy.id));
    expect(remaining).toHaveLength(1);
  });

  it('only deletes temp topics for the target userId', async () => {
    const otherUserTemp = await seedTopic({
      mode: 'temp',
      updatedAt: hoursAgo(30),
      userId: otherUserId,
    });

    const result = await cleanupTempTopics(serverDB, { now, userId });

    expect(result.deletedCount).toBe(0);
    const remaining = await serverDB.select().from(topics).where(eq(topics.id, otherUserTemp.id));
    expect(remaining).toHaveLength(1);
  });

  it('honors the injected `now` argument to compute cutoff', async () => {
    // Topic touched 5h before fixed `now`; default TTL is 24h, so should be kept.
    const touched = await seedTopic({ mode: 'temp', updatedAt: hoursAgo(5) });

    const result = await cleanupTempTopics(serverDB, { now, userId });

    expect(result.deletedCount).toBe(0);
    expect(result.cutoff.getTime()).toBe(now.getTime() - TEMP_TOPIC_TTL_MS);
    const remaining = await serverDB.select().from(topics).where(eq(topics.id, touched.id));
    expect(remaining).toHaveLength(1);
  });

  it('honors a custom ttlMs', async () => {
    const updatedAt = new Date(now.getTime() - 90_000); // 90s ago
    const fresh = await seedTopic({ mode: 'temp', updatedAt });

    const result = await cleanupTempTopics(serverDB, { now, ttlMs: 60_000, userId });

    expect(result.deletedCount).toBe(1);
    const remaining = await serverDB.select().from(topics).where(eq(topics.id, fresh.id));
    expect(remaining).toHaveLength(0);
  });
});
