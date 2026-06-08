# v2.2.2 Sync — Execution Plan

**Target:** `248a4dcab5` (v2.2.2^{commit})
**Fork-only commits:** 52 (will be replayed)
**Estimated manual conflicts:** 7-10 files across ~8 fork commits
**Prerequisite:** digest + resolution plan reviewed and approved

---

## Step 0: Pre-rebase prep

### 0.1 Dirty tree check + stash

```bash
git status --porcelain
# If dirty (currently .gitignore modified):
git stash push -u -m "sync-upstream-v2.2.2 auto-stash"
```

### 0.2 Backup branch

```bash
BACKUP="backup/main-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP"
echo "Rollback: git reset --hard $BACKUP"
```
→ verify: `git branch | grep backup`

### 0.3 Move untracked collision dirs

Per `.git/sync-upstream-state.json` `untracked_collision_dirs` + lesson from v2.2.1 sync.

```bash
TS=$(date +%s)
COLLISION_DIRS=(.agents .cursor .codex .ccg)
BACKUP_ROOT="/tmp/sync-collision-backup-$TS"
mkdir -p "$BACKUP_ROOT"

for dir in "${COLLISION_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    # Use NUL-delimited + quotePath=false for Chinese filenames
    FILE_COUNT=$(git -c core.quotePath=false ls-files --others -z -- "$dir" | tr '\0' '\n' | wc -l)
    echo "Moving $dir ($FILE_COUNT untracked files) → $BACKUP_ROOT/$dir"
    mv "$dir" "$BACKUP_ROOT/$dir"
  fi
done
echo "Collision dirs backed up to: $BACKUP_ROOT"
```
→ verify: `ls .agents .cursor .codex .ccg 2>&1` should all say "No such file"

### 0.4 Enable rerere

```bash
git config rerere.enabled true
```

---

## Step 1: Rebase

```bash
git rebase 248a4dcab5a62da6bb4784a7a6ae194fcc1b994f
```

**严格串行**：等 rebase 启动并暂停在第一个冲突（或全部通过），再继续。不要在 rebase 未启动时做任何冲突处理。

→ verify: `ls .git/rebase-merge/ 2>/dev/null && echo "REBASE IN PROGRESS" || echo "NO REBASE"`

**冲突侧提醒**：`<<<<<<< HEAD` = 上游 (v2.2.2)，`>>>>>>> sha` = fork commit。原则：**采纳上游结构 + 重应用 fork 意图**。

---

## Step 2: Conflict resolution — per-commit playbook

Based on fork commit → high-risk file mapping:

### Commit group A: `7ce1a62a85` — ✨ feat: add incognito chat with 24h auto-cleanup

**Touches:** topic/action.ts, topic/selectors.ts, topic.ts (router), conversationLifecycle.ts
**This is the most conflict-dense commit.**

| File | Strategy |
|---|---|
| `src/store/chat/slices/topic/action.ts` | Take upstream's sortBy/TopicQuerySortBy additions. **Keep** fork's `createEphemeralTopic`, `saveEphemeralTopic`, `discardEphemeralTopic` methods. They sit at the end of the class, minimal overlap with upstream's changes in `useTopicListSWR`. |
| `src/store/chat/slices/topic/selectors.ts` | Take upstream's `groupTopicsByStatus` import + `getGroupFn` refactor (loadingTopicIds param) + `groupedTopicsForSidebar` changes. **Keep** fork's `isVisibleTopic` + `ephemeralTopics` selector + `visibleTopics` filter. Fork's filter runs BEFORE upstream's grouping — no interaction. |
| `src/server/routers/lambda/topic.ts` | Take ALL upstream additions (getTopicDetail, getMaxTaskDuration, sortBy, agentOperationModel). **Re-add** to schemas: `mode: z.enum(['default', 'temp', 'test']).optional()` in **createTopic**, **batchCreateTopics**, AND **updateTopic** value object. **Keep** fork's `cleanupTempTopics` import + call in getTopics. |
| `src/store/chat/slices/aiChat/actions/conversationLifecycle.ts` | Take upstream's `markdownToTxt` import + usage in title slicing. **Keep** fork's temp-mode early-return guard in `applyTopicTitle` (guard exits before markdownToTxt line — no overlap). |

### Commit group B: `98ac033a0b` + `a199d6a30f` — effort slider fixes

