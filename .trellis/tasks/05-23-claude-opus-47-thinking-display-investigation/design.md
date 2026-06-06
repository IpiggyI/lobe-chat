# Design — Opus 4.6/4.7 与 GPT-5.5 思考块不显示修复方案

> 状态：**方案设计（论证用，本任务不实施 —— 见 prd Non-goals）**。代码片段均为契约示意。
> 依赖证据：`research/v2.2.1-revalidation.md`（v2.2.1 代码定位 + Anthropic/OpenAI 官方契约）。
> 基线：当前工作树 `v2.2.1-48-gbd9c5bdcce-dirty`（`package.json` 为 2.2.1，HEAD `bd9c5bdcce`）。注意：`effort || 'high'` 来自 tag 后提交 `0b7821e195`，精确 `v2.2.1` tag 尚无该修复。
>
> ⚠️ **实施后偏差更正（2026-06-04）**：提交 `a199d6a30f` 已落地此设计中的主要 Anthropic 修复，并同时补 regular GPT-5.5 默认 `medium`。复盘见 `research/post-implementation-course-correction.md`。结论：早期围绕 `reasoning_effort` / slider default 的调研方向过窄，实际主修复面是 Opus 4.6/4.7 的 adaptive thinking 默认与 visible thinking display。

---

## 1. 设计目标与边界

**目标**：让 Claude Opus 4.6/4.7 与 GPT-5.5/5.5-pro 在**默认或合理配置下**正常显示思考块（含思考文本与用时）。

**In-scope**：`enableAdaptiveThinking` / `opus47Effort` / `effort` / regular `gpt5_2ReasoningEffort` 链路；Anthropic `thinking`+`output_config`、OpenAI `reasoning` 请求构建。`gpt5_2ProReasoningEffort` 仅作为防回归检查项，不能按旧方案补默认 `medium`。

**Out-of-scope**（沿用 prd）：其他厂商、Gemini thinkingLevel、Sonnet/Haiku 系；不开 PR、不在本任务落地。

**硬约束**：
- 不破坏 Opus 4.6 与 Sonnet 4.6 现有行为。
- Anthropic：`thinking.display` 与 `thinking.type:'disabled'` **互斥**（disabled 时设 display 报错）。
- Anthropic：Opus 4.6/4.7 为 **adaptive-only**（lobe 未暴露其 manual 模式），`{type:'enabled',budget_tokens}` 在 4.7 被 400 拒绝。

---

## 2. 根因与数据流（精确化）

### 2.1 关键数据流（Opus 链路）

```
chatConfig (store)
  └─ modelParamsResolver.resolveModelExtendParams  →  ModelExtendParams{ thinking, effort }
       └─ anthropicCompatibleFactory.buildAnthropicPayload (:196-243)
            └─ HTTP body: { thinking?, output_config?, ... }
```

**精确化（修正 research 中"默认发 disabled"的措辞）**：
`anthropicCompatibleFactory/index.ts:196` 仅在 `thinking.type === 'enabled' || 'adaptive'` 时构建 thinking 字段；resolver 产出的 `{type:'disabled'}` **不满足条件 → 被静默丢弃 → 走 basePayload(:225) → 最终 HTTP body 完全不含 `thinking` 字段**。Anthropic 4.7 在无 thinking 字段时默认不思考。

→ 这**逐字解释了原诊断「`/webapi/chat/anthropic` raw body 完全不含 thinking 字段」**：不是"含 disabled"，而是 disabled 被工厂层吞掉。原观察准确，原诊断只是未定位到工厂过滤。

### 2.2 三层根因（引用 research 全局模型）

| 层 | 现象 | 触发条件 |
|---|---|---|
| **H2** | 请求体无 thinking → 4.x 不思考 | `enableAdaptiveThinking` 默认 falsy（adaptive-only 模型走 disabled 分支被吞）。**4.6 与 4.7 同时中招** |
| **H1** | 思考触发但文本为空（仅 signature） | 即便开了 adaptive，工厂 `:203` 不带 `display` → 4.7 默认 omitted（4.6 默认 summarized，**4.6 无此层**） |
| **H3** | 思考强度退化/GPT-5.5 不思考 | `opus47Effort` / regular `gpt5_2ReasoningEffort` 不写回 store（当前 HEAD 的 `effort` 已修；GPT-5.5 Pro 有 provider force-high 特例） |

