# Claude Opus 4.7 思考块不显示深度调研

> 🔄 **v2.2.1 复核状态（2026-06-01）**：本计划书原基于 v2.1.58（创建于 2026-05-23）；fork 已于 2026-05-30 同步至 v2.2.1，**全部行号已刷新**。当前工作树为 `v2.2.1-48-gbd9c5bdcce-dirty`（`package.json` 仍为 2.2.1），其中 `effort || 'high'` 是 tag 后提交 `0b7821e195` 引入，精确 `v2.2.1` tag 尚无该修复。复核结论：**H1 证实**（官方逐字坐实）、**H2 证实并升级为「最终请求体缺 thinking → 开箱默认不思考」**、**H3 部分已修**（仅当前 HEAD 的 `effort`）、**H4 原 summary 假设证伪，但 GPT-5.5/pro 默认 effort 方案需抓包后定**。完整证据见 `research/v2.2.1-revalidation.md`。下文各假设末尾的「🔄 v2.2.1 复核」块为本次更新。
>
> ⚠️ **2026-06-04 实施后偏差更正**：后续提交 `a199d6a30f` 已实际实施修复，且修复面证明早期调研方向存在严重偏差：问题不应被收敛为「GPT-5.5 不手动拖动滑块就不发送 `reasoning_effort`」。该症状只覆盖 regular GPT-5.5 的显式默认值；主修复面实际是 Opus 4.6/4.7 的 adaptive thinking 默认开启、Opus 4.7 `display:'summarized'`、以及 `opus47Effort || 'high'`。先读 `research/post-implementation-course-correction.md` 再解读本 PRD 的早期假设。

## 背景

椰椰在自部署 lobe-chat 中测试三家旗舰思考模型，发现仅 Gemini 3.5 Flash 显示「已深度思考（用时 X 秒）」思考块，Claude Opus 4.7 与 GPT-5.5 均无思考块。Vercel runtime logs 显示 `/webapi/chat/anthropic` 与 `/webapi/chat/openai` 的 raw request body **完全不含** `thinking` / `reasoning_effort` / `budget_tokens` 字段。

初步排查暴露了 lobe-chat 在 Anthropic 思考链路上的 3 个独立疑似缺陷，但仅基于代码阅读与官方文档比对，未做端到端实验复现。**本任务的目的是用实验证据夯实/证伪这些假设，并产出修复方案的设计文档**（不实施代码改动，不出 PR）。

## Goal

完成以下两件事，全部以书面证据形式归档到 `.trellis/tasks/05-23-.../research/` 与 `design.md`：

1. **证实或证伪 4 个根因假设**（H1/H2/H3 关于 Claude，H4 关于 GPT-5.5），每条都要有官方文档引用 + lobe-chat 源码定位 + 真实请求体或网络抓包证据
2. **产出版本差异化修复方案**（不实施），明确 Opus 4.6 / Opus 4.7 / GPT-5.5 分别需要改什么、改哪个文件、改动的最小集

## 调研范围（4 个独立假设）

### H1 — `thinking.display` 字段缺失导致 Opus 4.7 默认 omitted

**假设**：lobe-chat `packages/model-runtime/src/core/anthropicCompatibleFactory/index.ts:180-197` 与 `packages/model-runtime/src/providers/bedrock/index.ts:228-241` 在构建 `thinking` 对象时未携带 `display` 字段。Opus 4.7 的 Anthropic 端默认值是 `display: 'omitted'`（4.6 默认 `'summarized'`），因此即使思考触发，前端也只收到带 signature 的空 thinking 块，看不到思考内容。

**需要验证**：
- 抓真实请求体确认 lobe-chat 发出的 thinking 对象结构（不要只看代码）
- 用 Anthropic 直接 API 做对照实验：分别传 `{type:'adaptive'}` 与 `{type:'adaptive', display:'summarized'}` 看响应差异
- 阅读 Anthropic 官方 changelog/migration guide 确认 4.7 默认值真为 omitted

**🔄 v2.2.1 复核（证实）**：官方已坐实——Opus 4.7 `thinking.display` 默认 `omitted`，需显式 `{type:'adaptive', display:'summarized'}` 才返回思考文本（[adaptive-thinking](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking)）。当前代码 `anthropicCompatibleFactory/index.ts:196-213` 的 adaptive 分支只发 `{type:'adaptive'}`、**从不带 display**（`bedrock/index.ts:301-313` 同构）。补充：思考强度已由上游改走 `output_config:{effort}`（:209、:236-240），与 display **正交**、不取代它——计划书原描述未提此路径。**修复约束**：`display` 与 `thinking.type:'disabled'` 互斥，须按 type 分别处理。