**Touches:** modelParamsResolver.ts, ControlsForm.tsx

| File | Strategy |
|---|---|
| `src/services/chat/mecha/modelParamsResolver.ts` | Take upstream's new `step3_5ReasoningEffort` block. **Keep** fork's `\|\| default` patterns on all reasoning effort variants. **Keep** fork's `adaptiveOnly` logic for Opus 4.6/4.7. Apply fork's default pattern to the new step3_5 block: `chatConfig.step3_5ReasoningEffort \|\| 'medium'`. |
| `src/features/ModelSwitchPanel/components/ControlsForm/ControlsForm.tsx` | Take upstream's `Step3_5ReasoningEffortSlider` import + form item entry. **Keep** fork's `getValueProps` overrides (different form items — no overlap). **Keep** fork's `adaptiveOnly` initialValues logic. |

### Commit group C: `e1d59f6fcb` — manual skill activation mode

**Touches:** contextEngineering.ts

| File | Strategy |
|---|---|
| `src/services/chat/mecha/contextEngineering.ts` | Take upstream's `session_date` + `sandbox_enabled` template var additions (in CREDS area). **Keep** fork's `SkillsIdentifier` import + `tools?.includes(SkillsIdentifier)` gate on `skillsConfig.enabledSkills`. Upstream removed this gate (always resolves skills) — fork keeps it for token savings. |

### Commit group D: `f63a51ed2e` + `0b7821e195` + `fa93b9c233` — runtime tools + manual skill bridge

**Touches:** aiAgent/index.ts

| File | Strategy |
|---|---|
| `src/server/services/aiAgent/index.ts` | Take upstream's: `DeviceModel` import, device cwd resolution (boundDevice/deviceCwd), `buildRemoteDeviceHeteroContext`, `markdownToTxt` for title, builtin agent lazy-materialize, `resolveAttachmentsByFileIds` extraction, `postProcessUrl` signature change `(path, file)`. **Keep** fork's: `SkillsIdentifier` import, `disabledBuiltinToolIds`/`userSkillActivateMode` from settings, `resolvedSkillMode` computation, manual-skill bridge (`hasExplicitSkills` → `excludeDefaultToolIds` routing), `isInAutoSkillMode` using `resolvedSkillMode`. |

### Commit group E: `7583cce68c` + OOM fix commits — package.json

**Touches:** package.json (7 fork commits)

| File | Strategy |
|---|---|
| `package.json` | Take upstream's version `2.2.2`, deps updates (@lobehub/editor 4.15.0, @lobehub/ui 5.15.5, expo-server-sdk, pinned vitest, @lobechat/builtin-tool-agent-signal), overrides. **Keep** fork's build scripts: `build:spa:all` (includes mobile), `build:vercel` (custom pipeline), `build:next` heap `--max-old-space-size=8192`, `build:docker` with mobile. |

### Other files (LOW — likely auto-merge)

| File | Strategy |
|---|---|
| `AGENTS.md` | Take upstream, keep fork's Trellis block |
| `locales/en-US/chat.json`, `locales/zh-CN/chat.json` | Fork adds incognito keys — additive, auto-merge |
| `locales/en-US/setting.json`, `locales/zh-CN/setting.json` | Fork adds system tools keys — additive, auto-merge |
| `src/locales/default/chat.ts`, `src/locales/default/setting.ts` | Same as above |
| `src/spa/router/mobileRouter.config.tsx` | Upstream adds `/share/page`, fork adds `/image` + incognito — different routes |
| `packages/database/src/models/__tests__/topics/topic.create.test.ts` | Fork adds mode=temp test — additive |
| `packages/database/src/models/topic.ts` | Fork adds ephemeral exclusion in recentTopics query — upstream doesn't have it, fork-only addition |
| `packages/model-runtime/src/providers/bedrock/` | Different test additions — auto-merge |
| `packages/types/src/topic/topic.ts` | Upstream adds TopicQuerySortBy — additive |
| Others | Auto-merge expected |

---

## Step 3: Per-conflict iteration

For each conflict:

```bash
# 1. Check what's conflicting
git status --porcelain | grep '^UU\|^AA\|^DU\|^UD'

# 2. Resolve (manual edit or strategy)
# ...edit the file...

# 3. Stage
git add <resolved-file>

# 4. Continue
git rebase --continue
```

