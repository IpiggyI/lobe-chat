# Implement — effort 滑块默认值所见即所传

> 依赖 prd.md / design.md。Q3 已定：**方案② + 传参强制 high**（ControlsForm 锁定 pro 的 effort slider = high + disabled；resolver 对 `gpt5_2ProReasoningEffort` 输出 literal high）。

## 进度（2026-06-06）

- ✅ **Step 0**（R5 evidence）：active 来源核实完成，结论记于 design.md §4「R5 实施记录」——无来源需 gate，补 medium 安全。
- ✅ **Step 1**（resolver 补默认值）：6 个单 provider key 补 `|| <UI默认>`；`gpt5_2ProReasoningEffort` → literal `'high'`；`gpt5_1` 保持不动。
- ✅ **Step 2/3**（resolver 测试）：6 key 快照 + gpt5_2Pro 未配置/旧值(medium/xhigh)→high + 4.8 adaptive-only 不变式。`modelParamsResolver.test.ts` 89 绿。
- ✅ **Step 4**（gpt5_2Pro UI 锁定）：`LevelSlider`/`createLevelSlider` 贯通 `disabled`；ControlsForm 用 **`getValueProps:()=>({value:'high'})` + `disabled`** 锁定（**修正 implement 原写法**：form 注入 value 会覆盖子元素 `value="high"`，见 rc-field-form Field.js:458，故改用 getValueProps 解耦 store↔显示，正确覆盖新用户与旧配置两种情况）。
- ✅ **Step 5**（本地验证）：3 测试文件 102 绿；`bun run type-check` EXIT=0。
- ⏳ **Step 6**（Vercel 实测）：待 椰椰 批准 push/部署后抓包验证。

### Codex review 轮次（2026-06-06，椰椰 委托 Codex 复审后修复）

- **P1（修）**：`gpt5_2ReasoningEffort` UI≠传参 —— ControlsForm:110 仅原生 `gpt-5.5` 显示 medium，gpt-5.2 / openrouter gpt-5.x 显示 none，但 resolver 未配置一律发 medium（先于本任务存在，PRD 误标「✅ 已有默认」）。椰椰拍板「严格所见即所传，两方向都不许 mismatch」→ resolver 改为 `chatConfig.gpt5_2ReasoningEffort || (model === 'gpt-5.5' ? 'medium' : 'none')` 镜像 UI。补测试：gpt-5.5 unset→medium、gpt-5.2 unset→none。**行为变化**：gpt-5.2/openrouter gpt-5.x 未交互默认推理 medium→none（= UI 显示）。
- **P2（修）**：`ExtendParamsSelect.tsx:359` 自定义模型预览 pro slider `value="medium"` → `value="high"`，符合该文件「预览=默认发送值」惯例。
- **P3（修）**：`createLevelSlider.test.tsx` 「disabled alone」用例原传了 `value="high"`，致 `isControlled` 恒真、删 `|| disabled` 仍绿 —— 改为 `<TestSlider disabled />` 不传 value/onChange，真正护住该分支。
- 复验：eslint/prettier EXIT=0；`modelParamsResolver`+`createLevelSlider`+`ControlsForm` 三文件 **103 绿**；`type-check` EXIT=0。

## 有序 Checklist

### Step 0 — R5 active 来源核实（实施前 evidence）
- [ ] 枚举当前 active `reasoningEffort` 来源：静态 `packages/model-bank/src/aiModels/**` + runtime 动态注入（例如 openrouter / vercelaigateway）
- [ ] 明确排除注释/禁用反例（例如 `qiniu` 中 `grok-code-fast-1` 注释说明不支持 `reasoning_effort`）
- [ ] 记录兼容性结论：哪些来源可默认 medium，哪些需要 gate（若有）

### Step 1 — resolver 补默认值（核心）
文件：`src/services/chat/mecha/modelParamsResolver.ts`
- [ ] `reasoningEffort`(:198~199)：`chatConfig.reasoningEffort` → `chatConfig.reasoningEffort || 'medium'`
- [ ] `gpt5ReasoningEffort`(:202~203)：`|| 'medium'`
- [ ] `grok4_20ReasoningEffort`(:221~222)：`|| 'medium'`
- [ ] `grok4_3ReasoningEffort`(:225~226)：`|| 'low'`
- [ ] `hy3ReasoningEffort`(:229~230)：`|| 'high'`
- [ ] `codexMaxReasoningEffort`(:233~234)：`|| 'medium'`
- [ ] 形式对齐既有 `effort`(:257)/`opus47Effort`(:261)/`gpt5_2`(:211)：从 `if (includes && chatConfig.x)` 改为 `if (includes) { extendParams.reasoning_effort = chatConfig.x || '<默认>' }`
- [ ] `gpt5_2ProReasoningEffort`(:214)：改为 `if (includes) { extendParams.reasoning_effort = 'high' }`，不能使用 `chatConfig.gpt5_2ProReasoningEffort || 'high'`
- [ ] **不动** `gpt5_1`(:206)

