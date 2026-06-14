# Implement: 同步上游 v2.2.3 执行清单

<!-- Trellis implement：有序执行清单、验证命令、review 闸、回滚点。技术依据见 design.md。 -->

## 阶段 0：前置清场（非破坏前的准备）

- [ ] `git branch backup/main-<ts>`（全量回滚锚点，记下名字）
- [ ] `git stash push -m "sync-v2.2.3 package.json"`（清掉 `M package.json`）
- [ ] 移开 untracked 工具目录避开目录级碰撞陷阱：`.agents/` `.codex/` `.cursor/` → 暂存到仓外，同步后恢复
- [ ] `git config rerere.enabled true`

## 阶段 1：Seg1 — rebase 到 `235a16fc11`（#62）

- [ ] `git rebase 235a16fc11`
- [ ] 预期冲突：`AgentToolsEngine/index.ts`、`market.ts`（`src/server/` 旧路径，工具系统）→ **冲突方向问椰椰**
- [ ] 验证：`git status` clean + 无 `.git/rebase-*` 残留
- [ ] `git branch checkpoint/sync-20260614-seg-1`

## 阶段 2：Seg2 — rebase 到 `64d3bdb978`（#88）

- [ ] `git rebase 64d3bdb978`
- [ ] 预期冲突：`contextEngineering.ts`、`google/index.ts`（**search1api 首卡点 ↔ #85 SSRF**）、`db/topic.ts`、`PopoverContent.tsx`、`klavis.ts`、`topic-router`（旧路径）
- [ ] `google` 冲突方向：search1api citations 解析 vs 上游 SSRF 校验 → **问椰椰**
- [ ] 验证 + `checkpoint/sync-20260614-seg-2`

## 阶段 3：Seg3 — rebase 到 `c02e5720c2`（#128）

- [ ] `git rebase c02e5720c2`
- [ ] 预期：server 4 文件 **#89 路径迁移**（`src/server/` → `apps/server/src/`），git 自动跟随 rename，内容冲突仍需解
- [ ] ⚠️ 若出现 server 二次冲突 → 提示椰椰考虑回退 Seg2 边界到 `#82`（design §5）
- [ ] 验证 + `checkpoint/sync-20260614-seg-3`

## 阶段 4：Seg4 — rebase 到 `553d3d8fc7`（v2.2.3）

- [ ] `git rebase 553d3d8fc7`
- [ ] 预期冲突：9 前端文件（ChatInput Tools、SkillStore、ProfileEditor、route hooks、`mobileRouter.config.tsx`）
- [ ] 验证 + `checkpoint/sync-20260614-seg-4`

## 阶段 5：收尾

- [ ] 恢复 untracked 工具目录（`.agents/` `.codex/` `.cursor/`）
- [ ] `git stash pop`（恢复 package.json）
- [ ] `pnpm install`（lockfile gitignored，node_modules 需重装 — post-sync 必做）
- [ ] `bun run type-check`（验收标准）
- [ ] 更新 `.git/sync-upstream-state.json`（last_synced_to=v2.2.3）
- [ ] **等椰椰授权** → `git push origin main --force-with-lease`
- [ ] Vercel 预览验证 7 个自定义功能不回归
- [ ] DB migration 0106–0110 部署时自动执行（不在本地跑）

## 验证 tier（分段执行，不每段全量）

| 段类型 | 验证                                                           |
| ------ | -------------------------------------------------------------- |
| 每段   | `git status` clean + 无 `.git/rebase-*`                        |
| 冲突段 | + grep 相关定制点 + 该 package 测试（type-check 推迟到最终段） |
| 最终段 | + `pnpm install` + `bun run type-check` 全量                   |

## 回滚点

- `backup/main-<ts>`：全量 `git reset --hard backup/main-<ts>`
- `checkpoint/sync-20260614-seg-N`：逐段回滚
- 某段卡死 → `git rebase --abort` 回该段起点，backup 始终在
