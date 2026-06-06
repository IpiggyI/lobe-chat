# 排查 vercel 部署后代码改动在移动端不显示的根因

## Goal

排查"fork 在 vercel 上部署完成、代码层确认存在某个 UI 入口，但用户在移动端实际访问时看不到该入口"的根因。修复一次性根因后，预期**之前的 A/B/C/D 都自动恢复**——不再分别打补丁。

## 已知症状汇总（截至 2026-05-21）

| 编号 | 症状 | 代码层结论 | vercel 上的实际表现 |
|------|------|-----------|---------------------|
| A | 移动端首页无隐身入口 | 已实现（commit `f8e038e35d`） | ❌ 不显示 |
| B | 进入 Agent 对话后无眼镜按钮 | 共享 MainChatInput.leftActions 包含 incognito（v2.1.58 + commit `589d79fd0c`） | ❌ 不显示 |
| C | /me/settings 无 System Tools 入口 | `useCategory.tsx:117-122` 已列出 SystemTools 入口 | ❌ 不显示 |
| D | 移动端首页无 image/tasks 入口 | 已实现（commit `6896105c73` + `55692491e2`） | ❌ 不显示 |

**强相关特征**：全部失败的入口都在移动端，且至少 B、C 在代码上明确存在却看不到——指向**部署层 / 环境层 / 缓存层**问题而非代码逻辑问题。

## 候选根因（待验证 / 排除）

按优先级排序：

1. **vercel build cache 未失效**
   - 现象：构建成功但 chunk hash 没变，CDN 返回旧 SPA bundle
   - 验证方式：vercel dashboard 查看本次部署的 build log / chunk 哈希；强制清除 cache 重新部署对比

2. **客户端缓存（浏览器 / PWA / Service Worker）**
   - 现象：vercel 已发新 bundle，但移动端浏览器仍加载旧版
   - 验证方式：硬刷新 + 清 cache；查看 Network 面板 SPA bundle 的 hash 是否与本次构建一致；DevTools Application 标签看 Service Worker / Cache Storage

3. **SPA bundle 没把移动路由打进去**
   - 现象：本次改动在 `(mobile)/(home)/_layout/MobileLayout.tsx` 等文件，可能因为 Vite manualChunks / SPA 入口配置未把 mobile 路由打进当前用户访问到的 bundle
   - 验证方式：本地 `bun run build` 后看 dist 产物里 mobile chunk 是否包含新代码；对比 vercel preview 实际加载的 chunk
   - 历史：项目曾遇到 Vite dual-import trap（commit `f092929e17`），相关警觉点

4. **debug proxy 误导**
   - 现象：AGENTS.md 提到 `app.lobehub.com/_dangerous_local_dev_proxy?debug-host=localhost:9876` 这种 dev-proxy 模式
   - 验证方式：确认用户实际访问的是 vercel preview URL 而不是 production app.lobehub.com 或 debug proxy

5. **服务端模板 vs 客户端 SPA 版本错位**
   - 现象：Next.js `(backend)` 的 SPA 模板路径返回的 HTML 引用了旧的 entry chunk
   - 验证方式：curl vercel preview 的 HTML，看 `<script>` 引用的入口文件哈希与本次构建是否一致

6. **feature flag / serverConfig 隐藏入口**
   - 现象：fork 默认部署的 serverConfig 关闭了某些入口（例如 `showMarket=false` 类似机制隐藏 SystemTools 或 Incognito）
   - 验证方式：localStorage / Network 面板看 serverConfig API 返回，对比代码中 `featureFlagsSelectors` 的判断

7. **environment difference (preview vs production)**
   - 现象：vercel preview 上是 OK 的，但用户访问的是 production；或反之
   - 验证方式：明确用户在哪个环境复现的、production 部署版本是哪个 commit

## Investigation Plan（高层）

1. **复现 + 抓证据**：让用户/我自己访问 vercel preview，截图 + DevTools Network 面板录制
2. **二分法定位**：从候选根因 1 → 7 依次排除
3. **找到根因 + 修复**
4. **回归验证**：A/B/C/D 全部自动恢复，无需再改 UI

## Out of Scope

- 不在本任务内再改 A/D 的 UI 代码（已落地，等待根因修复后自动生效）
- 不在本任务内做 B/C 的代码修复（依赖根因结果）
- 不做桌面端排查（症状在移动端）

## Acceptance Criteria

- [ ] 明确根因（一句话 + 证据链接）
- [ ] 给出"复发预防"机制（spec / hooks / 文档）以便后续避免同样问题
- [ ] A/B/C/D 在 vercel preview 上均可见、可点击、行为正确
- [ ] 把排查结论写入 spec（如根因是 fork 特有配置）或 fork 维护文档

## Notes

- 用户在 2026-05-21 vercel 验证 mobile-customization-gaps 任务时发现 UI 不显示，主动提出"和 BC 同特征，先归档再统一排查"
- 关联任务：`.trellis/tasks/05-21-mobile-customization-gaps/`（已 archive）
- 相关历史：commit `f092929e17`（Vite dual-import trap）、`589d79fd0c`（incognito 桌面迁移）、Memory `project_vite_dual_import_trap.md`