### Step 2 — resolver 快照测试（R4）
文件：`src/services/chat/mecha/modelParamsResolver.test.ts`
- [ ] 6 个新补 key 各加一例：未设 chatConfig → 输出 `reasoning_effort === '<UI默认>'`
- [ ] `gpt5_2Pro` 未设 → 输出 `reasoning_effort === 'high'`
- [ ] `gpt5_2Pro` 旧配置为 `medium` / `xhigh` → 仍输出 `high`（防历史 store 值透传）
- [ ] `gpt5_1` 未设 → 不输出（确认排除）
- [ ] 若 chat service 已有链路测试适合扩展，补一例 pro extendParam + 空 chatConfig → `getChatCompletion` 收到 `reasoning_effort:'high'`

### Step 3 — 4.8 鲁棒性不变式（R3）
文件：同 `modelParamsResolver.test.ts`
- [ ] 构造 `extendParams:['enableAdaptiveThinking', <某effort>]`（无 `enableReasoning`）、`chatConfig.enableAdaptiveThinking` 未设 → 断言输出 `thinking:{type:'adaptive'}`。注释说明此为「未来 opus-4-8 等 adaptive-only 模型自动获默认思考」的护栏

### Step 4 — gpt5_2Pro UI 对齐（R7，方案②）
文件：
- `src/features/ModelSwitchPanel/components/ControlsForm/LevelSlider.tsx`
- `src/features/ModelSwitchPanel/components/ControlsForm/createLevelSlider.tsx`
- `src/features/ModelSwitchPanel/components/ControlsForm/ControlsForm.tsx`
- `src/features/ModelSwitchPanel/components/ControlsForm/__tests__/createLevelSlider.test.tsx`
- `src/features/ModelSwitchPanel/components/ControlsForm/__tests__/ControlsForm.test.tsx`

- [ ] 给 `LevelSliderProps` / `CreatedLevelSliderProps` 增加 `disabled?: boolean`，贯通到 antd `<Slider disabled />`
- [ ] disabled 时底部 level label button 也要 `disabled`，点击不得触发 `setCurrentLevel`
- [ ] ControlsForm 使用 `modelExtendParams?.includes('gpt5_2ProReasoningEffort')` 判定，不复制 model 正则
- [ ] pro 时把 `GPT52ProReasoningEffortSlider` 锁定 `value='high'` 且 `disabled`
- [ ] `createLevelSlider.test.tsx` 覆盖 controlled disabled 不调用 store、不响应 label 点击
- [ ] `ControlsForm.test.tsx` 当前 mock Form 不渲染 children；测试前需扩展 mock，使其能暴露 item children，或只断言传入的 item props。不要写一个永远看不到 slider 的空壳测试

### Step 5 — 本地验证
- [ ] `bunx vitest run --silent='passed-only' 'src/features/ModelSwitchPanel/components/ControlsForm/__tests__/createLevelSlider.test.tsx'`
- [ ] `bunx vitest run --silent='passed-only' 'src/services/chat/mecha/modelParamsResolver.test.ts'`
- [ ] 若改了 ControlsForm：`bunx vitest run --silent='passed-only' 'src/features/ModelSwitchPanel/components/ControlsForm/__tests__/ControlsForm.test.tsx'`
- [ ] `bun run type-check`

### Step 6 — Vercel 实测（需用户批准 push/部署后）
- [ ] 抓包验证不拖滑块时发送 effort == UI 显示：重点 `grok4_3`=low、`hy3`=high（非 medium 项最能暴露偏差）
- [ ] 验证通用 `reasoningEffort` 模型发送 medium
- [ ] 验证 `gpt5_2Pro` 最终 `reasoning.effort`=high 且 UI 显示 high
- [ ] ⚠️ 顺带验证 `gpt5_1` 不拖时实际是否思考（确认 R6「none≈不发」假设；若实际在思考=默认medium，则回头补 none）

## 验证命令汇总
```bash
bunx vitest run --silent='passed-only' 'src/services/chat/mecha/modelParamsResolver.test.ts'
bunx vitest run --silent='passed-only' 'src/features/ModelSwitchPanel/components/ControlsForm/__tests__/createLevelSlider.test.tsx'
bun run type-check
```

## 风险文件 / Rollback
- `modelParamsResolver.ts`：核心。每个 key 独立行，rollback = 还原对应 `|| 默认` 为 `&& chatConfig`。
- `modelParamsResolver.ts` 的 Pro 分支 rollback 要特别注意：从 literal high 回退会重新暴露 UI high 但未必传 high 的不一致。
- `LevelSlider.tsx` / `createLevelSlider.tsx` / `ControlsForm.tsx`（Step 4）：UI 层，可作为独立提交边界，实际 commit 需用户批准。
- **rollback 点**：Step 1（resolver）与 Step 4（UI）可拆两个提交边界，互不依赖。

## start 前 follow-up
- [ ] Q3 方案已由用户确认
- [ ] 用户已 review prd/design/implement 或批准 proceed
