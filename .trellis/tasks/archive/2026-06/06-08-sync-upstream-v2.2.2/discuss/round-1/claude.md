# Claude 核对报告 -- Round 1

## 核对方法

对 Codex 评审中的 5 个问题逐点读取源代码，验证：
1. 引用的文件路径和行号是否准确
2. "证据"部分描述的代码逻辑是否属实
3. "破坏场景"推理是否合理
4. "修复建议"是否可行且不会引入新问题

## 核对结果

### P1-1: DEBUG_MODEL_RUNTIME_RAW=safe 对 Responses API input 未摘要

**核对状态**: ✅ verified

**证据验证**:
- `packages/model-runtime/src/utils/rawCallLogger.ts:112-160` 的 `summarizePayload` 确实只特殊处理 `messages`、`contents`、`tools`、`systemInstruction`/`system` 四类字段
- 第 158 行：`result[key] = value;` 对未匹配的字段直接 pass through
- `packages/model-runtime/src/core/openaiCompatibleFactory/index.ts:1249` 构造 `postPayload.input`
- 第 1276 行：`logRawRequest({ ..., payload: postPayload, ... })` 传入包含 `input` 的完整 payload
- `packages/model-runtime/src/core/contextBuilders/openai.ts` 中 `convertOpenAIResponseInputs` 函数将消息转换为 `input` 数组，包含 `input_text` / `output_text` 类型的完整文本内容

**破坏场景验证**: ✅ 准确
- `input` 字段包含转换后的用户消息全文（`input_text` 类型）
- `safe` 模式下，`summarizePayload` 对 `input` 字段不做特殊处理，会原样输出到日志
- 这违背了 fork 的 `safe` 模式设计意图（只输出结构信息，不输出用户内容）

**修复建议验证**: ✅ 可行
- 在 `summarizePayload` 中增加 `input` 分支，按 item 的 `type` 和 `role` 摘要
- 保留 count / role / contentLength，移除文本原文
- 补充单测覆盖 Responses payload 的 safe/full 差异

**残余风险**: 无

---

### P1-2: step3_5ReasoningEffort resolver 默认 medium，但 UI/type 仅允许 low/high

**核对状态**: ✅ verified

**证据验证**:
- `src/services/chat/mecha/modelParamsResolver.ts:267`: `extendParams.reasoning_effort = chatConfig.step3_5ReasoningEffort || 'medium';`
- `src/features/ModelSwitchPanel/components/ControlsForm/Step3_5ReasoningEffortSlider.tsx:4`: `STEP3_5_REASONING_EFFORT_LEVELS = ['low', 'high']`
- 第 11 行：`defaultValue: 'low'`
- `packages/types/src/agent/chatConfig.ts:142`: `step3_5ReasoningEffort?: 'low' | 'high';`

**破坏场景验证**: ✅ 准确
- 未设置的新用户在 UI 看到默认值 `low`
- 但实际发送的请求使用 resolver 默认的 `'medium'`（不在类型定义中）
- 违背了 fork 的 see-what-you-send 原则
- `'medium'` 可能不被 StepFun API 接受（类型越界）

**修复建议验证**: ✅ 可行
- 将 resolver 默认值改为 `'low'`，与 UI 和类型定义对齐
- 不要扩展类型到 `medium`，除非确认 provider 支持且 UI 同步新增档位

**残余风险**: 无

---

### P1-3: skillActivateMode 默认值漂移，部分 UI/selector 默认 manual，执行链默认 auto

**核对状态**: ✅ verified

**证据验证**:
- `packages/types/src/user/settings/tool.ts:8`: 注释明确说明 user-level 默认是 `'auto'`
- `src/store/chat/slices/aiChat/actions/streamingExecutor.ts:285-288`: 执行链使用 `agent ?? user ?? 'auto'` ✓ 正确
- `src/store/agent/selectors/chatConfigByIdSelectors.ts:77`: `getChatConfigById(agentId)(s).skillActivateMode ?? 'manual'` ✗ 漂移到 `'manual'`
- `src/services/chat/mecha/contextEngineering.ts:456`: `agentChatConfigSelectors.skillActivateMode(...) !== 'manual'` 使用了漂移的 selector

