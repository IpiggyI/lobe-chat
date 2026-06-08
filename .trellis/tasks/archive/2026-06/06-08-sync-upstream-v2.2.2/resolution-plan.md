# v2.2.2 Sync — Conflict Resolution Plan

## Overview

28 overlapping files. 5 high-risk, 6 medium-risk, 17 low-risk (auto-merge).
Fork has 52 commits to replay. No upstream breaking changes, but upstream removed ephemeral topic lifecycle code that fork's incognito feature depends on.

---

## 1. Incognito Chat (HIGH — most complex)

### What happened upstream
- Removed `createEphemeralTopic`, `saveEphemeralTopic`, `discardEphemeralTopic` from `topic/action.ts`
- Removed `isVisibleTopic`, `ephemeralTopics` selectors from `topic/selectors.ts`
- Removed `mode` field from `createTopic` / `batchCreateTopics` router zod schema
- Removed `cleanupTempTopics` call from `getTopics` route handler
- Removed incognito guard in `conversationLifecycle.ts` `applyTopicTitle()`

### What's preserved
- DB schema `topics.mode` column **still exists** (`text('mode')`)
- Fork's topic model `create()` uses explicit `mode: params.mode ?? 'default'` (line 634) — mode reaches DB correctly
- `packages/database/src/server/services/cleanup-temp-topics.ts` — confirmed still exists in upstream v2.2.2 tree (file NOT deleted, only the router import + call was removed)

### Resolution strategy: **Keep fork code, adapt API layer**

The fork's incognito feature is self-contained. During rebase:

1. **`topic/action.ts`** — Keep fork's `createEphemeralTopic/save/discard` methods. Upstream adds `sortBy` param to `useTopicListSWR` — take that addition (purely additive, no conflict with fork methods).

2. **`topic/selectors.ts`** — Keep fork's `isVisibleTopic` and `ephemeralTopics`. Upstream adds `groupTopicsByStatus` — take that addition. The `getGroupFn` refactor adds `loadingTopicIds` param — take it (fork's filtering happens before grouping, no interaction).

3. **`src/server/routers/lambda/topic.ts`** — This is the critical one:
   - Fork needs `mode` in multiple schemas. Upstream removed it.
   - **Solution**: Add `mode: z.enum(['default', 'temp', 'test']).optional()` back to **three** schemas:
     - `createTopic` — `createEphemeralTopic` passes `mode: 'temp'`
     - `batchCreateTopics` — if fork uses it for batch topic creation
     - `updateTopic` value object — `saveEphemeralTopic` calls `internal_updateTopic(topicId, { mode: 'default' })` to persist
   - Keep fork's `cleanupTempTopics` call in `getTopics`.
   - Ensure `src/services/topic/index.ts` transparently passes `mode` through to the tRPC client.

4. **`src/services/topic/index.ts`** — Upstream adds `sortBy` and `getMaxTaskDuration`. Fork has agentId routing comment. Take upstream additions, keep fork comment.

5. **`conversationLifecycle.ts`** — Upstream adds `markdownToTxt()` wrapping for topic title. Fork adds incognito guard.
   - **Solution**: Keep fork's temp-mode guard AND take upstream's `markdownToTxt` improvement. They operate at different points — guard exits early for temp topics, markdownToTxt applies to non-temp topics.

### Verification
- After rebase: create an incognito chat, verify it gets `mode: 'temp'` in DB
- Verify `isVisibleTopic` still filters temp topics from sidebar
- Verify save/discard still work

---

## 2. Effort Slider Defaults (MEDIUM)

### What happened upstream
- Added `step3_5ReasoningEffort` for Step 3.5/3.7 models
- Upstream still uses `&& chatConfig.xxx` pattern (only send when explicitly set)

### Fork difference
- Fork uses `|| 'medium'` / `|| 'high'` / `|| 'none'` fallbacks for see-what-you-send alignment

### Resolution strategy: **Keep fork defaults**

Fork's `|| default` pattern is intentional (see-what-you-send: the API should send what the UI displays). Take upstream's new `step3_5ReasoningEffort` block but apply fork's default pattern to it.

Specifically:
- Keep fork's `|| 'medium'` for reasoningEffort, gpt5, grok4_20, codexMax
- Keep fork's `|| 'high'` for effort, opus47Effort, hy3
- Keep fork's `|| 'none'` for gpt5_2 (non-gpt-5.5) and `|| 'low'` for grok4_3
- Keep fork's hardcoded `'high'` for gpt5_2Pro
- Add upstream's new `step3_5ReasoningEffort` with `|| 'medium'` default

### Adaptive thinking
- Fork adds `adaptiveOnly` logic for Opus 4.6/4.7 (default ON for adaptive-only models)
- Upstream keeps original pattern (explicit check only)
- **Keep fork's version** — this is a deliberate fix for thinking display

---

## 3. ControlsForm.tsx (MEDIUM)

### What happened upstream
- Added `Step3_5ReasoningEffortSlider` component entry

### Fork difference
- Fork has effort slider `getValueProps` lock for gpt5_2Pro (forces 'high')

### Resolution: **Merge both**
Take upstream's Step3_5 slider addition. Keep fork's getValueProps overrides. No overlap — they touch different form items.

---

## 4. contextEngineering.ts (MEDIUM)

### What happened upstream
- Added `session_date` and `sandbox_enabled` template variables
- Removed `SkillsIdentifier` gating (always resolves skills now)

### Fork difference
- Fork re-added `SkillsIdentifier` gating (token-saving: only inject skill prompts when AI can activate skills)

