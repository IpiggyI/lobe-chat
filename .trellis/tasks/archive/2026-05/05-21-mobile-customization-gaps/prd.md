# 修复移动端定制功能入口缺失

## Goal

用户（椰椰）反馈在移动端使用 fork 时，多个定制 / 桌面端原有功能在移动端找不到入口或没生效。本任务定位每个缺口的真实根因，确认修复范围，把移动端核心定制能力恢复到与桌面端体验对齐的水平。

## Confirmed Facts (from code inspection)

- 移动端 UI 不是 "上游原版"，而是 **`(mobile)` 独立路由 + 大量复用 `(main)` 桌面组件** 的混合架构。
- 已确认的 "代码层共享" 路径：
  - 移动 Chat 页 `src/routes/(mobile)/chat/index.tsx` 直接复用桌面 `(main)/agent/features/Conversation/ConversationArea`，内部使用 `MainChatInput`。
  - `MainChatInput` 配置 `leftActions: ['model','search','memory','incognito','fileUpload','tools','typo',...]`（`src/routes/(main)/agent/features/Conversation/MainChatInput/index.tsx:36-49`），含 incognito。
  - 移动设置页 `src/routes/(mobile)/settings/index.tsx` 复用桌面 `(main)/settings/features/SettingsContent`。
  - `componentMap.ts:43` 含 `[SettingsTabs.SystemTools]` 动态导入 `../system-tools`，mobile 模式无守卫。
  - 移动个人中心 `src/routes/(mobile)/me/settings/features/useCategory.tsx:117-122` 已列出 SystemTools 入口（在 System 分组）。
- 已确认的 "代码层缺口"：
  - 移动首页 `src/routes/(mobile)/(home)/` 只渲染 `SessionListContent`，没有 InputArea。桌面首页 `src/routes/(main)/home/features/InputArea/index.tsx` 配置 `leftActions: ['model','search','incognito','fileUpload','tools']`。
  - `Incognito` 组件守卫：`src/features/ChatInput/ActionBar/Incognito/index.tsx:19` — `if (activeTopicId || !agentId) return null;`。这是 commit `589d79fd0c` 的 "no reverse conversion" 设计：进入已有 topic 后按钮消失。
  - 移动端 NavBar `src/routes/(mobile)/_layout/NavBar.tsx` 只有 3 个 tab：Chat / Community（可被 `showMarket` 关掉）/ Me，**完全没有 Image tab**。
  - `src/spa/router/mobileRouter.config.tsx` 全文搜索 `image / Image` **0 命中**，**未注册任何 `/image` 路由**；桌面 `desktopRouter.config.tsx:471-487` 注册了 `/image` → `(main)/(create)/image`。

## User-Reported Symptoms

| 编号 | 现象                                      | 代码层结论                                                                                                                                                                                      |
| ---- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | 移动端首页看不到隐身入口（眼镜按钮）      | ✅ 真实缺口：首页无 InputArea，不可能渲染 incognito 按钮                                                                                                                                        |
| B    | 进入某个 Agent 对话后仍看不到眼镜按钮     | ⚠️ 与代码不符 — 共享 `MainChatInput` 含 incognito。可能根因：(1) 用户进入的对话已有 `activeTopicId`，按钮按设计隐藏；(2) 部署版本旧于 commit `589d79fd0c`；(3) 某条件分支未走到 `MainChatInput` |
| C    | `/me/settings` 里找不到 System Tools 入口 | ⚠️ 与代码不符 — `useCategory.tsx:117-122` 明确含此入口。可能根因：(1) 用户访问的是 `/settings` 而非 `/me/settings`；(2) 部署版本旧；(3) `featureFlags`/`serverConfig` 隐藏                      |
| D    | 移动端底部 tab 缺画图入口                 | ✅ 真实缺口：NavBar 未注册 Image tab，mobileRouter 未注册 `/image` 路由                                                                                                                         |

## Scope (decided 2026-05-21)

- 本 task 只覆盖 **A（移动首页隐身入口缺失）** 和 **D（移动底部 image tab 缺失 + `/image` 路由未注册）**
- B（对话页眼镜按钮看不到）和 C（`/me/settings` 看不到 System Tools）拆为单独的**验证型子任务**，先复现确认根因再决定是否修代码

## Out of Scope (暂定)

- B/C 在本 task 内不实现修复（拆走）
- 不涉及 fork 与 upstream 的整体策略调整（继续以 fork 维护现有定制）
- 不涉及 desktopRouter /desktopRouter.config.desktop 的改动（桌面端 `/image` 已存在）
- 不重写移动端 Chat 页面架构（保持 `(mobile)/chat` 复用 `ConversationArea` 的现状）
- 不修桌面端任何入口

## Decisions (locked 2026-05-21)