**破坏场景验证**: ✅ 准确
- 默认用户（agent/user 都未设置）在**执行侧**仍是 `'auto'`（正确）
- 但在以下路径被误判为 `'manual'`：
  - contextEngineering 第 456 行：available agents 注入判断
  - TokenTag、RuntimeToolsSection 等 UI 组件
- 导致工具显示、计数、available agents 注入与实际行为不一致

**修复建议验证**: ✅ 可行
- 统一默认链为 `agent ?? user ?? 'auto'`
- Selector 应返回 resolved 默认值（加上 user/global fallback），或者拆成 raw/resolved 两个 selector
- 对于只需读取 per-agent raw value 的场景，直接使用 `getChatConfigById(...).skillActivateMode`（不走 selector）

**残余风险**: 需补充测试覆盖 selector/useControls/TokenTag 或 streamingExecutor 相关场景

---

### P2-1: temp topic server query/count 没排除 temp，sidebar hasMore 可能异常

**核对状态**: ✅ verified

**证据验证**:
- `packages/database/src/models/topic.ts:233-279`: 
  - groupId 路径的 where 条件未排除 `mode = 'temp'`
  - count 查询（第 274-278 行）基于同一 where，也包含 temp topics
- `src/store/chat/slices/topic/selectors.ts:34`: 前端正确过滤 `mode !== 'temp'`
- `src/store/chat/slices/topic/action.ts:515-540` + `selectors.ts:200-204`: 使用 server 返回的 `total` 计算 `hasMore`

**破坏场景验证**: ✅ 准确
- Server 返回的 items 包含 temp topics，前端过滤后实际显示数量减少
- Server 返回的 `total` 仍包含 temp topics
- `hasMore = total > pageSize` 的判断可能错误（temp topics 撑大了 total）

**修复建议验证**: ✅ 可行
- 在 TopicModel query 层默认排除 `mode = 'temp'`
- 为需要读取 temp 的内部路径（getTopicById、save/discard ephemeral）保留显式开关或不加过滤
- 或在 `getTopics` 入口传入 `excludeModes: ['temp']`

**残余风险**: 需确认是否有其他查询路径依赖 temp topics（如 getTopicById、ephemeral 操作）

---

### P2-2: SearchService 单 provider 失败测试期待旧 errorDetail 返回

**核对状态**: ✅ verified

**证据验证**:
- `src/server/services/search/index.test.ts:101-113`: 旧测试断言失败时返回 `{ errorDetail: 'Service unavailable', ... }`
- `src/server/services/search/index.ts:152-173`: 当前实现在所有 provider 失败后 `throw primaryError`（第 172 行）
- `src/server/services/search/index.test.ts:167-180`: 新测试已验证 "throw primary error when all providers fail" 语义

**破坏场景验证**: ✅ 准确
- 旧测试与当前实现语义冲突
- 一旦依赖安装完成并运行测试，旧测试会失败
- 旧测试掩盖了真正的 fallback 逻辑验证

**修复建议验证**: ✅ 可行
- 删除或改写第 101-113 行的旧测试
- 单 provider 失败应使用 `await expect(...).rejects.toThrow(...)`
- 保留新的 fallback 和 all-fail 测试（第 147-180 行）

**残余风险**: 无

---

## 总结

**所有 5 个问题均已验证准确**：
- 证据引用的文件路径、行号、代码逻辑完全正确
- 破坏场景推理合理，符合实际代码行为
- 修复建议可行，不会引入新问题

**建议修复优先级**：
1. **P1-2** — 最简单，单行修改，影响范围清晰
2. **P2-2** — 测试修正，不影响业务逻辑
3. **P1-1** — 日志安全问题，需补充单测
4. **P1-3** — 默认值漂移，影响范围较广，需补充测试
5. **P2-1** — 需产品决策（fork 是否期望 temp 完全不影响 sidebar 分页）

**无需修正的点**: 所有问题描述、证据、修复建议均无误。
