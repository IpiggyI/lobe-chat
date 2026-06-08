# Post-fix Codex Recheck -- 2026-06-08

## 背景

Claude Code 已按上一轮 Codex 评审修复 5 个问题。本文件记录 Codex 对修复结果的追加复查发现，供下一轮 Claude Code 修复使用。

本记录不重开已关闭的 `state.md`，只作为 post-fix 复查附件。

## Findings

### P1: temp topic 过滤误伤 legacy `mode IS NULL`

**状态**: blocking regression

Claude Code 在 `TopicModel.query` 的三个 server query 分支加入了 `ne(topics.mode, 'temp')`：

- `packages/database/src/models/topic.ts:238` groupId 分支
- `packages/database/src/models/topic.ts:305` agentId / inbox 分支
- `packages/database/src/models/topic.ts:363` containerId 兼容分支

问题是 SQL 的 `NULL != 'temp'` 在 `WHERE` 中不是 true，而是 unknown / false。因此历史 legacy topics（`mode IS NULL`）会被一并过滤掉。这个改法会破坏 fork 对老数据的兼容，尤其是 inbox legacy topic 收养逻辑。

同文件已有正确兼容写法：

- `packages/database/src/models/topic.ts:441` 使用 `or(isNull(topics.mode), ne(topics.mode, 'temp'))`
- `packages/database/src/models/topic.ts:581` `queryRecent` 也使用相同模式

受影响的现有测试场景包括：

- `packages/database/src/models/__tests__/topics/topic.query.test.ts:1118` 期望 inbox 同时返回 2 条 legacy orphan topic 和 1 条新 agentId topic
- `packages/database/src/models/__tests__/topics/topic.query.test.ts:1181` 期望只收养真正 legacy inbox topic
- `packages/database/src/models/__tests__/topics/topic.query.test.ts:1228` 期望返回新 agentId topic + orphan legacy topic
- `packages/database/src/models/__tests__/topics/topic.query.test.ts:1263`、`:1295`、`:1334` 等 legacy inbox 隔离与分页场景也会受影响

**建议修复**:

在 `TopicModel.query` 中抽一个共享条件，例如：

```ts
const excludeEphemeralCondition = or(isNull(topics.mode), ne(topics.mode, 'temp'));
```

然后在 group / agent / container 三个分支替换直接的 `ne(topics.mode, 'temp')`。修复后建议补 regression case：默认/历史 `mode IS NULL` topic 仍可见，`mode = 'temp'` topic 被过滤；至少覆盖 agent/inbox 分支，最好同步覆盖 group/container 分支。

## Verification blocked

本轮复查尝试运行相关测试，但当前 workspace 依赖未安装完整，Vitest 无法加载，测试没有实际执行。

失败命令：

```bash
bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/topics/topic.query.test.ts
bunx vitest run --silent='passed-only' src/server/services/search/index.test.ts
bunx vitest run --silent='passed-only' src/services/chat/mecha/modelParamsResolver.test.ts
```

共同失败原因：

```text
Error: Cannot find module '/home/hyy/develop/personal/GitHub/lobe-chat/node_modules/vitest/vitest.mjs'
```

`bun run type-check` 也被同一依赖问题阻塞：

```text
error TS2688: Cannot find type definition file for 'vitest/globals'.
The file is in the program because:
  Entry point of type library 'vitest/globals' specified in compilerOptions
```

`git diff --check` 已通过，无 whitespace error 输出。

Claude Code 下一轮修复后需要先恢复依赖：

```bash
pnpm install
```

然后至少运行：

```bash
bun run type-check
bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/topics/topic.query.test.ts
bunx vitest run --silent='passed-only' src/server/services/search/index.test.ts
bunx vitest run --silent='passed-only' src/services/chat/mecha/modelParamsResolver.test.ts
bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/topics/topic.create.test.ts
bunx vitest run --silent='passed-only' src/server/routers/lambda/__tests__/topic.test.ts
```

## Looks fixed

以下项静态复查看起来方向正确，但受依赖缺失影响，尚未通过测试确认：

- `src/services/chat/mecha/modelParamsResolver.ts:267` 已将 `step3_5ReasoningEffort` 默认值改为 `'low'`
- `src/server/services/search/index.test.ts:101-105` 已改为 `rejects.toThrow`
- `skillActivateMode` fallback 基本对齐为 `agent ?? user ?? 'auto'`
  - `chatConfigByIdSelectors.getSkillActivateModeById` 返回 raw `undefined`
  - `TokenTag`、`RuntimeToolsSection`、`PlusAction` 都显式 resolve user fallback
  - `contextEngineering`、`toolEngineering` 执行链也 resolve 为 `agent ?? user ?? 'auto'`
  - `useControls` 仍使用 raw selector 做 `=== 'manual'` 判断，`undefined` 等价 auto，静态上可接受
- `rawCallLogger` 已增加 OpenAI Responses API top-level `input` array 摘要分支

`rawCallLogger` 仍建议补单测，确认 safe 模式不会输出 Responses `input` 内的原始文本，full 模式仍保留原始 payload。

## Claude Code next steps

1. 修复 `TopicModel.query` 的 temp topic 排除条件，必须保留 `mode IS NULL` legacy topics。
2. 为 `mode IS NULL` 与 `mode = 'temp'` 的差异补回归测试，优先覆盖 inbox/agent query。
3. 恢复依赖后运行上方 verification 命令。
4. 若测试仍无法运行，在修复回执中明确记录阻塞原因，不要把未执行测试标记为通过。
