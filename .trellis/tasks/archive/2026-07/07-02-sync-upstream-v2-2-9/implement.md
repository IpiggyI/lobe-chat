# Implement: Sync upstream to v2.2.9 (staged 6-seg rebase)

Created: 2026-07-02. Base: fork main @ 418e167023 (v2.2.3 synced 2026-06-14). Target: v2.2.9 (588c0692df).

## Background

- Upstream delta: 501 commits / 3377 files (+243k/−54k), releases v2.2.4–v2.2.9.
- merge-tree dry-run: 30 real conflict files, 5 clusters:
  AgentToolsEngine (runtime tools toggle), Klavis→Composio replacement, search1api,
  model-runtime (openai SDK v4→v6), build scripts (package.json / vite.config.ts).
- Key upstream breaking-ish: openai v6 (#16090), react-router v8 (#16029), better-auth 1.6.15,
  Composio replaces Klavis (#15461), build:spa restructure + auth SPA entry, build:next heap 8192→7168,
  build:vercel now includes db:migrate but NOT mobile SPA build. 4 new DB migrations 0111–0114.
- Fork-only commits to replay: 60.
- No untracked collision this round (verified across all anchors; .codex/skills & .cursor/skills absent locally).

## Segment plan (heuristic; real conflicts = rebase pause points)

| seg | range                                     | commits        | expected conflicts                                                                                           |
| --- | ----------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | v2.2.3 → v2.2.4 (8992df3187)              | 102            | 7 new: AgentToolsEngine×2, package.json, vite.config.ts, AddSkillButton, modelParamsResolver, builtin/action |
| 2   | v2.2.4 → v2.2.5 (1fa6f47fc9)              | 51             | 10 new: Klavis/Composio cluster                                                                              |
| 3   | v2.2.5 → v2.2.6 (8ec55f5941)              | 44             | 0 new, 5 persistent retouched                                                                                |
| 4   | v2.2.6 → v2.2.8 (4acfc5285a)              | 97             | 3 new: lambda/topic.ts, ConversationArea, mobile SessionHeader                                               |
| 5   | v2.2.8 → nightly e751b884f5               | \~40 mainline  | 6 new: model-runtime openai-v6 cluster, TokenTag, AgentTool, conversationLifecycle                           |
| 6   | e751b884f5 → v2.2.9 (588c0692df) \[final] | \~101 mainline | 4 new: search1api×2, AgentToolsEngine test, aiAgent                                                          |

## Conflict policy

- Klavis cluster → take upstream (Composio); re-evaluate fork klavis-market-500-fix afterwards.
- package.json → keep fork heap 8192 (7168 breaks fork build per memory); merge upstream script restructure.
- Fork-private paths (.trellis/, docs/, openspec/…) → ours (all untracked anyway this round).
- pnpm-lock gitignored → no lockfile conflicts.

## Per-segment loop

rebase → resolve → status clean + no .git/rebase-\* → checkpoint/sync-20260702-seg-N →
validation tier (dep-touching seg: pnpm install; final seg: pnpm install + type-check) →
update .git/sync-upstream-state.json (resume_from_segment).

## Post-sync (Phase 7, separate confirmations)

- push --force-with-lease origin/main (ask first); canary tag v2.2.9-canary.1 (ask exact tag).
- trigger build-mobile-spa.yml (--repo IpiggyI/lobe-chat), cherry-pick bot fork-CDN mobile template.
- pnpm install before any commit (post-sync hygiene); package.json wasm overrides stay uncommitted (stashed, pop at end).
- verify build:vercel mobile SPA coverage change; db:migrate 0111–0114 runs on deploy.
- Backup branch: backup/main-<ts> (created at seg1 start).