### Resolution: **Keep fork's gating, add upstream's new vars**
Fork's SkillsIdentifier gating is a deliberate token optimization. Take upstream's `session_date` and `sandbox_enabled` additions (they're at a different location in the template vars). The conflict is in the `skillsConfig` block — keep fork's `tools?.includes(SkillsIdentifier)` guard.

---

## 5. market.ts (LOW)

### Upstream
- Extracted inline message string to `MARKET_AUTH_REQUIRED_MESSAGE` constant from `@lobechat/desktop-bridge`

### Fork
- Added try/catch guards for klavis/market 500s

### Resolution: **Take both** — fork's guard wraps the throw, upstream's message extraction applies inside the throw. Compatible.

---

## 6. aiAgent/index.ts (MEDIUM-HIGH)

### Upstream (172 lines changed: +80/-92)
- Added `DeviceModel` import + device cwd resolution (topic-level override → device defaultCwd)
- Added `buildRemoteDeviceHeteroContext` for device-specific system context
- Added `markdownToTxt()` for fallback topic title
- Refactored builtin agent lazy-materialize (slug → getBuiltinAgent → re-resolve)
- Refactored `resolveAttachmentsByFileIds` — extracted 70-line inline block to shared service
- Changed `postProcessUrl` signature: `(path) → (path, file)` with `getFileAccessUrl`

### Fork (key changes)
- Added `SkillsIdentifier` import for manual-skill gating
- Added `disabledBuiltinToolIds` / `userSkillActivateMode` from user settings (step 4)
- Computed `resolvedSkillMode` early for reuse across tool engine + discovery
- Manual-skill bridge: `hasExplicitSkills` detection → `excludeDefaultToolIds` routing (keep lobe-skills when user selected skills, exclude entirely in pure manual mode)
- Changed `isInAutoSkillMode` to use `resolvedSkillMode` instead of `agentConfig.chatConfig?.skillActivateMode`

### Resolution: **Preserve fork's manual-skill/tool-discovery logic, merge upstream's device + attachment changes**
- Fork's changes are in steps 4-5 (settings + tool discovery) — upstream's changes are in steps 1 (builtin agent), topic creation, device dispatch, and attachment resolution. Mostly non-overlapping regions.
- `postProcessUrl` signature change (upstream) may conflict at the function definition site — take upstream's version.
- `resolveAttachmentsByFileIds` extraction — upstream moves inline code to shared service — take upstream's refactor (fork didn't modify the attachment block).
- Market 500 guard is in `src/server/routers/tools/market.ts`, NOT in aiAgent — no overlap there.

---

## 7. package.json (MEDIUM)

### Upstream
- Version bump 2.2.1 → 2.2.2
- **Scripts unchanged** — conflict comes from fork-only build script customizations vs upstream dependency/version changes
- Deps: `@lobehub/editor` 4.12→4.15, `@lobehub/ui` 5.15.1→5.15.5, new `expo-server-sdk`, pinned `vitest 3.2.4`, new `@lobechat/builtin-tool-agent-signal`

### Fork
- `build:spa:all` = `build:spa:raw && build:spa:mobile && build:spa:copy` (includes mobile SPA)
- `build:next` heap: `--max-old-space-size=8192` (OOM fix)
- `build:vercel`: custom pipeline `build:spa:raw && build:spa:copy && build:next:raw && db:migrate` (no mobile in Vercel — CDN separately)
- `build:docker`: uses fork's `build:spa:all` (includes mobile)

### Resolution: **Keep fork's build scripts, merge upstream's deps/version/overrides**
- Take upstream version 2.2.2
- Keep fork's `build:spa:all`, `build:vercel`, `build:next` heap settings
- Merge upstream's new deps and version bumps
- After rebase: `pnpm install` to regenerate lockfile

---

## 8. Other Low-Risk Files (17)

- **AGENTS.md**: Take upstream, keep fork's Trellis section
- **Locale files**: Additive on both sides, auto-merge expected
- **bedrock runtime**: Fork's changes are test additions, upstream's are different — should merge cleanly
- **mobile router**: Upstream adds `/share/page`, fork adds `/image` + incognito — different routes, clean merge
- **settings hooks**: Need to check specifics but likely additive
- **topic types**: Upstream changes to `TopicQuerySortBy` — additive

---

## Untracked Collision Dirs

沿用 v2.2.1 sync 教训，按 `.git/sync-upstream-state.json` 的 `untracked_collision_dirs` 列表搬运：

```bash
# 读 state 文件中的碰撞目录列表（当前：.agents/, .cursor/, .codex/, .ccg/）
# 使用 NUL-delimited + core.quotePath=false 处理中文文件名
TS=$(date +%s)
for dir in .agents .cursor .codex .ccg; do
  [ -d "$dir" ] && mv "$dir" "/tmp/${dir##*/}-backup-$TS"
done

# Rebase ...

# 归位：对每个备份目录，逐文件检查是否与 upstream 新 track 的文件冲突
# 非重叠文件直接 cp 回来，重叠文件保留 upstream 版本
```

---

## Estimated Effort

- **Manual conflict resolution**: 7-10 files (topic layer + effort resolver + contextEngineering + aiAgent + package.json)
- **Time**: ~30-45 min for rebase + conflict resolution
- **Verification**: type-check + spot-check incognito + effort slider behavior + targeted tests:
  - `bunx vitest run --silent='passed-only' src/services/chat/mecha/modelParamsResolver.test.ts`
  - `bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/topics/topic.create.test.ts`
  - `bunx vitest run --silent='passed-only' src/server/routers/lambda/__tests__/topic.test.ts`
- **Risk**: LOW-MEDIUM overall. All fork features are preservable; no architectural incompatibility.
