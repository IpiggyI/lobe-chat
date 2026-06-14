# Resume State — v2.2.3 sync (✅ COMPLETED 2026-06-14)

> **同步已完成，勿再 resume/rebase。** main @ `418e167023` 已 force-with-lease 推到 origin。
> 收尾：Seg4 八文件解法 + mobileRouter `/image`→shared 段 + LevelSlider 去重 (`96aa48eec6`) +
> cherry-pick bot 移动模板 (`418e167023`, 保 fork CDN bundle) + stash pop wasm overrides (本地未提交)。
> type-check PASS、trellis-check PASS。tag `v2.2.3-canary.1` 已推、旧 `v2.2.2-canary.1` 已删。
> 移动端重建已触发 (gh run 27493387316)。剩余验证项见下方 & `.git/sync-upstream-state.json`。
>
> 以下为历史断点记录 (保留供追溯)。

## 当前 git 状态（实测）

- `git rebase` IN PROGRESS：**18/56**，onto = v2.2.3 `553d3d8fc7`
- 暂停在 fork commit `5518f46f31 🐛 fix: reduce store barrel imports for vercel build`
- detached HEAD（最后成功应用）：`481b0d6c09`
- 8 个 UU 冲突文件（见下，**椰椰已确认解法，尚未应用**）

### 恢复锚点

- backup（全量回滚）：`backup/main-20260614-033118`
- checkpoints：`checkpoint/sync-20260614-seg-1` / `-seg-2` / `-seg-3`
- stash：`stash@{0}` = "sync-v2.2.3 package.json wasm overrides"（2 行 overrides：`@emnapi/wasi-threads`、`@napi-rs/wasm-runtime`）
- aside 目录：`.git/sync-v2.2.3-aside-20260614-033118/cursor-skills`（fork 的 `.cursor/skills/` 移此）
- rerere：已 on（56+ 条记录）

## 进度

| 段   | 锚点                | 状态                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seg1 | #62 `235a16fc11`    | ✅ done + checkpoint。解：AgentToolsEngine（agent 分支用 `enabledDefaultToolIds`）、market.ts（timeout+auth guard 两全）                                                                                                                                                                                                                                                                               |
| Seg2 | #88 `64d3bdb978`    | ✅ done + checkpoint。解：contextEngineering（上游异步块 + 保 fork `tools?.includes(SkillsIdentifier)` 省 token gate）、PopoverContent（上游版 + `maxHeight:480`）、google（fork `try{`/logRawError + 上游 `{model}` 参）、incognito topic×2（上游 `ownership()`/`buildWorkspacePayload` + fork `mode`/`excludeEphemeral`/`cleanupTempTopics`，丢未用 `authedProcedure`）、klavis（取 fork 侧 import） |
| Seg3 | #128 `c02e5720c2`   | ✅ done + checkpoint。**#89 server 迁移零冲突**：4 文件已到 `apps/server/src/`，定制点全存活                                                                                                                                                                                                                                                                                                           |
| Seg4 | v2.2.3 `553d3d8fc7` | 🔄 进行中 18/56，**暂停在首冲突 5518f46f31**                                                                                                                                                                                                                                                                                                                                                           |

## ⬇️ 立即恢复步骤

### 1. 应用已确认的 8 文件解法（椰椰已批准）

统一模式：**冲突区保上游 `import { usePermission } from '@/hooks/usePermission';` + fork 的 store 直接 import；丢旧 barrel（`@/store/agent`、`@/store/tool`）**。已验证无重复 import。

**5 个「空 fork 侧」文件** → 冲突区只留 `import { usePermission } from '@/hooks/usePermission';`（旧 barrel `useAgentStore from '@/store/agent'` 删掉；`@/store/agent/store` 直接版已 auto-merge 在冲突区下方）：