> ⚠️ **本设计新增发现**：Opus **4.6 同样受 H2 影响**（extendParams `['disableContextCaching','enableAdaptiveThinking','effort']` 无 `enableReasoning`，`anthropic.ts:64`）。research 修复表低估了 4.6，下文 §5 修正。

---

## 3. 修复方案总览（4 档，每行定位文件:函数）

> 实施后读法：下表不是「只修 GPT-5.5」的证据。它把模型档拆开是为了隔离回归；`a199d6a30f` 实际覆盖 Opus 4.6/4.7 与 regular GPT-5.5，其中 only-`reasoning_effort` 的默认补发只发生在 regular GPT-5.5。

| 档 | 缺陷 | 落点（文件:函数/行） | 改动契约 |
|---|---|---|---|
| **Opus 4.7** | H2 | `modelParamsResolver.ts:172-184` resolveModelExtendParams | adaptive-only 模型未显式关闭时默认 `adaptive` |
| | H1 | `anthropicCompatibleFactory/index.ts:196-213`、`bedrock/index.ts:301-313` | adaptive 分支补 `display:'summarized'`（可配置） |
| | H3 | `modelParamsResolver.ts:254` | `opus47Effort` 加 `|| 'high'` 兜底 |
| **Opus 4.6** | H2 | 同 4.7 的 resolver 改动（自动覆盖） | 同上（adaptive-only 统一生效） |
| | H1 | 无（4.6 默认 summarized） | display 改动对 4.6 无害（值=其默认） |
| | H3 | 无（当前 HEAD 的 `effort` 已修 `0b7821e195`；精确 tag 未修） | — |
| **GPT-5.5** | H3（待抓包裁定） | `modelParamsResolver.ts:204` | regular `gpt5_2ReasoningEffort` 可显式默认 `medium`，但是否需要升 `high` 必须由 raw body/response 裁定 |
| | summary | 无（`openai/index.ts:97` 已注入 `summary:'auto'`） | — |
| **GPT-5.5 Pro** | 防回归 | `openai/index.ts:99-101`、`openaiCompatibleFactory/index.ts:1241-1248` | 保持 provider force-high；不要在 resolver 补默认 `medium`，否则会覆盖 high |
| **全模型通用（可选）** | H3 根治 | `createLevelSlider.tsx:74-85` | mount 时把 defaultValue 写回 store |

---

## 4. 各档详细设计

### 4.1 Opus 4.7（H2 + H1 + H3）

**H2 — adaptive-only 模型默认开启思考**（`modelParamsResolver.ts:172-184`）

```ts
// 示意，非实施
if (modelExtendParams.includes('enableAdaptiveThinking')) {
  const adaptiveOnly = !modelExtendParams.includes('enableReasoning');
  // 未显式关闭时，对 adaptive-only 模型(4.6/4.7)默认 adaptive；含 enableReasoning 的模型维持原逻辑
  const adaptiveEnabled = chatConfig.enableAdaptiveThinking ?? adaptiveOnly;
  if (adaptiveEnabled) {
    extendParams.thinking = { type: 'adaptive' };
  } else if (adaptiveOnly) {
    extendParams.thinking = { type: 'disabled' };
  }
  // adaptive 关 + 含 enableReasoning → 让 enableReasoning 结果生效（不变）
}
```
理由：用 `?? adaptiveOnly` 区分 `undefined`(默认开) 与显式 `false`(用户主动关)。对 Sonnet 4.6（含 enableReasoning）`?? false` → 不强制 adaptive，零回归。

**H1 — adaptive 分支补 display**（`anthropicCompatibleFactory/index.ts:203`、`bedrock/index.ts:308`）

```ts
// 示意
: { type: 'adaptive', display: thinkingDisplay ?? 'summarized' };
```
两选项（§6 取舍）：
- **A（最小）**：工厂内硬编码 `display:'summarized'`，不经 config。
- **B（可配置）**：新增 `chatConfig.thinkingDisplay?: 'summarized'|'omitted'`，经 `ModelExtendParams.thinking.display` 透传到工厂（需改 `ModelExtendParams`(:25-28)、`ChatStreamPayload` thinking 类型、工厂解构）。默认 summarized。
> 约束落实：display 仅加在 `enabled`/`adaptive` 分支，**绝不加在 disabled**。

