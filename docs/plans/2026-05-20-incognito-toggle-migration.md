# 隐身模式入口迁移：从侧边栏到聊天输入框工具区

**创建日期**: 2026-05-20
**状态**: 设计已确认 → 实施中
**负责人**: 椰椰（IpiggyI）
**关联背景**: [2026-05-19 隐身对话设计](./2026-05-19-incognito-chat-design.md) 的 v1.1 优化

---

## 1. 用户反馈与动机

部署 v1 后用户实际体验发现：
- 当前入口（侧边栏 `GlassesIcon` 按钮）只在已选定 agent 的对话页可见
- **从首页（home）的对话框直接发起对话时，无法选择是否开启隐身**
- 这意味着用户最常见的"试探性提问"场景反而没有隐身入口

## 2. 设计决策（与用户对齐）

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 新开关在「现有 topic」中的行为 | 隐藏开关 | 与原设计 #4「MVP 不支持反向转换」一致，零认知负担 |
| 侧边栏现有按钮处理 | **完全删除** | 避免双入口造成认知负担 |
| 状态持久化 | 不持久化 | 与 ChatGPT/Gemini 行为一致，每次进入默认 off |
| 开关触发的行为 | **立即调用 `createEphemeralTopic` + 跳转** | 复用 v1 全部基础设施，与侧边栏按钮路径终态一致 |

## 3. 技术方案

### 3.1 核心思路

新增 `Incognito` Action 组件加入到 `actionMap` 中。**这不是一个真正的 stateful toggle**，而是一个**"点击即触发新建隐身 topic"的按钮**，UX 上以"开关"形式呈现以匹配同一工具区中其他开关（memory / search）的视觉语言。

### 3.2 关键设计：开关的可见性

```
当前 URL / topic 状态        →  Incognito Action 状态
─────────────────────────────────────────────────────
首页 (no agentId, no topicId)  → 显示，可点击（点击 = 跳到 inbox agent 的新隐身 topic）
Agent 页 + 无 topicId         → 显示，可点击（点击 = 创建隐身 topic 跳转）
Agent 页 + topic.mode='temp'  → 隐藏（已经在隐身中，banner 已表达）
Agent 页 + topic.mode='default' → 隐藏（已是正常 topic，禁用反向转换）
```

**视觉状态**：始终显示为"off"样式（灰色），不需要 active 态——因为它的语义是"启动一次新隐身"。

### 3.3 改动清单（文件级）

| 序 | 文件 | 改动 | 量级 |
|----|------|------|------|
| 1 | **新增**: `src/features/ChatInput/ActionBar/Incognito/index.tsx` | Action 组件：GlassesIcon + 点击触发 createEphemeralTopic + 跳转 | ~40 行 |
| 2 | `src/features/ChatInput/ActionBar/config.ts` | actionMap 注册 `incognito: Incognito` | ~2 行 |
| 3 | `src/routes/(main)/agent/features/Conversation/MainChatInput/index.tsx` | leftActions 加 `'incognito'`（推荐位置：`memory` 后） | ~1 行 |
| 4 | `src/routes/(main)/home/features/InputArea/index.tsx` | leftActions 加 `'incognito'` | ~1 行 |
| 5 | `src/routes/(main)/agent/_layout/Sidebar/Header/Nav.tsx` | 删除 `handleNewIncognitoTopic` + `GlassesIcon NavItem` | ~-12 行 |
| 6 | `src/locales/default/chat.ts` | 新增 `incognito.toggle.title` 等 key，可考虑移除 `incognito.sidebar.*` | ~3 行 |
| 7 | `src/locales/zh-CN/chat.json`、`src/locales/en-US/chat.json` | i18n 翻译同步 | ~6 行 |

**预估总量**：~50-60 行净增（含删除）

### 3.4 Action 组件实现要点

