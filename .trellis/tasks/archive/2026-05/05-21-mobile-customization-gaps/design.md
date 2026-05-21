# 设计 — 修复移动端定制功能入口缺失（A + D）

## 范围回顾

| 子项 | 缺口                       | 修复方案                                                     |
| ---- | -------------------------- | ------------------------------------------------------------ |
| A    | 移动首页无隐身入口         | SessionHeader 右侧加 `GlassesIcon`                           |
| D-1  | 首页无非主流量功能入口     | SearchBar 下方加横向 Icon 网格 `QuickEntries`                |
| D-2  | 移动端 `/image` 路由未注册 | mobileRouter 注册 `/image`，复用桌面 `(main)/(create)/image` |

## 架构与边界

### 受影响层

| 层                 | 文件                                                         | 改动类型                     |
| ------------------ | ------------------------------------------------------------ | ---------------------------- |
| 移动首页 layout    | `src/routes/(mobile)/(home)/_layout/SessionHeader.tsx`       | 修改 — 加按钮                |
| 移动首页 layout    | `src/routes/(mobile)/(home)/_layout/MobileLayout.tsx`        | 修改 — 插入 QuickEntries     |
| 移动首页特性       | `src/routes/(mobile)/(home)/features/QuickEntries/index.tsx` | 新增 — 入口网格组件          |
| 路由配置           | `src/spa/router/mobileRouter.config.tsx`                     | 修改 — 注册 `/image`         |
| Store / 业务逻辑   | `src/store/chat`（`createEphemeralTopic`）                   | 不改 — 直接复用              |
| ChatInput 共享组件 | `src/features/ChatInput/ActionBar/Incognito/index.tsx`       | 不改 — 仅作为行为参考        |
| 桌面端             | 任何 `(main)/*` 文件                                         | **不改**（确保不影响桌面端） |

### 数据流

#### A：隐身入口

```
[user 点 GlassesIcon]
  → SessionHeader handleIncognitoClick
    → useChatStore.createEphemeralTopic(agentId? || INBOX_AGENT_ID)
      → 返回 newTopicId
    → useNavigate() push '/agent/<agentId>/<newTopicId>?mode=incognito'
  → 进入 (mobile)/chat/_layout
    → ConversationArea + MainChatInput
    → IncognitoBanner 检测 mode=incognito 自动显示
```

需要的 store /hook：

- `useChatStore((s) => s.createEphemeralTopic)` — 已存在
- `useSessionStore((s) => s.activeId)` — 可作为当前 agentId 来源（fallback 到 inbox）
- `useAgentStore`：sessionId 可能与 agentId 同义；要避开 "home 页 activeAgentId 未同步到 AgentStore" 的 v1 latent bug（commit 589d79fd0c 已修 `createEphemeralTopic`，会从入参 sessionId 兜底）
- `useNavigate` + `useQueryRoute`：模仿 `src/features/ChatInput/ActionBar/Incognito/index.tsx` 的实现

**关键：与 ChatInput Incognito 组件不同的是**，这里没有 `activeTopicId` 守卫（首页不存在活跃话题概念），但要保留：

- `creating` state 防止双击重复创建
- 失败时 toast / 静默（参照原组件，原组件无 toast，仅 try/finally 重置 state）

#### D：QuickEntries

```
[QuickEntries 组件渲染]
  → 内部固定数据：[{ key: 'image', icon, label, path: '/image' }, { key: 'tasks', ... }]
  → useNavigate
  → 点击 → navigate(item.path)
```

无状态，无 store 订阅，零 SSR/CSR 差异点。i18n 复用 `common:tab.image` / `common:tab.tasks`。

#### D：`/image` 路由

```
mobileRouter.config.tsx
  └─ 在 main layout children 内新增 path:'image' block
       ├─ index → dynamicElement(() => import('@/routes/(main)/(create)/image'), 'Mobile > Image')
       └─ element → dynamicLayout(() => import('@/routes/(main)/(create)/image/_layout'), 'Mobile > Image > Layout')
```

这是和现有 community 复用模式一致的写法。**不需要给 mobileRouter 加新组件**，只是路由注册。

### 与已有 Incognito 入口的关系

| 入口                                           | 位置                             | 守卫                                                                    |
| ---------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| 共享 ChatInput Incognito（commit 589d79fd0c）  | ChatInput 工具区（agent 对话页） | `if (activeTopicId \|\| !agentId) return null;` — 进入已有 topic 后隐藏 |
| 新增移动首页 SessionHeader Incognito（本任务） | 移动首页 SessionHeader 右侧      | 无 `activeTopicId` 守卫，但要保留 `creating` 双击守卫                   |

两者不冲突 —— 首页入口和对话页入口面向不同场景：

- 首页入口：用户**想从零开始**一段隐身对话（之前侧栏 GlassesIcon 的功能位）
- 对话页入口：用户在某个 agent 下**新开一段**隐身对话（不影响当前话题）

## 契约

### `SessionHeader` 改动后接口

签名不变（仍是 memo 默认 export 的组件）。内部加入：

