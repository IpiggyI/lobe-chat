# fix-spa-trpc-vite8-preload-null-specifier

## Goal

修复 Vercel 生产部署 `lb.365432.xyz` 登录后 SPA 全站永久 loading 的 bug。根因是 Vite 8 + fork 自定义 `manualChunks` 在生成 chunk 时，将 `null` 作为字符串写入了 preload 依赖数组。每次 TRPC 请求都在 `headers()` 回调里通过 `preload-helper` 触发 dynamic import 预加载，被 `null` specifier 卡死，request 不出门，UI 永远 loading。

让登录后的 sidebar、模型选择器、消息历史、settings 页面恢复正常数据加载，且不重新触发 Vercel build OOM。

## Confirmed Facts

### 症状链

1. 用户登录成功，session 完整有效（已验证 `/api/auth/get-session` 返回正常 user/session 结构）。
2. 登录后 14 小时内 Vercel 函数日志显示 **零条** `/trpc/lambda/*` 请求，只有 `/api/auth/get-session` 在每 5 分钟轮询。
3. 浏览器 Console 报错（刷屏出现）：
   ```
   TRPCClientError: Failed to resolve module specifier 'null'
     at e.from (client-Cl3R4Y5V.js:1:11354)
   Caused by: TypeError: Failed to resolve module specifier 'null'
     at preload-helper-WOtYFlRq.js:1:1274
     at async Object.headers (client-Cl3R4Y5V.js:1:98776)
   ```
4. 网络面板看似 200，是因为 TRPC 请求根本没发出，能看到的 200 全是 `get-session` 轮询和静态资源。
5. 手动 `fetch('/trpc/lambda/user.getUserState?...')` 在 Console 里能正常发出（fetch 本身没问题），证明 client 端的 TRPC wrapper 在 `headers` 阶段就 throw 了，根本走不到 fetch。

### 触发条件（fork 特有）

| 来源 | 改动 | 单独是否引发 bug |
|---|---|---|
| 上游 `31d76ccb90` | Vite 升级到 8.0.0 | 否 — 上游同款配置可工作 |
| Fork `cace529ccf` | `clientModelRuntime.ts` 改成 `await import('@lobechat/model-runtime')` 动态导入 | 否 — Vite 7 时也工作过 |
| Fork+上游叠加 | 上述两者同时存在 + `createSharedRolldownOutput` 中 `name: (id) => sharedManualChunks(id) ?? null` | **是** |

### 关键代码定位

- 触发点（TRPC headers callback 内的多个 dynamic import）：
  - `src/libs/trpc/client/lambda.ts:115-135`（`@/services/_auth`、`@/store/image`、`@/store/image/slices/generationConfig/selectors`）
- 配置点（chunk 命名返回 null）：
  - `plugins/vite/sharedRendererConfig.ts:118-128`（`createSharedRolldownOutput`）
  - `plugins/vite/sharedRendererConfig.ts:60-100`（`sharedManualChunks` 未匹配时返回 undefined → `?? null`）
- 引入触发的 fork 改动：
  - `src/services/chat/mecha/clientModelRuntime.ts:18-25`（`await import('@lobechat/model-runtime')`）
- 当前生产部署：`dpl_CKThUSsXaYBfpFSRbp2L32GHWFtr`（commit `0df5dcae0991`）

### 修复成本

- 不能简单回退 `cace529ccf`（OOM 会重现，[[project_vercel_oom_status]] 已记录）。
- 不能简单升级或回退 Vite（属于上游同步带入，回退会丢 v2.1.58 的 567 个其他 commit）。

## Requirements

1. SPA 登录后 sidebar / 模型选择器 / 消息历史 / settings 全部能正常加载数据。
2. Vercel 部署 build 不重新出现 OOM（heap 仍维持 8192 上限可工作）。
3. 浏览器 Console 不再出现 `Failed to resolve module specifier 'null'` 报错。
4. Vercel 函数日志在登录后能正常看到 TRPC 请求被调用。

## Out of Scope（本次不处理）

- OIDC `/api/auth/callback/auth0` 的 302 error 级别日志（独立 issue，且不影响最终 session 建立）。
- 4 个 pending DB migrations（agent_operations / messenger / briefs / topic_status）— 当前不阻塞 TRPC 请求触发，前端连 SQL 都还没问到。
- TRPC `headers` 回调里 3 个 dynamic import 本身的重构（`@/services/_auth`、`@/store/image` 等）— 维持现状。
- 上游 React/Vite 等版本调整。

