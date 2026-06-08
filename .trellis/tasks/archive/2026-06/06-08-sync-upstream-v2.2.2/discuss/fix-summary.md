# Fix Summary -- Codex 评审问题修复

## Round 1: 初始修复（5 个问题）

### P1-2: step3_5ReasoningEffort 默认值 ✅
- **文件**: `src/services/chat/mecha/modelParamsResolver.ts:267`
- **修改**: 默认值从 `'medium'` 改为 `'low'`
- **状态**: 已修复

### P2-2: SearchService 测试 ✅
- **文件**: `src/server/services/search/index.test.ts:101-105`
- **修改**: 测试改为 `await expect(...).rejects.toThrow('Service unavailable')`
- **状态**: 已修复

### P1-1: raw logger Responses API input 摘要 ✅
- **文件**: `packages/model-runtime/src/utils/rawCallLogger.ts:143-175`
- **修改**: 增加 `input` 字段摘要分支，按 item type 摘要，保留结构信息，移除文本内容
- **状态**: 已修复
- **待补**: 单测覆盖 Responses payload safe/full 差异

### P1-3: skillActivateMode 默认值漂移 ✅
统一默认链为 `agent ?? user ?? 'auto'`，修改了 7 个文件：

1. `src/store/agent/selectors/chatConfigByIdSelectors.ts:74-77`
   - selector 返回 raw value (`undefined`)
   
2. `src/store/agent/selectors/chatConfigSelectors.ts:40-41`
   - selector 返回 raw value (`undefined`)
   
3. `src/services/chat/mecha/contextEngineering.ts:50-51, 455-461`
   - 导入 `getUserStoreState` 和 `userToolSettingsSelectors`
   - 实现 `agent ?? user ?? 'auto'` fallback 链
   
4. `src/features/ChatInput/ActionBar/Token/TokenTag.tsx:65`
   - 默认值从 `'manual'` 改为 `'auto'`
   
5. `src/helpers/toolEngineering/index.ts:31, 146-151, 174`
   - 导入 `userToolSettingsSelectors`
   - 实现 `agent ?? user ?? 'auto'` fallback 链
   
6. `src/routes/(main)/settings/system-tools/features/RuntimeToolsSection.tsx:134`
   - 默认值从 `'manual'` 改为 `'auto'`
   
7. `src/features/ChatInput/ActionBar/Plus/index.tsx:41-42, 270-275`
   - 导入 `useUserStore` 和 `userToolSettingsSelectors`
   - 实现 `agent ?? user ?? 'auto'` fallback 链

**状态**: 已修复

### P2-1: temp topic server query/count 排除 ✅ ⚠️ 已纠正
- **文件**: `packages/database/src/models/topic.ts:233-243, 307-315, 368-376`
- **初始修改**: 在 3 个 query 分支添加 `ne(topics.mode, 'temp')`
- **问题**: 误伤 `mode IS NULL` 的 legacy topics（SQL `NULL != 'temp'` 返回 unknown/false）
- **纠正**: 改为 `or(isNull(topics.mode), ne(topics.mode, 'temp'))`，保留 legacy 兼容性
- **状态**: 已纠正

## Round 2: Codex 复查发现的问题

### P1: temp topic 过滤误伤 legacy `mode IS NULL` ✅
- **问题**: 使用 `ne(topics.mode, 'temp')` 会过滤掉所有 `mode IS NULL` 的老数据
- **修复**: 
  - 提取共享条件 `excludeEphemeralCondition = or(isNull(topics.mode), ne(topics.mode, 'temp'))`
  - 在 groupId / agentId / containerId 三个分支替换直接的 `ne(topics.mode, 'temp')`
- **状态**: 已纠正

## Verification Status

### 待验证项
依赖安装完成后运行：

```bash
bun run type-check
bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/topics/topic.query.test.ts
bunx vitest run --silent='passed-only' src/server/services/search/index.test.ts
bunx vitest run --silent='passed-only' src/services/chat/mecha/modelParamsResolver.test.ts
bunx vitest run --silent='passed-only' packages/database/src/models/__tests__/topics/topic.create.test.ts
bunx vitest run --silent='passed-only' src/server/routers/lambda/__tests__/topic.test.ts
```

### 待补充项
- **P1-1**: 补充单测覆盖 `rawCallLogger` Responses payload 的 safe/full 差异
- **P2-1**: 补充回归测试验证 `mode IS NULL` 与 `mode = 'temp'` 的差异（优先覆盖 inbox/agent query）

## 修复文件清单

### 修改的文件（11 个）
1. `src/services/chat/mecha/modelParamsResolver.ts`
2. `src/server/services/search/index.test.ts`
3. `packages/model-runtime/src/utils/rawCallLogger.ts`
4. `src/store/agent/selectors/chatConfigByIdSelectors.ts`
5. `src/store/agent/selectors/chatConfigSelectors.ts`
6. `src/services/chat/mecha/contextEngineering.ts`
7. `src/features/ChatInput/ActionBar/Token/TokenTag.tsx`
8. `src/helpers/toolEngineering/index.ts`
9. `src/routes/(main)/settings/system-tools/features/RuntimeToolsSection.tsx`
10. `src/features/ChatInput/ActionBar/Plus/index.tsx`
11. `packages/database/src/models/topic.ts`

### 修改类型分布
- 默认值对齐: 5 处
- Fallback 链实现: 4 处
- 测试修正: 1 处
- 日志安全: 1 处
- SQL 条件修正: 1 处