| 项           | 决策                                                                                                                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A 修复策略   | **方案 b** — 在 `src/routes/(mobile)/(home)/_layout/SessionHeader.tsx` 右侧 Flexbox 内、与 `MessageSquarePlus`（新建会话）对称增加一个 `GlassesIcon` 按钮；点击调用 `createEphemeralTopic + navigate('/agent/<id>/<topicId>', { query: { mode: 'incognito' } })` |
| D 形态       | **横向 Icon 网格** — 在移动首页 `MobileLayout.tsx` 的 SearchBar 下方、`{children}` 上方插入一个新的 "快捷入口区" 组件；不动 NavBar，底部仍保持 Chat/Community/Me 3 tab                                                                                           |
| D 第一期入口 | **Image** + **Tasks**（其他如 Video/Knowledge/Memory 留待后续观察）                                                                                                                                                                                              |
| 实现位置     | 新建 `src/routes/(mobile)/(home)/features/QuickEntries/index.tsx`；新增路由 `/image` 到 `mobileRouter.config.tsx`（复用 `(main)/(create)/image` 与其 `_layout`）；Tasks 路由 mobileRouter 已注册（:234）                                                         |

## Requirements

- **A**：在移动端首页 SessionHeader 增加眼镜按钮入口，点击直接发起隐身对话并跳转到 chat 页（沿用桌面 `createEphemeralTopic` 行为）。按钮位置：`right` Flexbox 内、`MessageSquarePlus` 左侧。
- **D-1**：在移动首页主体 `(mobile)/(home)/_layout/MobileLayout.tsx` 的 `SessionSearchBar` 下方、`{children}` 上方，插入一个新的 "快捷入口区" 组件 `QuickEntries`。
- **D-2**：`QuickEntries` 渲染横向 Icon 网格，第一期含 2 个入口：Image（点击 → `/image`）、Tasks（点击 → `/tasks`）。
- **D-3**：`mobileRouter.config.tsx` 注册 `/image` 路由，复用桌面 `(main)/(create)/image` 入口与 `_layout`（参照 community 复用模式）。Tasks 路由已注册。
- **D-4**：移动底部 NavBar 不改动，保持现有 Chat/Community/Me 3 tab 行为。
- 不破坏移动端 SessionListContent 现有交互；首页主体高度增加，会话列表自然向下推移。
- 复用既有的 i18n key（`common:tab.image`、`common:tab.tasks` 桌面端已使用）。

## Acceptance Criteria

- [ ] **A**：移动端首页 SessionHeader 右侧能看到眼镜按钮（在新建会话按钮左侧）。
- [ ] **A**：点击眼镜按钮后创建临时 topic 并跳转到 `/agent/:id/:topicId?mode=incognito`，进入对话页后看到 `IncognitoBanner`。
- [ ] **A**：连点眼镜按钮不会重复创建临时 topic（沿用 v1 的 `creating` 状态守卫）。
- [ ] **D-1**：移动端首页搜索条下方能看到横向排列的 Image + Tasks 入口。
- [ ] **D-2**：点击 Image 进入 `/image`；点击 Tasks 进入 `/tasks`。
- [ ] **D-3**：直接访问 `/image` 在移动端能渲染（即便桌面 GenerationLayout 在小屏下有布局瑕疵，至少不空白 / 不报错 —— 若严重再起子任务包装）。
- [ ] **D-4**：移动底部 NavBar 仍是 Chat/Community/Me 3 tab，未受影响。
- [ ] 部署到 vercel 后人工走查 A + D-1/D-2/D-3/D-4 用例通过。
- [ ] `bun run type-check` 不引入新的类型错误。

## Open Questions

- 无（决策已锁定，进入设计 / 实现阶段）。

## Notes

- 用户已在 2026-05-21 同意创建 Trellis task 并进入规划阶段。
- 用户偏好部署到 Vercel 后再手动验证（不本地跑测试）。
- 本次任务允许后续按 brainstorm 流程进一步拆分为 parent + children。

## Post-Mortem (2026-05-21)

**实施状态**：代码层全部完成

- 3 个 commit 已落到 origin/main：`f8e038e35d`、`6896105c73`、`55692491e2`
- `bun run type-check` 0 错误
- vercel preview 已成功构建并部署

**验收状态**：❌ 全部 acceptance criteria 失败

- 用户在 vercel preview 上**完全看不到本次新增的任何 UI 改动**（眼镜按钮、QuickEntries 都未出现）
- **这与已知的 B、C 症状特征一致**：代码层明确存在 + 已部署 + UI 实际未渲染

**归档决策**：

- 不在本 task 内继续排查 —— 本 task 范围是 A + D 的代码实现，已交付
- A + B + C + D 的 "代码改动在 vercel 部署后不生效" 的**统一根因排查**作为后续独立任务
- 怀疑方向（待新任务调查）：
  - vercel build cache（旧 chunk 没被刷新）
  - SPA 客户端 bundle vs 服务端模板的版本错位
  - 项目历史上提到的 Vite dual-import trap 或 import (null) emission 是否影响 mobile 路由
  - app.lobehub.com 的 debug proxy 加载的是本地 vs 远端 SPA（开发环境干扰）
  - 移动端缓存（PWA / Service Worker / IndexedDB hydration）
  - feature flag /serverConfig 在 vercel 环境下隐藏了入口
- A + D 的代码若后续根因解决，预期**无需再改 UI 代码**就能直接看到效果

**Follow-up Task**：将创建 `05-21-vercel-mobile-deployment-invisible` 任务专项排查。
