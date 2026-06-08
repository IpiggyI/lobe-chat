# Design Document

<!-- agent-discuss:outcome -->
## Discussion Outcome: Codex 评审问题逐点核对

### Summary

对 Codex 在 `sync-v2-2-2-fork-review` 中发现的 5 个问题（P1-1, P1-2, P1-3, P2-1, P2-2）进行了逐点静态代码核对。所有问题的证据、破坏场景、修复建议均验证准确，无需修正 Codex 评审内容。

### Agreed

所有 5 个问题均标记为 `verified`：

#### P1-1: DEBUG_MODEL_RUNTIME_RAW=safe 对 Responses API input 未摘要
- 证据准确：`summarizePayload` 只处理 messages/contents/tools/system，对 `input` 直接 pass through
- 破坏场景合理：safe 模式会输出 Responses API 的 `input` 数组完整文本
- 修复建议可行：增加 `input` 分支摘要，补充单测

#### P1-2: step3_5ReasoningEffort resolver 默认 medium，但 UI/type 仅允许 low/high
- 证据准确：resolver 默认 `'medium'`，UI 只允许 `['low', 'high']`，type 定义 `'low' | 'high'`
- 破坏场景合理：违背 see-what-you-send 原则，类型越界可能被 API 拒绝
- 修复建议可行：改为 `|| 'low'`

#### P1-3: skillActivateMode 默认值漂移
- 证据准确：执行链正确使用 `agent ?? user ?? 'auto'`，但 selector 漂移到 `?? 'manual'`
- 破坏场景合理：contextEngineering、UI 组件误判默认用户为 manual 模式
- 修复建议可行：统一默认链，或拆分 raw/resolved selector

#### P2-1: temp topic server query/count 没排除 temp
- 证据准确：TopicModel query where 条件未排除 `mode = 'temp'`，count 也基于同一 where
- 破坏场景合理：server total 包含 temp，前端过滤后实际数量减少，hasMore 可能错误
- 修复建议可行：query 层排除 temp，或为特定路径保留开关

#### P2-2: SearchService 单 provider 失败测试期待旧返回格式
- 证据准确：旧测试期待 `{ errorDetail: ... }`，当前实现 `throw primaryError`
- 破坏场景合理：旧测试会失败，掩盖真正的 fallback 验证
- 修复建议可行：删除或改写旧测试，使用 `rejects.toThrow`

### Rejected

无

### Deferred

无

### Decision-needed

**P2-1 产品决策**：fork 是否期望 temp topics 完全不影响 sidebar 分页？如果是，应一并修复；如果允许轻微影响，可延后。

### Remaining Risks

- **P1-1**：修复后需补充单测覆盖 Responses payload safe/full 差异
- **P1-3**：修复后需补充 selector/useControls/TokenTag 或 streamingExecutor 测试
- **P2-1**：需确认其他查询路径（getTopicById、ephemeral 操作）不受影响

### Next Steps

按优先级修复：
1. **P1-2** — 最简单，单行修改，影响范围清晰
2. **P2-2** — 测试修正，不影响业务逻辑
3. **P1-1** — 日志安全问题，需补充单测
4. **P1-3** — 默认值漂移，影响范围较广，需补充测试
5. **P2-1** — 根据产品决策决定是否修复
<!-- /agent-discuss:outcome -->
