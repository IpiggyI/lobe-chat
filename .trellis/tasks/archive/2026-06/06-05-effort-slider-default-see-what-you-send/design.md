# Design — effort 滑块默认值所见即所传

> 依赖 prd.md。基线 HEAD `a199d6a30f`。代码片段为契约示意（行号会漂移）。

## 1. 边界

- **In-scope**：`modelParamsResolver.ts` 中剩余 effort key 补 resolver 默认值；`gpt5_2Pro` 的 UI 显示与传参链路都固定 high；4.8 鲁棒性单测。
- **Out-of-scope**：slider mount 写回（§4.4 方案不走）、新增 4.8 model 条目、Anthropic display/adaptive（已修）、修 slider levels 与模型能力不匹配的既有 bug。

## 2. 数据流

```
chatConfig(store) ──resolveModelExtendParams──► ModelExtendParams{reasoning_effort|effort}
  ├─ OpenAI 系: reasoning_effort ──openaiCompatibleFactory──► reasoning.effort ──provider.handlePayload──► HTTP body
  │     └─ ⚠️ pro 系: 目标行为固定 high；不能依赖单个 provider 的 force-high，resolver 需直接输出 high
  └─ Anthropic: effort ──anthropicCompatibleFactory──► output_config.effort
```

核心病灶：resolver 对多数 effort key 用 `&& chatConfig.xxx` —— store 无值（未交互）就**不写字段**，而 UI slider 用 `defaultValue` 显示了一个值 → **UI 显示 ≠ 实际传参**。修法：对齐 `thinkingLevel`/`budget` 既有约定，改成 `|| '<UI defaultValue>'`。

## 3. 修复清单（逐 key）

| key | resolver 现状 | 改为 | UI 默认(=补值) | provider | 风险 |
|---|---|---|---|---|---|
| `gpt5ReasoningEffort` | `&&` :202 | `\|\| 'medium'` | medium | openai/azure/… | 低 |
| `grok4_20ReasoningEffort` | `&&` :221 | `\|\| 'medium'` | medium | xai/volcengine | 低 |
| `grok4_3ReasoningEffort` | `&&` :225 | `\|\| 'low'` | **low** | xai | 低 |
| `hy3ReasoningEffort` | `&&` :229 | `\|\| 'high'` | **high** | volcengine混元 | 低 |
| `codexMaxReasoningEffort` | `&&` :233 | `\|\| 'medium'` | medium | openai codex | 低 |
| `reasoningEffort`(通用) | `&&` :198 | `\|\| 'medium'` | medium | active 来源枚举后确认 | 见 §4 |
| `gpt5_1ReasoningEffort` | `&&` :206 | **不改** | none | openai | none≈不发,等价 |
| `gpt5_2ProReasoningEffort` | `&&` :214 | literal `'high'` | UI 锁 high | openai-compatible pro | 见 §5 |

> 补值规则：普通 resolver 默认值 === 该 slider 内置 `defaultValue`（已逐个核对：见 prd 表）。`gpt5_2ProReasoningEffort` 是例外：旧 slider 默认 medium 与实际目标 high 冲突，因此本任务同时把 UI 锁到 high，并在 resolver 写 literal `'high'`。

## 4. 通用 `reasoningEffort` 风险边界（R5）

- `REASONING_EFFORT_LEVELS = ['low','medium','high']` 含 medium ✅。
- 不再使用固定“9 家 provider”清单。实施前以当前代码枚举 active 来源：
  - 静态 model-bank 中直接配置 `extendParams: ['reasoningEffort']` 的模型；
  - runtime 动态注入 `reasoningEffort` 的 provider（例如 openrouter / vercelaigateway）；
  - 明确排除注释掉的反例（例如 `qiniu` 当前注释说明 `grok-code-fast-1` 不支持 `reasoning_effort`）。
- **风险判断**：补 `'medium'` 会影响未交互用户，不完全等价于“用户手动选择 medium”。若 Evidence 发现某 active 来源不接受 medium，或显式 medium 与 provider 默认语义不等价，应先 gate 排除该来源，不能把它归类成“既有 UI bug”后直接放行。
- R5 仍纳入补 medium，但必须带一条实施记录：列出 active 来源、兼容性依据、被排除项（若有）。

### R5 实施记录（2026-06-06 evidence @审计）

- **active 静态来源**（`packages/model-bank/src/aiModels/**` 含通用 `extendParams:['reasoningEffort']`）：`openai`（o/gpt-5 系列多条）、`perplexity`（sonar-reasoning）、`aihubmix`、`zenmux`、`vercelaigateway`、`akashchat`、`opencodeZen`、`opencodeCodingPlan`。
- **兼容性依据**：均为 OpenAI-compatible reasoning 模型，`reasoning_effort ∈ {low,medium,high}`（`REASONING_EFFORT_LEVELS`，见 `ReasoningEffortSlider.tsx`），medium 为合法中间档，不会被 provider 400；补 `|| 'medium'` == slider `defaultValue:'medium'`，落实所见即所传。
- **被排除项**：`qiniu` 中 `grok-code-fast-1` 的 `extendParams:['reasoningEffort']` 已注释（注明不支持 `reasoning_effort`），非 active，不计入。
- **结论**：无 active 来源需 gate，补 medium 安全。

