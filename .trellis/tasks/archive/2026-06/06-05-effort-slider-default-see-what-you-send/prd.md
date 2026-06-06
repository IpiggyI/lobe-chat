# effort 滑块默认值所见即所传修复

> 承接 `05-23-claude-opus-47-thinking-display-investigation`。05-23 的实施 commit `a199d6a30f` 只精修了 3 个 effort 滑块（Anthropic `effort`/`opus47Effort` + GPT-5.5 `gpt5_2ReasoningEffort`），把任务收敛成"修好三个旗舰模型的思考块"，未落实用户原始目标 A 的**通用所见即所传**。本任务补齐剩余 effort 滑块。

## Goal

让用户**未手动拖动滑块时**，effort 类滑块「UI 显示的强度」== 「实际发送给后端的强度」。采用 **resolver 补默认值** 方案（用户拍板），对齐 codebase 既有约定（`thinkingLevel`/`budget` 类 resolver 已有默认兜底，唯独 effort 类大面积缺失）。

**用户验收原则**（2026-06-05 确认）：判定标准是「不交互时**实际行为** == UI 显示值」，而非死板的字段字面一致。当「不发字段」的默认行为已等价 UI 显示值时（如 `gpt5_1` none ≈ 不发，GPT-5.1 默认不推理）可不改；当不一致时（如 `grok4_3` UI=low、`gpt5_2Pro` 实际 force high ≠ UI medium）必须改。

## 已确认事实（代码审计 @HEAD a199d6a30f）

- **resolver 现状**（`src/services/chat/mecha/modelParamsResolver.ts`）：
  - 已有默认 ✅：`effort||'high'`(:257)、`opus47Effort||'high'`(:261)、`gpt5_2ReasoningEffort||'medium'`(:211)
  - 仍 `&& chatConfig.xxx`（不交互不发）❌：`reasoningEffort`(:198)、`gpt5`(:202)、`gpt5_1`(:206)、`grok4_20`(:221)、`grok4_3`(:225)、`hy3`(:229)、`codexMax`(:233)、`gpt5_2Pro`(:214)
  - 对照组：`thinkingLevel`(:278-294) 与 budget(:136-168) 都有 resolver 默认 → 本任务把 effort 类对齐此约定
- **各 slider UI 默认值**（除 `gpt5_2` 外，ControlsForm 均无 model-aware prop、用组件内置固定值）：

  | key | UI 默认 | provider 范围 |
  |---|---|---|
  | `gpt5ReasoningEffort` | medium | openai/azure/zenmux/vercelaigateway/githubCopilot/aihubmix |
  | `grok4_20ReasoningEffort` | medium | xai/volcengine/… |
  | `grok4_3ReasoningEffort` | **low** | xai |
  | `hy3ReasoningEffort` | **high** | volcengine(混元) |
  | `codexMaxReasoningEffort` | medium | openai codex |
  | `reasoningEffort`(通用) | medium | 多家静态 provider + runtime 动态模型源；实施前以当前 active `extendParams` 枚举为准（`qiniu` 当前为注释掉的反例，不计入） |
  | `gpt5_1ReasoningEffort` | **none** | openai/… |
- **特例**：`gpt5_2ProReasoningEffort` 不能按 UI 旧默认补 `medium`。OpenAI provider 有 force-high 逻辑，但 `reasoning_effort` 仍可能在后续 Responses 组包或其他 openai-compatible 路径中影响最终 payload；本任务必须把 Pro 的 UI 和传参链路都固定为 `high`，不能只改 UI。
- **slider levels = 合法取值集**：补「== UI 默认值」一定落在 levels 内，不会被 provider 400 拒绝（单 provider key 安全）。

## Requirements

- **R1**：给单 provider 的 effort key 在 resolver 补 `|| '<对应 UI 默认值>'`，值必须 == 各 slider 内置 `defaultValue`：`gpt5`→medium、`grok4_20`→medium、`grok4_3`→**low**、`hy3`→**high**、`codexMax`→medium。
- **R2**：`gpt5_2ProReasoningEffort` 不得补 UI 旧默认 `medium`，改为 Pro 专用强制 high 链路：resolver 看到该 extendParam 时输出 `reasoning_effort='high'`，忽略旧配置中的 `medium`/`xhigh`；UI 同步锁定 `high` 且禁用。
- **R3**：4.8 不加 model 条目（等上游）；补一条单测固化「adaptive-only 模型默认发 `thinking:{type:'adaptive'}`」不变式，保证未来上游带入 4.7+ 模型自动鲁棒。
- **R4**：每个新补 key 加 `modelParamsResolver.test.ts` 快照测试（对齐 `a199d6a30f` 风格）。
- **R5**：通用 `reasoningEffort` **纳入**补 `|| 'medium'`，落实「传参 == UI」。⚠️ 实施前必须 Evidence 枚举当前实际 active 来源（静态 model-bank + runtime 动态注入），并核实这些模型接受 `reasoning_effort:'medium'`。若某来源不接受或显式 medium 会劣化默认语义，应先 gate 排除该来源并在 design 记录；不要用固定“9 家 provider”作为实施依据。
- **R6**：`gpt5_1ReasoningEffort`（UI 默认 'none'）**排除**——none ≈ 不发字段（GPT-5.1 默认不推理），实际行为已与 UI 一致，无需改。
- **R7（用户原则暴露的新问题）**：`gpt5_2ProReasoningEffort` UI 默认 'medium'，但 Pro 模型的目标实际行为是固定 high。需同时完成两件事：UI 显示/交互锁定 high；resolver 对该 extendParam 输出 high，保证非 OpenAI 专属 force-high 路径也收到 high。**不能**靠 `chatConfig.gpt5_2ProReasoningEffort || 'high'`，因为旧配置的 medium/xhigh 会继续透传。

## Acceptance Criteria

- [ ] 纳入的单 provider effort key，resolver 输出值 == 其 slider UI `defaultValue`（快照测试逐个覆盖）
- [ ] `gpt5_2ProReasoningEffort` 未配置或存在旧配置时，resolver 均输出 `reasoning_effort='high'`，UI 显示 high 且不可调
- [ ] adaptive-only 默认 adaptive 不变式有单测保护
- [ ] `bunx vitest run modelParamsResolver.test.ts` 全绿 + `bun run type-check` 通过
- [ ] 用户批准 push/部署后，Vercel 实测：不拖滑块时抓包确认发送 effort == UI 显示值（至少覆盖 grok4_3=low、hy3=high、gpt5_2Pro=high）

## Out of Scope

- `createLevelSlider` mount 写回 store（design §4.4 通用方案；用户已选 resolver 方案，不走此路）
- 主动新增 `claude-opus-4-8` model 条目（等上游 sync）
- Anthropic `display`/adaptive 链路（`a199d6a30f` 已修，不回炉）
- 其他厂商 thinking 链路、Gemini thinkingLevel（已正常）

## Open Questions

1. ~~通用 `reasoningEffort` 是否纳入？~~ → **已定（2026-06-05）**：纳入。用户原则=传参必须 == UI 显示；slider 显示 medium 就要传 medium。实施前 Evidence 枚举 active 来源并核实兼容性（R5）。
2. ~~`gpt5_1`（none）是否纳入？~~ → **已定（2026-06-05）**：排除（行为已等价，R6）。
3. ~~Q3 gpt5_2Pro 对齐方式~~ → **已定（2026-06-05）**：**方案②+传参强制 high**——ControlsForm 对 `gpt5_2ProReasoningEffort` 锁定 slider value='high' + disabled；resolver 对该 extendParam 输出 literal `'high'`，避免仅 UI 锁定但后端不传 high。
