# Upstream Sync Digest: v2.2.1 → v2.2.2

**Date:** 2026-06-08
**Target:** `v2.2.2` (`248a4dcab5`, peeled SHA of `v2.2.2^{}`) — last sync: v2.2.1 on 2026-05-30
**Range:** 92 commits, 1012 files changed (+49,156 / -15,746)
**Fork-only commits:** 52

## Breaking Changes: 0

Patch release, no BREAKING markers.

## High-Risk: Ephemeral Topic Lifecycle Removed

Upstream **completely removed** the incognito/temp topic mechanism:

- `createEphemeralTopic()` / `saveEphemeralTopic()` / `discardEphemeralTopic()` removed from `topic/action.ts`
- `isVisibleTopic` / `ephemeralTopics` selectors removed from `topic/selectors.ts`
- Topic create/batch schema `mode` field (`default/temp/test`) deleted
- `conversationLifecycle.ts` incognito guard block removed
- `cleanupTempTopics` removed from topic router

**Directly impacts fork's incognito chat feature.** Needs adaptation or rebuild.

## Features (27)

| Feature | Commit |
|---|---|
| Topic group-by-status mode | `c8096590` |
| Workspace + Agent Share tables | `5761d206` |
| PushChannel + receipt cron + tRPC API | `4d840e90` |
| Task file/image attachments | `480f6a8e` |
| Device auto-register + directory management | `3caa3efb`, `e4d5017e` |
| Agent Signal: execAgent migration + self-iteration | `d9673c3c`, `650a1787` |
| Document share flow | `22c264bb` |
| Claude Opus 4.8 support | `f042dd35` |
| Step 3.7 Flash + Step 3.5 reasoning effort | `27121a6f` |
| MiniMax M3 Anthropic video runtime | `21a73b22` |
| BM25 search for file-backed documents | `65113ca2` |
| Configurable model routing and starters | `dda52792` |
| Portal editable CodeMirror viewer | `9945cecf` |
| Daily token-usage heatmap mode | `2eb9e34f` |
| Agent builder skill priority + server runtime | `359b3489` |
| Execution device switcher for all agents | `857aaf47` |
| Agent export as Markdown | `2657b667` |
| Devices settings page | `21aceb6f` |
| Device connectionId + channel routing | `063fa61c` |
| Storage pay-as-you-go stubs | `8dee729f` |
| Limited offer & original price locale keys | `f9eb48fe` |

## Fixes (33)

Routine bug fixes, not expanded.

## Migrations (1)

- `0105_add_usage_agent_share_workspace.sql` — New tables: agent_shares, workspace_audit_logs, workspace_invitations, workspace_members, workspaces. Also **ALTER TABLE**: `messages ADD COLUMN usage jsonb`, `topics ADD COLUMN sender_id text`, plus FK constraints and indexes on new tables. All additive (IF NOT EXISTS / IF NOT EXISTS guards).

## Dependencies

- `@lobehub/editor`: 4.12.0 → 4.15.0
- `@lobehub/ui`: 5.15.1 → 5.15.5
- `expo-server-sdk`: NEW (push notifications)
- `vitest`: pinned 3.2.4
- `@lobechat/builtin-tool-agent-signal`: new workspace dep

## Conflict Surface (28 files)

### 🔴 High Risk (fork feature conflicts)

| File | Fork change | Upstream change | Risk |
|---|---|---|---|
| `src/store/chat/slices/topic/action.ts` | agentId routing for createTopic | Removed ephemeral methods, added sortBy param | HIGH |
| `src/store/chat/slices/topic/selectors.ts` | Topic selector changes | Removed ephemeral selectors, added groupByStatus | HIGH |
| `src/services/topic/index.ts` | Topic service agentId | Removed mode handling, added sortBy + getMaxTaskDuration | HIGH |
| `src/server/routers/lambda/topic.ts` | agentId field routing | Removed mode schema, added sortBy + getTopicDetail + getMaxTaskDuration | HIGH |
| `src/store/chat/slices/aiChat/actions/conversationLifecycle.ts` | Conversation lifecycle | Removed incognito guard, added markdownToTxt | HIGH |

### 🟡 Medium Risk

| File | Upstream change | Risk |
|---|---|---|
| `src/services/chat/mecha/modelParamsResolver.ts` | Added step3_5ReasoningEffort, removed fallback defaults | Fork's effort slider defaults need alignment |
| `src/services/chat/mecha/contextEngineering.ts` | Added session_date/sandbox_enabled vars, removed SkillsIdentifier gating | Fork gating becomes dead code |
| `src/features/ModelSwitchPanel/components/ControlsForm/ControlsForm.tsx` | Added Step3_5ReasoningEffortSlider, removed adaptive thinking init | Fork effort slider UI needs merge |
| `src/server/services/aiAgent/index.ts` | Device cwd/systemContext, attachment resolver refactor, markdownToTxt title, builtin agent lazy-materialize | Fork has SkillsIdentifier gating, disabledBuiltinToolIds, resolvedSkillMode, manual-skill bridge — **MEDIUM-HIGH** |
| `package.json` | Version 2.2.2, deps update, `build:spa` script refactor | Fork has Vercel/mobile SPA/OOM build script customizations — **MEDIUM** |

### 🟢 Low Risk (17 files)

AGENTS.md, locale files (chat/setting en-US/zh-CN), bedrock runtime, mobile router, settings hooks, etc. Mostly additive changes, straightforward merge.

## Untracked Collision Dirs

`.agents/`, `.cursor/`, `.codex/`, `.ccg/` — per `.git/sync-upstream-state.json` collision list。Rebase 前按 state 文件 `untracked_collision_dirs` 列表 + `git ls-files -z --others` (NUL-delimited, `core.quotePath=false` 处理中文名) 搬运到 `/tmp/`，rebase 后归位非重叠文件。Upstream `.agents/` 有 42 个文件变更（11 新增）。

## Resolution Strategy (TBD)

See separate resolution plan document.
