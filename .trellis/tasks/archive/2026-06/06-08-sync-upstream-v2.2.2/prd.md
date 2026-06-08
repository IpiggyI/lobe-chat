# PRD: 同步上游 v2.2.1 → v2.2.2

## 背景

Fork (IpiggyI/lobe-chat) 上次同步到 v2.2.1（2026-05-30）。上游发布 v2.2.2（2026-06-04），92 commits、1012 files changed。需要 rebase fork 的 52 个自定义 commit 到 v2.2.2 之上。

## 目标

- Rebase fork main 到 `v2.2.2` (`248a4dcab5`)
- 保留所有 fork 自定义功能（incognito chat、effort slider defaults、runtime tools toggle、manual skill activation、Vercel/mobile build scripts）
- 合入上游新功能（topic group-by-status、workspace/agent-share tables、device auto-register、push channel、step3_5 reasoning effort 等）
- Type-check 通过，关键测试绿

## 约束

- Target ref: `248a4dcab5` (v2.2.2^{commit})，不是 `upstream/main` HEAD（后者会前移）
- Untracked collision dirs (.agents/.cursor/.codex/.ccg/) 必须 rebase 前搬走
- Git 操作严格串行，每步验证状态
- 冲突侧反转：`<<<HEAD` = upstream，`>>>sha` = fork
- 不使用 `--theirs` / `--ours` 一把梭

## Acceptance Criteria

- [ ] `git log --oneline v2.2.2..HEAD` 只包含 fork-only commits（无重复、无遗漏）
- [ ] `bun run type-check` — 0 errors
- [ ] `bunx vitest run --silent='passed-only' src/services/chat/mecha/modelParamsResolver.test.ts` PASS
- [ ] `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/topics/topic.create.test.ts` PASS
- [ ] `bunx vitest run --silent='passed-only' src/server/routers/lambda/__tests__/topic.test.ts` PASS
- [ ] `.git/sync-upstream-state.json` 更新到 v2.2.2
- [ ] Push to origin/main via `--force-with-lease`（用户授权后）

## 风险

| 区域 | 风险 | 缓解 |
|---|---|---|
| Incognito chat | 上游删除 ephemeral topic API 层 | DB mode 列仍在；router schema 手动加回 mode 字段 |
| aiAgent/index.ts | 上游 172 行重构 vs fork 5 个 commit | 非重叠区域，按 region 合并 |
| package.json | fork 7 个 build script commit vs upstream deps | 保留 fork scripts，合入 deps |
| Effort sliders | 上游移除 fallback defaults | 保留 fork `|| default` 模式 |

## 参考文档

- `digest.md` — 变更摘要（同目录）
- `resolution-plan.md` — 冲突解决策略（同目录）
- `implement.md` — 执行计划（同目录）
- `.memory/tasks/2026-05/05-30-sync-upstream-v2.2.1/what.md` — 上次同步经验
