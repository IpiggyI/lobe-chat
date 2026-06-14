# Design: 同步上游 v2.2.3 技术方案

<!-- Trellis design：技术方案、边界、契约、数据流、权衡、回滚形态。需求/验收在 prd.md。 -->

## 1. 同步参数

- **同步源**：`upstream/main`（fork 跟踪 release 分支；上游开发在 `canary`）
- **起点 BASE**：`v2.2.2` = `248a4dca`（已是当前 HEAD 祖先，上次同步已落地）
- **目标 TARGET**：`v2.2.3` = `upstream/main` HEAD = `553d3d8fc7`
- **范围**：134 commits，**无 BREAKING**，无中间 stable tag（pure release stream → 冲突簇切分）
- **canary**：领先 main 93 commit（未发布，本任务不同步）

## 2. 分段方案（4 段，冲突簇切分）

| 段   | chain 范围 | 锚点 sha     | commit 数 | merge-tree 实测增量冲突                                                                 |
| ---- | ---------- | ------------ | --------- | --------------------------------------------------------------------------------------- |
| Seg1 | #1–62      | `235a16fc11` | 62        | 2：AgentToolsEngine、market（`src/server/` 旧路径）                                     |
| Seg2 | #63–88     | `64d3bdb978` | 26        | 6：contextEngineering、google、db/topic、PopoverContent、klavis、topic-router（旧路径） |
| Seg3 | #89–128    | `c02e5720c2` | 40        | 4：`apps/server/` 下 AgentToolsEngine、klavis、topic、market（#89 迁移后新路径）        |
| Seg4 | #129–134   | `553d3d8fc7` | 6         | 9：ChatInput/Skill/Profile/route/mobileRouter 前端                                      |

边界均落在 clean（非冲突）commit 上。

## 3. 17 个冲突文件（merge-tree 实测，按 fork 功能域）

**A. 工具 / Skill 系统（runtime tools toggle / 手动激活）**

- `apps/server/src/modules/Mecha/AgentToolsEngine/index.ts`
- `src/services/chat/mecha/contextEngineering.ts`
- `src/features/ChatInput/ActionBar/Tools/{KlavisServerItem,LobehubSkillServerItem,PopoverContent}.tsx`
- `src/features/ProfileEditor/AgentTool.tsx`
- `src/features/SkillStore/SkillList/{AddSkillButton,Custom/Item}.tsx`
- `src/routes/(main)/settings/skill/features/Actions.tsx`
- `src/routes/(main)/agent/profile/features/ProfileEditor/MentionList/useMentionItems.tsx`

**B. Klavis/Market（klavis-market-500-fix）**

- `apps/server/src/routers/lambda/klavis.ts`
- `apps/server/src/routers/tools/market.ts`

**C. Topic（topic-create-fk-fix / topic-message-api-fields）**

- `apps/server/src/routers/lambda/topic.ts`
- `packages/database/src/models/topic.ts`

**D. 模型运行时**

- `packages/model-runtime/src/providers/google/index.ts`

**E. 路由 / 菜单（mobileRouter ↔ vercel-mobile-invisible）**

- `src/spa/router/mobileRouter.config.tsx`
- `src/routes/(main)/home/_layout/hooks/useSessionGroupMenuItems.tsx`

## 4. 关键发现

1. **#89 路径迁移**：`refactor: extract server into apps/server (#14949)` 把 4 个 fork 改过的 server 文件从 `src/server/` 整体迁移到 `apps/server/src/`（AgentToolsEngine、klavis、topic-router、market）。merge-tree 差分显示它们在 #128 "旧路径消失 + 新路径新增" → 证实是 rename。git rebase 会自动跟随 rename 到新路径，但内容冲突仍要解。
2. **净冲突 ≈ 13**（17 减去 4 个路径重复变体）。
3. **预演首卡点（worktree 实测）**：fork commit `35bf02e6e8 fix(search1api)` ↔ upstream #85 google SSRF 校验，冲突文件 `packages/model-runtime/src/providers/google/index.ts`。前 16 个 fork commit 干净重放，≥1 个（`71f4ddc4cf`）被 git 识别已上游化自动跳过。预演未走到 #89，server rename 行为未经实测验证。
4. **安全区（auto-merge 无冲突）**：effort sliders（`ControlsForm.tsx`/`LevelSlider.tsx`/`modelParamsResolver.ts`）、incognito store（`aiChat/streamingExecutor.ts`/`conversationLifecycle.ts`）、locales。→ 这 3 块这轮不用碰。

## 5. 锚点 #88 风险（flag，按 prd 执行不擅改）

prd 定 Seg2=#88，把 `#83 server 内容改` 和 `#89 路径迁移` 切到两段，server 4 文件可能 **Seg2 旧路径 + Seg3 新路径解两遍**。

- **Fallback**：若 Seg3 实际出现 server 二次冲突，提示椰椰考虑回退 Seg2 边界到 `#82`（#83 之前），让内容改 + 路径迁移落同段一次性解决。
- rerere 已启用，相同冲突可记忆复用，部分缓解。

## 6. 需椰椰判断的冲突方向（不自作主张）

- **search1api ↔ google SSRF 校验**：fork 的 citations 解析改动如何与上游新增的 External URL SSRF 校验共存。
- **tool-toggle ↔ Connectors 系统**：fork 的运行时工具开关如何与上游新的 Connectors（API 级工具权限）共存。

## 7. 回滚形态

- `backup/main-<ts>`：全量回滚锚点（`git reset --hard backup/main-<ts>`）。
- `checkpoint/sync-20260614-seg-N`：逐段回滚点，每段落地后建。
- 任一段冲突无法解决 → `git rebase --abort` 回到该段起点，backup 始终保留。
