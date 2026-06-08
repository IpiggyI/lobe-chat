# Brief: Codex 评审问题逐点核对

## Topic
对 Codex 在 `sync-v2-2-2-fork-review` 中发现的 5 个问题（P1-1, P1-2, P1-3, P2-1, P2-2）进行逐点核对，验证证据、影响范围、修复建议的准确性，发现问题及时修正。

## Background
Codex 已完成对 `06-08-sync-upstream-v2.2.2` 同步后 fork 个性化保留情况的只读评审，发现了 5 个问题：
- **P1-1**: `DEBUG_MODEL_RUNTIME_RAW=safe` 对 Responses API `input` 未摘要，可能泄露完整对话
- **P1-2**: `step3_5ReasoningEffort` resolver 默认 `medium`，但 UI/type 仅允许 `low/high`
- **P1-3**: `skillActivateMode` 默认值漂移，部分 UI/selector 默认 `manual`，执行链默认 `auto`
- **P2-1**: temp topic 主路径保住，但 server query/count 没排除 temp
- **P2-2**: SearchService 单 provider 失败测试期待旧返回格式

当前 git HEAD 为 `77fbb4ef28`，已同步到 v2.2.2。

## Goals
1. 逐点读取相关代码，验证 Codex 指出的证据是否准确
2. 验证"破坏场景"描述是否符合实际代码逻辑
3. 验证"修复建议"是否可行且不会引入新问题
4. 发现证据有误、影响范围判断错误、修复建议不当的情况，明确指出并给出修正
5. 确认无误的问题，标记为 `verified`

## Constraints
- 本轮只核对问题描述的准确性，不进行实际代码修复
- 不运行重型构建或测试（依赖安装尚未完成）
- 只读取代码进行静态分析
- 如果某个问题涉及运行时行为且无法通过代码静态确认，标记为 `需运行验证`

## Success criteria
每个问题都完成核对，输出结论：
- `verified` — 证据准确，影响范围正确，修复建议可行
- `corrected` — 发现问题并给出修正（附修正内容）
- `needs-runtime-check` — 需要运行时验证才能确认
- `disputed` — 对问题本身的严重性或必要性有争议（需用户决策）