**H3 — opus47Effort 兜底**（`modelParamsResolver.ts:254`）

```ts
if (modelExtendParams.includes('opus47Effort')) {
  extendParams.effort = chatConfig.opus47Effort || 'high';  // 仿 :251 effort
}
```

### 4.2 Opus 4.6（仅 H2 自动覆盖）

- H2 的 resolver 改动**自动覆盖 4.6**（同为 adaptive-only）→ 4.6 默认也恢复思考。
- H1：4.6 `display` 默认 `summarized`，§4.1-H1 改动对 4.6 是「显式写入其默认值」，无害且语义一致。
- H3：`effort` 已修，无需动。
- 回归校验重点：确认 4.6 改动后请求体为 `thinking:{type:'adaptive'}`（+可选 display:summarized）+ `output_config:{effort}`，与官方 4.6 用法一致。

### 4.3 GPT-5.5（H3，待抓包裁定）

```ts
// 示意，modelParamsResolver.ts:204
if (modelExtendParams.includes('gpt5_2ReasoningEffort')) {
  extendParams.reasoning_effort = chatConfig.gpt5_2ReasoningEffort || 'medium';
}
```
- `summary:'auto'` 已在 `openai/index.ts:97`、`azureOpenai/index.ts:149` 注入，无需改。
- regular GPT-5.5 的 UI 默认值也是 `medium`（`ControlsForm.tsx:101`），因此 resolver 补 `medium` 只是显式化官方默认，不足以证明能修复"完全无思考块"。
- 默认值取舍（§6）：先抓包；若 raw body 证实不发 effort 时 default medium 会 skip，而 high 稳定返回 summary，再把 resolver 默认升为 `high`。
- ⚠️ 该档**强依赖未决问题 §9-3 的抓包结论**（不发 effort 时 `reasoning:{summary:'auto'}` 已发，理论上 default medium 应思考——与"不拖无思考块"现象矛盾）。

### 4.3b GPT-5.5 Pro（防回归，不按旧方案补 medium）

- `openai/index.ts:99-101` 当前对 `isGPT5ProResponsesModel(model)` 强制 `reasoning.effort = 'high'`。
- `openaiCompatibleFactory/index.ts:1241-1248` 合成最终 payload 时，`reasoning_effort` 会覆盖 `reasoning.effort`。
- 因此旧方案中"给 `gpt5_2ProReasoningEffort` 加默认 medium"是错误的：它会把 provider 的 high 降成 medium。
- 若后续确实要让 pro 也走 resolver 默认，默认值必须是 `high`，并添加单测证明最终 `reasoning.effort` 不会从 high 退回 medium。

### 4.4 全模型通用（可选，根治 H3）

`createLevelSlider.tsx` 增加 mount 写回：store 无值时把 `defaultValue` 落 `chatConfig`。
- 收益：一次性解决所有 `*EffortSlider`（grok/deepseek/gpt5_1/hy3…）的同类问题。
- 代价：改变"未交互即写入 store"语义，可能与 agent 配置持久化/diff 产生副作用；影响面广。
- 建议：**非首选**。优先 §4.1 的 Anthropic resolver 默认值；regular GPT-5.5 的 resolver 默认值需等 §9-3 抓包后再定。

---

## 5. 关键设计决策与取舍

| 决策点 | 选项 | 推荐 | 理由 |
|---|---|---|---|
| H2 默认开思考 | A 全局 store 默认 `true` ／ B resolver model-aware `?? adaptiveOnly` ／ C UI 锁定 | **B** | A 会让含 enableReasoning 的模型被强制 adaptive（覆盖 reasoning 设置）；B 波及面最小、零回归 |
| H1 display 入口 | A 工厂硬编码 summarized ／ B 新增 `thinkingDisplay` 可配置 | **A 起步，B 增强** | A 立刻恢复可见思考、改动最小；B 满足"omitted 提速"高级场景，可后续加 |
| H3 修复层 | resolver 默认值 ／ slider mount 写回 | **resolver 默认值** | 已被 `effort` 验证；slider 写回影响面大、有持久化副作用 |
| GPT-5.5 effort 默认 | `medium`(显式化官方默认) ／ `high`(稳定思考) | **待抓包定** | 不拖滑条时已有 `summary:'auto'`，补 medium 未必改变行为；若抓包证实 medium skip 再升 high |
| GPT-5.5 Pro effort 默认 | 保持 provider force-high ／ resolver 补默认 | **保持 force-high** | resolver 补 medium 会覆盖 provider high；若改 resolver，默认必须 high 并配测试 |