## Acceptance Criteria

- [x] Vercel 生产部署登录后 60 秒内能看到 `/trpc/lambda/*` 请求被发起且 200 返回。
- [x] 浏览器 Console 中不再出现任何 `Failed to resolve module specifier 'null'` 报错。
- [x] SPA UI（sidebar、模型选择器、消息历史、settings 页面 AI 服务商）能渲染出真实数据。
- [x] Vercel build 流水线在不调高 `--max-old-space-size=8192` 的前提下完成 build（`dpl_3G2nv6C5ZMi54v5MwBYaZYz6djfC` 成功 READY）。
- [x] 修改后的 chunk 拆分策略文档化在 `.trellis/spec/guides/spa-build-pitfalls.md`。

## Final Root Cause (修正诊断)

**最初诊断（A+B）：** model-runtime 没有命名 chunk + `?? null` → 推 commit `53815c044f`，但仍报错。

**实际诊断（C）：** 抓了产线 `client-BwgyEqqx.js` chunk 后发现编译产物是 `await import(null)`（JS 字面 null），而非字符串 `"null"`。同一个 headers callback 里的其他 dynamic import（`@/store/image` 等）都正常拿到 chunk URL。差别在于 **`_auth.ts` 同时被 4 处静态 import + 2 处动态 import**：

```
静态：src/services/models.ts、chat/index.ts、chat/mecha/clientModelRuntime.ts
动态：src/libs/trpc/client/{lambda,tools}.ts （为打破 trpc → aiInfra → aiProvider → trpc 循环依赖）
```

Rolldown 看到 `_auth.ts` 已被静态加载到父 chunk，就在动态 import 处 emit 了 `import(null)` —— **缺一个独立 chunk URL 可指**。

## Final Fix

提交 `f092929e17`：在 `sharedManualChunks` 增加规则强制把 `_auth.ts` 拆到独立 `services-auth` chunk。
另外 `53815c044f` 的 A+B 改动作为防御层保留，并不冲突也不撤销。

## Deployments

| Deployment | Commit | State | 结果 |
|---|---|---|---|
| `dpl_EMhcxm5oWuBLRLZo1rfW6i7YnC2R` | `53815c044f` (A+B) | READY | 仍报错 — 排除了 model-runtime / `?? null` 假设 |
| `dpl_3G2nv6C5ZMi54v5MwBYaZYz6djfC` | `f092929e17` (C) | READY | **修复成功 ✅** |

## Decisions

### 修复路径：A + B 双保险

**A — `sharedManualChunks` 显式命名 model-runtime chunk**
- 文件：`plugins/vite/sharedRendererConfig.ts:60-100`
- 改动：在 `sharedManualChunks` 函数内增加 `if (id.includes('@lobechat/model-runtime') || id.match(/packages\/model-runtime\//)) return 'vendor-model-runtime';`，位置放在 model-bank 规则附近（同样是 fork dynamic-import 关联的 monorepo 包）。
- 意图：当 `clientModelRuntime.ts` 触发 `await import('@lobechat/model-runtime')` 时，Rolldown 拿到的 chunk 名称是确定字符串 `vendor-model-runtime`，绝不会落到 `?? null` 的兜底分支。

**B — `createSharedRolldownOutput` 中 `?? null` 改为 `?? undefined`**
- 文件：`plugins/vite/sharedRendererConfig.ts:118-128`
- 改动：第 124 行 `name: (moduleId: string) => sharedManualChunks(moduleId) ?? null,` → `name: (moduleId: string) => sharedManualChunks(moduleId) ?? undefined,`
- 意图：Rolldown 的 `codeSplitting.groups[].name` 回调返回 `undefined` 是 JS 函数"无返回"的天然语义，理论上比 `null` 更明确地表达"没有 group"。避免 chunk metadata 把字符串 `"null"` 写入 preload 依赖列表。

### Spec 长期留档

- 路径：`.trellis/spec/guides/spa-build-pitfalls.md`
- 触发场景：fork 添加 dynamic import / 上游升级 Vite / 调整 manualChunks 时。
- 核心规则：任何 fork-specific 的 `await import('@xxx/...')` 必须同步在 `sharedManualChunks` 中加显式 chunk 命名，避免 Rolldown 的 `?? null` 兜底导致 preload 依赖错乱。

## Open Questions

无 — 全部决策已落盘。