### H2 — `enableAdaptiveThinking` 在 Opus 4.7 上是伪选项

**假设**：
- `packages/model-bank/src/aiModels/anthropic.ts:29` Opus 4.7 的 `extendParams` 包含 `'enableAdaptiveThinking'`
- `src/routes/(main)/settings/provider/features/ModelList/CreateNewModelModal/ExtendParamsSelect.tsx:210-214` 该 key 的 labelSuffix 标注 `' (Opus 4.6)'`——开发者自知是 4.6 的概念
- `src/services/chat/mecha/modelParamsResolver.ts:138-150` 关掉此开关 + Opus 4.7 不含 `enableReasoning` fallback → 传 `thinking: {type:'disabled'}`
- Anthropic 端 Opus 4.7 不支持非 adaptive 模式，"disabled" 实际等于"主动禁用思考"

**需要验证**：
- 用 Anthropic API 直接发 `thinking: {type:'disabled'}` 给 Opus 4.7，记录是 400 错误、被忽略、还是真的禁用思考
- 确认 4.6 在 lobe-chat 上保留此开关是否仍合理（4.6 还有 `{type:'enabled', budget_tokens}` 模式）
- 评估"关闭自适应思维"在 4.7 上的合理交互应该是什么（隐藏开关 / 锁定为 true / 禁用 + 提示用户）

**🔄 v2.2.1 复核（证实，升级）**：`modelParamsResolver.ts:172-184` 逻辑同原描述；且 `DEFAULT_AGENT_CHAT_CONFIG`（`packages/const/src/settings/agent.ts:26-40`）**没有 `enableAdaptiveThinking` 默认值** → 默认 `undefined`(falsy) → Opus 4.7（extendParams 无 `enableReasoning`，`anthropic.ts:30`）在 resolver 层产出 `thinking:{type:'disabled'}`。但 `anthropicCompatibleFactory/index.ts:196` 只处理 `enabled/adaptive`，会把 `disabled` 静默丢弃，**最终 HTTP body 完全不含 `thinking`**。Anthropic 对无 `thinking` / disabled 的语义都是"不思考"——**这是思考块不显示的开箱默认主因**，比"伪选项"更严重。Opus 4.6（`anthropic.ts:64`）同样是 adaptive-only，也受 H2 影响。UI 预览 `ExtendParamsSelect.tsx:355` 是 `<Switch checked disabled />`（意图锁定开），但 store 默认未兑现。

### H3 — Slider defaultValue 不写回 store（全局通病）

**假设**：所有 `createLevelSliderComponent`（effort/level/budget 类滑条）的 defaultValue 仅作 UI 回退，不会写入 `chatConfig`。导致 UI 显示 high/xhigh 但请求体根本没有相应字段——椰椰在 GPT-5.5 上已经亲身验证（手动拖动滑条后思考块出现）。

**需要验证**：
- `docs/plans/2026-04-20-effort-default-and-manual-mode-tools.md` 提到的修复方案是否已被实施（看 git log + 代码当前状态）
- 受影响的所有滑条清单（包括但不限于 effort, opus47Effort, gpt5_2ReasoningEffort, thinkingLevel\*, reasoningBudgetToken\*）
- 评估根因层修复（modelParamsResolver 加默认值）vs UI 层修复（mount 时写 store）的取舍

**🔄 v2.2.1 复核（证实，范围收窄）**：机制坐实——`createLevelSlider.tsx:74-85` 的 `resolveValue()` 仅把 defaultValue 当显示回退、**无 mount 写回**，仅 onChange 写 store。当前 HEAD 中 `effort` 已被 commit `0b7821e195` 在 `modelParamsResolver.ts:250-251` 加 `|| 'high'` 兜底修复（精确 `v2.2.1` tag 尚无此修复）。**仍未修**：`opus47Effort`(:254)、`gpt5_2ReasoningEffort`(:204)；`gpt5_2ProReasoningEffort` 虽未写回，但 OpenAI provider 对 pro 已强制 `reasoning.effort='high'`，不能简单补 resolver 默认 `medium`，否则会覆盖 provider 的 high。⚠️ Opus 4.7 走 `opus47Effort` 而非 `effort`，**04-20 的修复对 4.7 无效**；受影响清单应据此更新。