## 5. Q3 — gpt5_2Pro UI≠实际（force high）

**事实**：Pro family 的目标行为是固定 high。`providers/openai/index.ts` 有 force-high 逻辑，但不能把它当成唯一保障：`reasoning_effort` 仍会参与后续 Responses 组包，Azure / AiHubMix / ZenMux 等 openai-compatible 路径也不都经过同一段 OpenAI provider force-high。因此本任务需要在 resolver 层输出 high，让所有下游路径收到一致的 high。

**方案**（prd Q3 已确认）：

| 选项 | 做法 | 评价 |
|---|---|---|
| ①（最小） | `GPT52ProReasoningEffortSlider` `defaultValue` 改 `'high'` | 半吊子：默认对了，但用户拖到 medium/xhigh 仍 UI≠实际 high。不彻底 |
| **②（采用）** | ControlsForm 对 `gpt5_2ProReasoningEffort` 把 slider **锁定 high + disabled**；resolver 对该 extendParam 写 literal `'high'` | 所见即所传：UI 恒显 high 且不可改，发送值也恒为 high |
| ③ | pro 模型隐藏 effort slider | 更激进，丢失"告知用户 pro 固定 high"的信息 |

> ✅ **用户已选方案 ②（2026-06-05），2026-06-06 修正为“UI 锁定 + resolver 强制 high”**。ControlsForm 不需要复制 model 正则，优先使用当前已有的 `modelExtendParams?.includes('gpt5_2ProReasoningEffort')` 作为判定；resolver 也以同一 extendParam 为准。

实现约束：

- `modelParamsResolver.ts` 中 `gpt5_2ProReasoningEffort` 分支必须直接 `extendParams.reasoning_effort = 'high'`，不能写成 `chatConfig.gpt5_2ProReasoningEffort || 'high'`。
- 该分支应覆盖旧配置中的 `medium` / `xhigh`，避免历史 store 值继续透传。
- `GPT52ProReasoningEffortSlider` 要支持 disabled，需要先把 `disabled` prop 贯通到 `createLevelSliderComponent` 和 `LevelSlider`，并禁用底部 label button 点击。

## 6. 4.8 鲁棒性（R3）

不加 model 条目。在 `modelParamsResolver.test.ts` 补一条不变式测试：**任意 `extendParams` 含 `enableAdaptiveThinking` 且不含 `enableReasoning`、且 `chatConfig.enableAdaptiveThinking` 未设 → 输出 `thinking:{type:'adaptive'}`**。保证未来上游带入 opus-4-8（若配 adaptive-only）自动获得默认思考，无需再改 resolver。若 4.8 引入新 `opus48Effort` key，则需届时按本任务模式补 resolver 默认（design 记录，非本次实施）。

## 7. 兼容性 / 回归

1. 补默认只影响 **store 无值（未交互）** 用户；已 `updateAgentChatConfig` 过的值不受影响（`||` 仅对 falsy 生效）。
2. 通用 reasoningEffort：见 §4，实施前必须枚举 active 来源并记录兼容性；不能把未交互默认补 medium 简化成既有手选风险。
3. gpt5_2Pro resolver 改为 literal high，覆盖旧配置；UI 仅展示 high 且 disabled，不把默认值写回 store。
4. prompt cache：effort 档位变化不切换 thinking type，不断 message-level cache。
5. Anthropic `effort`/`opus47Effort` 已修，本任务不碰。

## 8. 验证

| 层 | 检查 |
|---|---|
| 单测 | resolver 对 6 个新补 key 输出 == UI 默认值快照；gpt5_2Pro 未配置/旧配置均输出 high；4.8 adaptive-only 不变式 |
| UI 单测 | `LevelSlider` / `createLevelSliderComponent` 支持 disabled；ControlsForm 渲染 pro extendParam 时 slider value=high 且 disabled |
| type-check | `bun run type-check` |
| 实测(Vercel，需用户批准 push/部署后) | 不拖滑块抓包：`grok4_3`=low、`hy3`=high（两个非 medium 项）、通用 reasoningEffort=medium 确认发送值==UI；gpt5_2Pro 最终 high 且 UI 显示 high |

## 9. Rollout / Rollback

- resolver 改动与 UI(gpt5_2Pro) 改动可拆成独立提交边界；实际 commit/push 需用户批准。
- 无 feature flag；rollback = 还原对应行。
- 用户批准 push/部署后，先 fork 自部署验证，再考虑回馈上游。