Repeat until rebase completes or abort if needed (`git rebase --abort` → `git reset --hard $BACKUP`).

---

## Step 4: Post-rebase validation

### 4.1 Restore collision dirs

```bash
# For each backed-up dir, restore non-overlapping files
for dir in "${COLLISION_DIRS[@]}"; do
  BACKUP_DIR="$BACKUP_ROOT/$dir"
  [ -d "$BACKUP_DIR" ] || continue

  # List files upstream now tracks
  UPSTREAM_FILES=$(git ls-tree -r --name-only HEAD -- "$dir" 2>/dev/null)

  # Restore local-only files
  if [ -d "$dir" ]; then
    # Dir exists from upstream — merge carefully
    cd "$BACKUP_DIR"
    find . -type f | while read f; do
      REL="${f#./}"
      if ! echo "$UPSTREAM_FILES" | grep -qF "$dir/$REL"; then
        mkdir -p "$(dirname "/home/hyy/develop/personal/GitHub/lobe-chat/$dir/$REL")"
        cp "$BACKUP_DIR/$REL" "/home/hyy/develop/personal/GitHub/lobe-chat/$dir/$REL"
      fi
    done
    cd /home/hyy/develop/personal/GitHub/lobe-chat
  else
    # Dir doesn't exist from upstream — restore entirely
    mv "$BACKUP_DIR" "$dir"
  fi
done
```
→ verify: `.trellis/`, `.agents/skills/sync-upstream/`, `.cursor/hooks.json` etc. exist

### 4.2 Dependency install

```bash
pnpm install
```
→ verify: exits 0, no postinstall errors

### 4.3 Type check

```bash
bun run type-check
```
→ verify: 0 errors. This is the safety net for any dangling refs from fork symbols that upstream removed.

### 4.4 Targeted tests

```bash
bunx vitest run --silent='passed-only' src/services/chat/mecha/modelParamsResolver.test.ts
bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/topics/topic.create.test.ts
bunx vitest run --silent='passed-only' src/server/routers/lambda/__tests__/topic.test.ts
```
→ verify: all pass

### 4.5 Env / config drift check

```bash
git diff "$BACKUP" -- .env.example package.json next.config.ts vercel.json | head -40
```
→ surface any changes for manual follow-up

---

## Step 5: Persist state + push

### 5.1 Update `.git/sync-upstream-state.json`

```json
{
  "last_synced_at": "<ISO timestamp>",
  "last_synced_to": "v2.2.2",
  "last_synced_to_sha": "248a4dcab5a62da6bb4784a7a6ae194fcc1b994f",
  "last_synced_sha": "<new HEAD sha>",
  "sync_source_remote": "upstream",
  "sync_source_ref": "main",
  "fork_private_paths": [".trellis/", "docs/plans/", "docs/context/", "docs/summary/", "docs/test_log/", "docs/upstream-sync/", "openspec/", ".ace-tool/", ".vercel"],
  "untracked_collision_dirs": [".agents/", ".cursor/", ".codex/", ".ccg/"],
  "lockfile_strategy": {"pnpm-lock.yaml": "theirs+regen"},
  "previous_sync": "v2.2.1"
}
```

### 5.2 Push policy

Ask user: force-push to origin/main (--force-with-lease) or defer.

**Pre-push checklist:**
```bash
git fetch origin
git log --oneline origin/main..HEAD | head -5  # Check for CI auto-commits
```
If origin has CI auto-commits (mobile SPA bundle), they'll be replaced — expected behavior.

### 5.3 Restore stash

```bash
git stash pop  # if stashed in Step 0.1
```

---

## Abort / Rollback

At any point:
```bash
git rebase --abort        # cancel in-progress rebase
git reset --hard $BACKUP  # restore to pre-sync state
```

---

## Post-sync follow-up (verify on Vercel deploy)

- [ ] DB migration 0105 runs on deploy (`bun run db:migrate`)
- [ ] Type-check green on Vercel build
- [ ] Incognito chat: create → save → discard all work
- [ ] Effort sliders: see-what-you-send defaults correct for new step3_5 models
- [ ] Mobile render on Vercel (known open bug — check if still present)
- [ ] Workbox: app-stores chunk < 10 MiB precache limit