### H4 — GPT-5.5 思考链路是否还有 slider 之外的隐性缺陷

**假设**：除了 H3 的 slider defaultValue 问题外，GPT-5.5 的 reasoning 渲染可能还存在 lobe-chat 端的次生问题。OpenAI Responses API 对 reasoning 返回有自己的契约（`reasoning.summary`、`reasoning_effort` 取值集、流式 reasoning delta 事件等），lobe-chat 不一定完整覆盖。

**需要验证**：
- 椰椰拖动滑条后思考块出现——但**思考用时是否准确显示**？还是只显示无时长版本"已深度思考"？回看 `StreamingHandler.ts` 的 `startReasoningIfNeeded` / `endReasoningIfNeeded` 是否正确响应 OpenAI Responses 的 reasoning chunk
- `packages/model-runtime/src/core/streams/openai/responsesStream.ts:124-131` 当前 emit 的 `type: 'reasoning'` chunk 是否完整（含起止信号、含 summary text）
- GPT-5.5 vs GPT-5.5-pro 的 `gpt5_2ReasoningEffort` vs `gpt5_2ProReasoningEffort` 分流是否正确（model-bank 中 5.5-pro 用 `gpt5_2ProReasoningEffort`，但 5.5 用 `gpt5_2ReasoningEffort`；ChatConfig 是否会串）
- 是否存在类似 Opus 4.7 `display` 的"reasoning summary 默认不返回"的 OpenAI 端策略——查 OpenAI Responses API 关于 `reasoning.summary: 'auto' | 'concise' | 'detailed' | null` 的官方文档

**🔄 v2.2.1 复核（部分证伪，保留抓包裁定）**：分流正确（`openai.ts` `gpt-5.5:50→gpt5_2ReasoningEffort:94`、`gpt-5.5-pro:111→gpt5_2ProReasoningEffort:131`）。**「summary 默认不返回」假设证伪**：`providers/openai/index.ts:95-112` 对命中 `prunePrefixes`(:14 含 `'gpt-5'`) 的模型 responses 路径**无条件注入 `reasoning:{summary:'auto'}`**（`gpt-5.5`/`-pro` 均命中；`azureOpenai/index.ts:149-150` 同）；流式渲染 `responsesStream.ts:121-132` 也完整。regular GPT-5.5 的 `gpt5_2ReasoningEffort` 不写回会导致不显式发 effort，但 OpenAI 默认就是 medium，且 UI 对 `model === 'gpt-5.5'` 也显示 medium，所以补 `medium` 只是显式化，不一定修复"完全无思考块"。GPT-5.5 Pro provider 已强制 high，不能按旧计划补默认 medium。⚠️ 残留矛盾需抓包：不拖滑条仍发 `reasoning:{summary:'auto'}`（无 effort），理论上 medium 应思考——"完全无思考块"待 raw body 裁定。

## 全局根因模型（v2.2.1 复核新增）

**Opus 4.7 思考块不显示 = 两层独立 bug 叠加**：① 开箱默认 H2（`enableAdaptiveThinking` 无默认 → resolver 产出 disabled → factory 丢弃 → 最终 body 无 `thinking` → 不思考）；② 手动开 adaptive 后 H1（不带 `display:'summarized'` → 默认 omitted → thinking 块空）。**修 H2 让它思考、修 H1 让思考可见，缺一不可**；H3（`opus47Effort` 不发）是思考强度/体验层。GPT-5.5 的 summary 链路已存在，默认 effort 是否需要显式化或升 high 必须由抓包决定；GPT-5.5 Pro 不应按旧表补 medium。差异化修复方案表见 `research/v2.2.1-revalidation.md` 第四节。

**实施后校正**：`a199d6a30f` 最终采用的是 Anthropic-first 的修复组合，而不是 GPT-5.5-first 的全局 slider 修复。regular GPT-5.5 只补了 `gpt5_2ReasoningEffort || 'medium'`；通用 `reasoningEffort`、GPT-5、GPT-5.1、Grok 等路径并未全局补默认。这个结果反向证明早期把 `reasoning_effort` 缺失当作主线的判断过窄，必须把 provider/factory 后处理纳入根因模型。

