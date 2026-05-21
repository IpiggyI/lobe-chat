# 实现 — 修复移动端定制功能入口缺失（A + D）

## 执行清单（按顺序）

### Step 1 — A：SessionHeader 加眼镜按钮

**文件**：`src/routes/(mobile)/(home)/_layout/SessionHeader.tsx`

**步骤**：

1. 导入新依赖：
   - `GlassesIcon` from `lucide-react`
   - `useState`, `useCallback` from `react`
   - `useChatStore` from `@/store/chat`
   - `useAgentStore` from `@/store/agent`
   - `builtinAgentSelectors` from `@/store/agent/selectors/builtinAgentSelectors`
   - `useSessionStore` from `@/store/session` （或继续用 chat store 的 activeSessionId /activeAgentId — 优先查现有 hook）
2. 在组件内增：
   - `const [creating, setCreating] = useState(false);`
   - 拿到 `agentId`：fallback 链 `useSessionStore.activeId → builtinAgentSelectors.inboxAgentId`
   - `createEphemeralTopic` 从 `useChatStore`
   - `handleIncognito = useCallback(async () => { ... })`：含 creating 守卫 + try/finally + 失败静默
3. 在 `right` Flexbox 改为同时渲染 `<ActionIcon icon={GlassesIcon}>` 和现有 `<ActionIcon icon={MessageSquarePlus}>`：
   ```tsx
   right={
     <Flexbox horizontal gap={4} align="center">
       <ActionIcon
         disabled={creating}
         icon={GlassesIcon}
         loading={creating}
         size={MOBILE_HEADER_ICON_SIZE}
         title={t('incognito.toggle.title', { ns: 'chat' })}
         onClick={handleIncognito}
       />
       <ActionIcon ... onClick={() => createSession()} />
     </Flexbox>
   }
   ```
4. i18n：复用 `chat:incognito.toggle.title`（已存在）。若 `useTranslation` 当前只引了 common，要扩成 `useTranslation(['common', 'chat'])`。

**验证**：

- `bun run type-check`
- vercel preview：移动首页 SessionHeader 看到眼镜按钮 + 新建按钮并列；点击眼镜按钮跳转到 `/agent/<id>/<topicId>?mode=incognito`，对话页顶部出现 IncognitoBanner

**风险点**：

- `useSessionStore.activeId` 可能在移动首页未初始化 → 用 `inboxAgentId` 兜底
- `inboxAgentId` 在 hydrate 完成前是 undefined → 此时按钮 click 早 return，UI 上短暂无响应可接受（hydrate 通常 <1s）

---

### Step 2 — D：新建 QuickEntries 组件

**文件**：`src/routes/(mobile)/(home)/features/QuickEntries/index.tsx`（新建）

**步骤**：

1. 创建 features 目录（参照 `(mobile)/(home)/features/SessionListContent` 已有结构）。
2. 组件结构：
   - `'use client';`
   - 用 `createStaticStyles` 写样式（项目约定，零运行时）
   - 内部固定 entries 数组：`[{ key: 'image', icon: PaletteIcon, path: '/image' }, { key: 'tasks', icon: CheckSquareIcon, path: '/tasks' }]`
   - 每项渲染一个圆形 icon + label，使用 `Flexbox align="center" gap={4}`
   - 整体外层 `Flexbox horizontal` + `paddingBlock` + `paddingInline`，初始版本不滚动（2 项装得下）
3. 图标选择（lucide-react 已用）：
   - Image: `Palette` 或 `ImageIcon`（建议 `Palette` 与桌面 `tab.image` 文案 i18n 不冲突）
   - Tasks: `ListTodo` 或 `CheckSquare`（建议 `ListTodo`）
4. 国际化：`useTranslation('common')`，文案用 `t('tab.image')` / `t('tab.tasks')`（桌面端已有）。
5. 点击行为：`const navigate = useNavigate(); onClick={() => navigate(item.path)}`

**导出**：`export default QuickEntries;`

**验证**：

- `bun run type-check`
- 引用方式正确：可作为 default export 在 MobileLayout 中导入

---

### Step 3 — D：MobileLayout 插入 QuickEntries