```tsx
const handleIncognito = useCallback(async () => {
  if (creating) return;
  setCreating(true);
  try {
    const agentId = sessionId ?? inboxAgentId;
    if (!agentId) return;
    const newTopicId = await createEphemeralTopic(agentId);
    if (newTopicId) {
      navigate(`/agent/${agentId}/${newTopicId}?mode=incognito`);
    }
  } finally {
    setCreating(false);
  }
}, [creating, sessionId, inboxAgentId, createEphemeralTopic, navigate]);
```

注意：用 `useNavigate`（react-router）即可；`useQueryRoute` 是 next-style，移动首页不一定有等效；走拼接字符串更直观。

### `QuickEntries` 组件接口

```tsx
const QuickEntries = memo(() => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const entries = useMemo<QuickEntryItem[]>(() => [
    { key: 'image', icon: PaletteIcon, label: t('tab.image'), path: '/image' },
    { key: 'tasks', icon: CheckSquareIcon, label: t('tab.tasks'), path: '/tasks' },
  ], [t]);

  return (
    <Flexbox horizontal gap={…} paddingBlock={…} paddingInline={…}>
      {entries.map(e => (
        <Flexbox key={e.key} align="center" gap={4} onClick={() => navigate(e.path)}>
          <CircleIcon icon={e.icon} />
          <Text>{e.label}</Text>
        </Flexbox>
      ))}
    </Flexbox>
  );
});
```

样式用 `createStaticStyles` + `cssVar`（项目约定）。

### `MobileLayout` 改动

```tsx
return (
  <MobileContentLayout withNav header={<SessionHeader />}>
    <div className={styles.searchBarContainer}>
      <SessionSearchBar mobile />
    </div>
    <QuickEntries /> {/* ← 新增 */}
    {children}
  </MobileContentLayout>
);
```

### mobileRouter 改动

在 `Settings routes` 块（:179）之前或之后插入：

```tsx
// Image routes
{
  children: [
    {
      element: dynamicElement(
        () => import('@/routes/(main)/(create)/image'),
        'Mobile > Image',
      ),
      index: true,
    },
  ],
  element: dynamicLayout(
    () => import('@/routes/(main)/(create)/image/_layout'),
    'Mobile > Image > Layout',
  ),
  errorElement: <ErrorBoundary />,
  path: 'image',
},
```

## 兼容性 / 风险

| 风险                                                                                                                       | 影响                     | 缓解                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(main)/(create)/image/_layout/GenerationLayout` 是桌面端 sidebar+content 布局，在移动端可能横向溢出 / 双 sidebar 同时显示 | 移动端 `/image` 渲染异常 | 第一版先直接复用，部署后人工验证；若严重，开子任务 `mobile-image-layout-adapt` 包装一个 mobile-friendly layout                                                      |
| `createEphemeralTopic` 在 inboxAgentId 未 hydrate 时返回 undefined                                                         | 首页眼镜按钮点击无反应   | 沿用 v1 兜底 — sessionId 兜到 inboxAgentId，若仍 undefined 早 return（按钮 disabled /loading 视觉反馈）。后续若发现 hydrate 时序问题，再加 `useInboxAgent` 等待逻辑 |
| QuickEntries 占首页高度，会话列表初见区域变小                                                                              | UX 微调                  | 控件总高 ≤ 80px，icon 圆角 + label 紧凑布局；后续允许用户在 settings 中隐藏                                                                                         |
| 桌面端 vs 移动端的 `tab.image` / `tab.tasks` i18n key                                                                      | 误用导致文案不一致       | 复用 `common.json` 既有 key（桌面端已用）                                                                                                                           |
| 移动端 NavBar 高亮状态 `useActiveTabKey` 看到 `/image` 时找不到对应 SidebarTabKey，可能选中态错乱                          | 视觉小问题               | 不在 mobile NavBar 暴露 image tab，但 `useActiveTabKey` 仍可能基于路径推算；检查实现：若它返回 undefined 则无 tab 高亮（可接受）                                    |

## 不在本任务的相关项（待后续观察）

- B：进入 agent 对话后看不到 ChatInput 工具区眼镜按钮 → 拆为独立验证型子任务（要先确认 vercel 部署版本 vs commit `589d79fd0c`、复现路径是新对话还是已有 topic）
- C：/me/settings 看不到 System Tools 入口 → 拆为独立验证型子任务（要先确认用户访问的是 `/me/settings` 还是 `/settings`、vercel 部署版本）
- 其他桌面 tab（Video / Knowledge / Memory / Pages）的移动端入口 → 下一期视用户实际需要再加进 QuickEntries

## 回滚

- A 单点改动可独立 revert（仅一个文件，一处 hunk）
- D 中 QuickEntries 组件可独立 revert（删除新文件 + 撤 MobileLayout 一行）
- D 中 `/image` 路由注册可独立 revert（mobileRouter.config.tsx 撤一个 block）

每个子项失败不影响另一个。

## 验证策略

按用户偏好（vercel 部署后人工走查）：

1. 本地 `bun run type-check` — 必须不引入新错误
2. push canary，等待 vercel preview
3. 用真机或 chrome devtools mobile mode 走 PRD 中的 Acceptance Criteria 清单
4. 任意一项失败 → 回到 design /implement 阶段重做

不做单元测试（用户 feedback：mobile UI 改动以人工验证为主）。