---

## 6. 兼容性与回归风险

1. **Sonnet 4.6（含 enableReasoning）**：H2 用 `?? adaptiveOnly` → `?? false`，不被强制 adaptive，零影响。
2. **Opus 4.6**：H2 后默认 adaptive（恢复思考）；display 改动写入其默认值 summarized，语义不变。需回归确认。
3. **disabled × display 互斥**：display 严格 type-gated，仅 enabled/adaptive。
4. **其他 effort 滑条模型**（若采用 §4.4 通用方案）：grok/deepseek/gpt5/gpt5_1/hy3/codexMax 等会被波及，各自 API 默认与取值集需逐一核对——这是放弃 §4.4 的主因。
5. **prompt cache**：切换 thinking 模式（adaptive↔disabled）会断 message 级 cache breakpoint（官方注明）；默认改为 adaptive 后，已有"默认 disabled"用户的首轮 cache 会失效一次，可接受。
6. **历史用户配置迁移**：显式存过 `enableAdaptiveThinking:false` 的用户仍保持关闭（`??` 只对 undefined 生效），无静默翻转。

---

## 7. 验证计划

| 层 | 检查 |
|---|---|
| 抓包（对应 research §5 待办） | 4.7/4.6 默认请求体含 `thinking:{type:'adaptive',display:'summarized'}`(+`output_config.effort`)；GPT-5.5 对比无 effort / medium / high；GPT-5.5 Pro 确认最终 `reasoning.effort` 保持 high |
| 手测 | 4.6/4.7 默认配置下思考块可见 + 用时显示；GPT-5.5 仅在抓包确认默认值后纳入默认可见验收；用同一标准 prompt（24 点等）横比 |
| 回归 | Sonnet 4.6 思考不变；显式关 adaptive 的用户仍不思考；GPT-5.5 Pro 不从 high 降级；其他 effort 滑条模型未被误改 |
| 单测 | `modelParamsResolver` 对各 extendParams 组合输出快照（adaptive-only 默认 adaptive、含 enableReasoning 不强制、opus47Effort 默认值、regular gpt5_2 默认值按抓包结论、pro force-high 不被覆盖） |

---

## 8. Rollout / Rollback

- **分步上线**（解耦、各自可 revert）：① H2(resolver 默认 adaptive，解锁思考) → ② H1(display) → ③ Opus 4.7 `opus47Effort` 默认。GPT-5.5 effort 默认单独排在抓包之后，不与 Anthropic 修复混在一个风险面里。
- **无需 feature flag**：均为默认值/契约调整，rollback = 还原对应改动。
- **灰度建议**：先在 fork 自部署验证 4.6/4.7/GPT-5.5 三模型，再考虑是否回馈上游。

---

## 9. 未决问题（影响实施细节，需真实抓包裁定）

1. **4.7 effort 与思考触发**：`thinking:{type:'adaptive'}` 不带 effort（退默认 high）vs 显式 high/xhigh，对思考触发率与用时的差异。
2. **display omitted→summarized 复现**：手动构造 `{type:'adaptive'}`(无 display) vs `+display:'summarized'`，确认前者思考块为空、后者恢复文本。
3. **GPT-5.5 残留矛盾**：不拖滑条时 `reasoning:{summary:'auto'}` 已发（无 effort），理论上 default medium 应思考——但现象是"无思考块"。需 raw body + response 裁定：是 medium 对该 prompt skip、还是 `responsesAPIModels`(:33) 路由差异。**此结论决定 §4.3 regular GPT-5.5 默认值取 medium 还是 high**。
4. **GPT-5.5 Pro force-high 防回归**：确认当前 provider 强制 high 的最终 payload 不会被 `reasoning_effort` 覆盖；若未来要配置化，默认值必须保持 high。

> 实施任务应在上述抓包完成、design 经椰椰确认后**独立创建**（prd Acceptance Criteria 末条）。