```tsx
// src/features/ChatInput/ActionBar/Incognito/index.tsx
// 关键逻辑伪代码（实施时严格对齐 Search/Memory 模式）：

const Incognito = memo(() => {
  const params = useParams();
  const agentId = params.aid ?? inboxAgentId;
  const topicId = params.topicId;
  const router = useQueryRoute();
  const createEphemeralTopic = useChatStore(s => s.createEphemeralTopic);
  const currentTopic = useChatStore(s => topicSelectors.getTopicById(topicId)(s));

  // 已经在某个 topic 中 → 隐藏（无论 default 还是 temp）
  if (topicId && currentTopic) return null;

  const handleClick = async () => {
    if (!agentId) return;
    const newTopicId = await createEphemeralTopic(agentId);
    if (newTopicId) {
      router.push(urlJoin('/agent', agentId, newTopicId), { query: { mode: 'incognito' } });
    }
  };

  return (
    <Action
      icon={GlassesIcon}
      title={t('incognito.toggle.title')}
      onClick={handleClick}
    />
  );
});
```

### 3.5 边界与陷阱

| 陷阱 | 处理 |
|------|------|
| 首页没有 agentId → 用 `inboxAgentId` | 已有 selector `builtinAgentSelectors.inboxAgentId` |
| Action 在 `disableFollowUpVariant` 场景（Onboarding）不应出现 | leftActions 仅在 home + agent main 加入；Onboarding 的 `chatInputLeftActions` 不加 |
| Mobile 是否也需要 | 本次先做 Desktop；Mobile 的 ChatInput action 若复用 actionMap 会自动包含，需 grep 验证 |
| 删除侧边栏按钮后 `createEphemeralTopic` 仍要保留 | 是的，Action 组件依然依赖它 |
| i18n key `incognito.sidebar.button` 还在用吗 | 删除入口后该 key 无引用 → 可删；为防 PR 复杂度，可暂留待清理 |

## 4. 实施步骤

```
Step 1: 新增 Action 组件
  ├─ 创建 src/features/ChatInput/ActionBar/Incognito/index.tsx
  ├─ 实现可见性逻辑（在已有 topic 时返回 null）
  └─ 实现点击行为（createEphemeralTopic + router.push）

Step 2: 注册到 actionMap
  └─ src/features/ChatInput/ActionBar/config.ts: actionMap.incognito = Incognito

Step 3: 加入 leftActions
  ├─ 首页 InputArea：[..., 'memory', 'incognito', ...]
  └─ Agent MainChatInput：[..., 'memory', 'incognito', ...]
  ※ 位置紧邻 memory，符合用户描述"和记忆工具放一起"

Step 4: 删除侧边栏入口
  └─ Nav.tsx: 删除 handleNewIncognitoTopic + GlassesIcon NavItem

Step 5: i18n
  ├─ 新增 chat.incognito.toggle.title / description
  └─ 同步 zh-CN / en-US 翻译

Step 6: 验证（Vercel 部署测试）
  ├─ 首页 → 点 Incognito Action → 跳转到隐身 topic 并发消息
  ├─ Agent 页（无 topic）→ 点 Action → 跳转
  ├─ 进入正常 topic → Action 消失
  ├─ 进入隐身 topic → Action 消失，banner 出现
  └─ 侧边栏 GlassesIcon 已消失
```

## 5. 验证清单

- [ ] 首页对话框出现 Incognito Action（眼镜图标）
- [ ] Agent 主对话页 Action 与 memory 并列
- [ ] 在正常 topic 中 Action 自动隐藏
- [ ] 在隐身 topic 中 Action 自动隐藏（避免与 banner 重复表达）
- [ ] 点击 Action 后进入隐身 topic，banner 正确显示
- [ ] 侧边栏不再出现 GlassesIcon 按钮
- [ ] `bun run type-check` 通过
- [ ] Vercel preview 部署成功并人工测试

## 6. 不在本任务范围

- Mobile ChatInput 适配（若发现自动继承则免改，否则单独任务）
- 隐身 topic 的"二级折叠区"显示（v1 留下的 TODO）
- pre-commit type-check 治理（独立任务）