**文件**：`src/routes/(mobile)/(home)/_layout/MobileLayout.tsx`

**步骤**：

1. 导入：`import QuickEntries from '@/routes/(mobile)/(home)/features/QuickEntries';`
2. 在 `<div className={styles.searchBarContainer}>…</div>` 之后、`{children}` 之前插入 `<QuickEntries />`

**验证**：

- `bun run type-check`
- vercel preview：移动首页搜索条下方能看到 Image + Tasks 两个圆形 icon + 文字；点击各自跳到 `/image` / `/tasks`

---

### Step 4 — D：mobileRouter 注册 /image 路由

**文件**：`src/spa/router/mobileRouter.config.tsx`

**步骤**：

1. 在 `// Settings routes` 块（约 :179）之前或之后，新增一个 `// Image routes` 块：
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
2. 注意：这是 RouteObject 数组的元素，需要在正确的位置插入（main layout children 内）。

**验证**：

- `bun run type-check`
- vercel preview：
  - 在 QuickEntries 点击 Image → 进入 `/image` 不报错
  - 直接访问 `https://<preview>/image` 能渲染
  - **若布局严重错乱**（如双 sidebar、横向溢出），记录现象但**不在本任务修**—— 拆子任务 `mobile-image-layout-adapt`

---

### Step 5 — 联调验证

按 PRD Acceptance Criteria 清单走查：

- [ ] A：眼镜按钮可见 + 可点击 + 跳转 incognito + IncognitoBanner 显示
- [ ] A：双击不重复创建（连点观察 network 只发一次 createTopic）
- [ ] D-1：QuickEntries 渲染
- [ ] D-2：Image / Tasks 点击跳转
- [ ] D-3：`/image` 路由可达（即便布局有瑕疵）
- [ ] D-4：底部 NavBar 仍是 3 tab
- [ ] type-check 通过

---

## 验证命令

```bash
# 类型检查（必跑）
bun run type-check

# 不跑测试（用户偏好 vercel 验证 mobile UI）
```

部署：

```bash
git add -p # 分别 stage A 和 D 的改动；建议拆 2 个 commit
git commit -m "✨ feat: add incognito entry to mobile home session header"
git commit -m "✨ feat: add image/tasks quick entries to mobile home"
git push origin canary
# 等 vercel preview 生成，开移动端模拟器或真机走查
```

## 拆 commit 建议

| Commit   | 范围                                     | 文件                                                                                                                 |
| -------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| commit 1 | A：眼镜按钮                              | `src/routes/(mobile)/(home)/_layout/SessionHeader.tsx`                                                               |
| commit 2 | D：QuickEntries 组件 + MobileLayout 插入 | `src/routes/(mobile)/(home)/features/QuickEntries/index.tsx` + `src/routes/(mobile)/(home)/_layout/MobileLayout.tsx` |
| commit 3 | D：mobileRouter `/image` 注册            | `src/spa/router/mobileRouter.config.tsx`                                                                             |

理由：A 和 D 是独立可交付，单点 revert 简单。D 内部 QuickEntries 和 router 也可分。

## 风险点 / Rollback 触发

| 触发条件                                                         | 回滚动作                                                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `bun run type-check` 引入新错误                                  | 立刻定位错误来源；修复或回滚对应 commit                                                         |
| vercel preview `/image` 完全空白或 JS 报错                       | 仅回滚 commit 3 + Step 4，保留 A 和 D-1/D-2；起子任务包装 mobile-friendly Image 页              |
| QuickEntries 视觉破首页布局（与 SessionListContent 重叠 / 拥挤） | 回滚 commit 2 中的 MobileLayout.tsx 一行；保留 QuickEntries 组件待样式调整                      |
| 眼镜按钮点击无反应（inboxAgentId 还没 hydrate）                  | 在 SessionHeader 中加 `disabled={!agentId}` 临时方案；后续 follow-up 任务用 hydration 等待 hook |

## 不在本次实现的（拆子任务）

- B：进入 agent 对话仍看不到眼镜按钮 → 单独子任务先复现确认根因
- C：/me/settings 看不到 System Tools → 单独子任务先复现确认根因
- 桌面端 `(main)/(create)/image` 在移动端的 layout 适配（如确认有问题）