- `src/features/ChatInput/ActionBar/Tools/KlavisServerItem.tsx`
- `src/features/ChatInput/ActionBar/Tools/LobehubSkillServerItem.tsx`
- `src/features/ProfileEditor/AgentTool.tsx`
- `src/features/SkillStore/SkillList/Custom/Item.tsx`
- `src/routes/(main)/settings/skill/features/Actions.tsx`

**3 个「非空 fork 侧」文件** → 冲突区 = usePermission + fork 侧直接 import：

- `src/features/SkillStore/SkillList/AddSkillButton.tsx`：
  ```
  import { usePermission } from '@/hooks/usePermission';
  import { useAgentStore } from '@/store/agent/store';
  import { useToolStore } from '@/store/tool/store';
  ```
- `src/routes/(main)/agent/profile/features/ProfileEditor/MentionList/useMentionItems.tsx`：
  ```
  import { usePermission } from '@/hooks/usePermission';
  import { useAgentStore } from '@/store/agent/store';
  import { pluginHelpers } from '@/store/tool/helpers';
  ```
  （`useToolStore from '@/store/tool/store'` 已在下方第 25 行，勿重复加）
- `src/routes/(main)/home/_layout/hooks/useSessionGroupMenuItems.tsx`：
  ```
  import { usePermission } from '@/hooks/usePermission';
  import { useAgentStore } from '@/store/agent/store';
  ```

### 2. 收尾本 commit

```bash
# 验证 8 文件无冲突标记 + 无重复 import
grep -rnE '^(<<<<<<<|=======|>>>>>>>)' <8 files>
git add <8 files>
GIT_EDITOR=true git rebase --continue
```

### 3. 继续 Seg4 剩余冲突（逐个确认模式）

design 预测 Seg4 还有前端冲突（`mobileRouter.config.tsx` 等）。早段已解的文件（KlavisServerItem 等）在后续 commit 可能 rerere 自动复用。**每个真冲突继续问椰椰方向**（椰椰选的是「采纳 + 逐个确认」）。

### 4. Seg4 落地

```bash
git status # clean + 无 rebase-*
git merge-base --is-ancestor 553d3d8fc7 HEAD && echo "v2.2.3 是祖先 ✓"
git branch checkpoint/sync-20260614-seg-4
```

### 5. Phase 6/7 收尾（sync-upstream skill）

1. **恢复 aside**：fork 的 `.cursor/skills/` 在 `.git/sync-v2.2.3-aside-20260614-033118/cursor-skills`。
   ⚠️ **需椰椰决策**：上游 v2.2.3 已把 `.cursor/skills`、`.codex/skills` 做成 symlink → `../.agents/skills`，而 fork 的 `.agents/skills/trellis-*` 已存在。**推荐保上游 symlink、丢 fork 目录副本**（冗余）；或恢复 fork 目录。`.codex/skills` 本地无目录，symlink 干净创建无需处理。
2. `git stash pop`（恢复 package.json 的 2 行 wasm overrides；overrides 块可能与上游冲突，解时保 fork 2 行 + 上游变更）。
3. `pnpm install`（lockfile gitignored，post-sync 必做 — 见 \[\[post-sync-hygiene]]）。
4. `bun run type-check`（验收标准）。
5. 更新 `.git/sync-upstream-state.json`：`last_synced_to=v2.2.3`、`last_synced_to_sha=553d3d8fc784196a680529a7868bf782b5276bd7`、staged_sync 段状态、backup_branch。
6. **push 需椰椰显式授权**：`git push origin main --force-with-lease`。
7. Vercel 验证 7 个 fork 功能不回归；DB migration 0106–0110 部署时自动执行（不本地跑）。

## 出问题回退

- 某段卡死：`git rebase --abort` → 回到 Seg4 起点（= checkpoint/sync-20260614-seg-3）→ 重跑 `git rebase 553d3d8fc7`（rerere 复用已记录解法）。
- 全量灾难：`git reset --hard backup/main-20260614-033118`，aside 目录手动 `mv` 回。