## 调研产出物

| 产出物 | 位置 | 内容要求 |
|--------|------|---------|
| 假设验证报告 | `research/H1-display-field.md` `research/H2-adaptive-pseudo-switch.md` `research/H3-slider-default-store.md` `research/H4-gpt55-reasoning-chain.md` | 每条：原假设 / 验证方法 / 实验数据 / 结论（证实/证伪/部分证实） |
| Anthropic 官方文档摘录 | `research/anthropic-thinking-spec.md` | Opus 4.6 vs 4.7 在 thinking / effort / display 上的差异表，附文档链接与抓取日期 |
| OpenAI 官方文档摘录 | `research/openai-reasoning-spec.md` | GPT-5 / 5.5 Responses API 的 reasoning 契约：reasoning_effort 取值、summary 默认值、流式 delta 事件结构，附文档链接 |
| 真实请求体抓包 | `research/raw-request-samples.md` | 至少 5 组真实 raw body + response stream：Opus 4.7 开/关 adaptive、Opus 4.6 + 同条件、GPT-5.5 拖动滑条前后、对照组 |
| 修复方案设计 | `design.md` | 按"Opus 4.6 / Opus 4.7 / GPT-5.5 / 全模型通用"四档拆出修复方案；最小改动集；不引入对其他链路的回归 |

## 实验授权范围（已与椰椰确认）

- ✅ **允许直接调 Anthropic API 做对照实验**（消耗少量 Opus 4.7 / 4.6 token，每个对照组 1-2 次请求即可，整体预算控制在 < 10 万 token）
- ✅ **允许直接调 OpenAI API 做对照实验**（GPT-5.5 reasoning 链路验证）
- ✅ 所有实验 prompt 用同一条标准化测试 prompt（如"解 24 点 1 1 5 8"等需要思考的简单数学题），便于横向比对

## Non-goals（明确不做的事）

- ❌ **不实施任何代码修改**，调研结束只产出文档
- ❌ **不开 PR、不提交 commit**
- ❌ 不调研其他厂商（DeepSeek / Qwen / Doubao / Moonshot / xAI Grok 的 thinking 链路）
- ❌ 不涉及 Gemini 3.x thinkingLevel 链路（已知工作正常）
- ❌ 不调研 Claude Sonnet / Haiku 系（聚焦 Opus 4.6/4.7）

## Acceptance Criteria

- [ ] H1/H2/H3/H4 四个假设各有一份独立 research 报告，结论明确（证实/证伪/部分证实），不留 TBD
- [ ] `research/anthropic-thinking-spec.md` 至少覆盖 Anthropic 官方 5 个事实点（adaptive 强制 / display 默认 / effort 档位 / budget_tokens 状态 / 模型版本支持矩阵），每点带文档链接
- [ ] `research/openai-reasoning-spec.md` 至少覆盖 OpenAI 官方 4 个事实点（reasoning_effort 取值集 / summary 默认与可选值 / 流式 delta 事件类型 / GPT-5.5 vs 5.5-pro 差异），每点带文档链接
- [ ] `research/raw-request-samples.md` 含 ≥ 5 组真实抓包样本，覆盖 Opus 4.6/4.7 与 GPT-5.5；thinking/reasoning 对象结构完整保留（system prompt 可脱敏）
- [ ] `design.md` 输出按 4 档拆开的修复方案表（4.6 / 4.7 / GPT-5.5 / 通用），每行能定位到具体文件与函数
- [ ] 椰椰审阅 design.md 后确认方案合理，再决定是否进入实施任务（implement 任务独立创建）

## 约束

- 调研期间禁止改动 `src/` `packages/` 下任何业务代码；只允许写入 `.trellis/tasks/05-23-.../`
- 如发现 H1-H4 之外的相关问题，新增到 `research/extra-findings.md`，不要扩散影响主调研
- 实验 token 消耗单独记录在 `research/raw-request-samples.md` 顶部（哪个模型、多少次请求、估算 token 数）

## Notes

- 关联文档：`docs/plans/2026-04-20-effort-default-and-manual-mode-tools.md`（slider defaultValue 问题历史记录）
- 关联会话：本次诊断对话产生的 Vercel runtime logs 时段为 2026-05-23 10:16-10:17（dpl_9pe3ZwETTG1PWxhaS5zqjgnpw4KN）
