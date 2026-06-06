# Design — fix-spa-trpc-vite8-preload-null-specifier

## Architecture Touch Points

仅触碰 SPA build 配置层 — `plugins/vite/sharedRendererConfig.ts`。无运行时代码改动，无数据模型改动，无 API 变更。

```
SPA build pipeline                      Browser runtime
─────────────────                       ───────────────
vite.config.ts                          client-*.js (bundled)
  └─ createSharedRolldownOutput()           └─ headers() callback
       └─ codeSplitting.groups[0].name           └─ preload-helper.js
            └─ sharedManualChunks(id)                 └─ import("./chunk-name.js")
                 ↑                                          ↑
                 修改点 A：加 model-runtime 命名           当前因 chunk 名落到 "null" 而炸
                 修改点 B：`?? null` → `?? undefined`
```

## 数据流（Build 期）

1. Rolldown 遍历每个模块 ID。
2. 对每个 module，调用 `codeSplitting.groups[0].name(moduleId)`。
3. 返回字符串 → 该 module 归入命名 chunk；返回 `null`/`undefined` → 默认分块策略。
4. **当前 bug**：在 fork 的 `cace529ccf` 之后，`@lobechat/model-runtime` 通过 dynamic import 被引入，但 `sharedManualChunks` 没有匹配它的规则 → 返回 `undefined` → `?? null` → 字符串 `"null"` 经某条 Rolldown 内部路径写入了 chunk 元数据 → preload-helper 拿到字符串 `"null"` 后 `import("null")` 抛错。

## 修改详细

### A. `sharedManualChunks` 增加 model-runtime 规则

**位置**：`plugins/vite/sharedRendererConfig.ts:71` 附近（model-bank 规则下方，保持顺序：先 monorepo 包，再 node_modules guard）。

**改动**：

```ts
// model-bank (monorepo package — split before node_modules guard)
if (id.includes('model-bank')) return 'providerConfig';

// model-runtime (monorepo package — dynamic-imported by fork's clientModelRuntime)
if (id.includes('model-runtime')) return 'vendor-model-runtime';

if (!id.includes('node_modules')) return;
```

**为什么 chunk 名叫 `vendor-model-runtime`**：

- 命中 `sharedChunkFileNames` 的 `name.startsWith('vendor-')` 分支 → 文件落在 `vendor/[name]-[hash].js`，跟其他 vendor 一致（icons / es-toolkit / emotion / motion）。
- 不用 `providerConfig` 那样的 "no-prefix" 名字，因为 model-runtime 实际上是 runtime 库（不是配置），跟 vendor 语义更接近。

### B. `?? null` → `?? undefined`

**位置**：`plugins/vite/sharedRendererConfig.ts:124`。

**改动**：

```ts
export const createSharedRolldownOutput = (options: SharedRolldownOutputOptions = {}) => ({
  chunkFileNames: sharedChunkFileNames,
  strictExecutionOrder: options.strictExecutionOrder ?? true,
  codeSplitting: {
    groups: [
      {
        name: (moduleId: string) => sharedManualChunks(moduleId) ?? undefined,
        //                                                        ^^^^^^^^^ 由 null 改为 undefined
      },
    ],
  },
});
```

## Compatibility & Migration

- **Electron 路径不受影响**：`apps/desktop/electron.vite.config.ts` 使用 `sharedRollupOutput`（Rollup 路径），不走 `createSharedRolldownOutput`。
- **Web SPA / Mobile SPA**：`vite.config.ts` 使用 `createSharedRolldownOutput`，两者都受 B 影响、共享 `sharedManualChunks` 改动也都受 A 影响。
- **无 DB / API / 用户数据迁移**。

## Trade-offs

1. **多一个 chunk（vendor-model-runtime）**：Vite/Rolldown 会单独输出一份 `vendor/model-runtime-[hash].js`。
   - 优势：浏览器可以并行加载、缓存命中率高（model-runtime 内容相对稳定）。
   - 劣势：可能增加请求数 1 个。整体 bundle 大小不变。

2. **`?? undefined` 是否真的不同于 `?? null`**：
   - 如果 Rolldown 内部对两者完全等价 → B 无作用，但也不会有副作用。
   - 如果不等价 → B 兜底所有未匹配的 module，避免类似问题在其他 dynamic import 路径上重现。
   - 净影响：理论 ≥ 0 收益、0 风险。

## Rollback

每个改动都是单行，git revert 即可。Vercel 部署可用 `mcp__plugin_vercel_vercel__list_deployments` 找到上一个 READY 部署一键 promote。

## 验证策略

- **不本地跑 build**（per [[feedback_testing]] memory：Push to Vercel for testing）。
- 修改 → commit → push → Vercel 自动部署。
- 部署完成后：
  1. 用 `mcp__plugin_vercel_vercel__get_deployment` 确认新部署 READY。
  2. 让用户登录站点，查 Console 是否仍有 `Failed to resolve module specifier 'null'`。
  3. 让用户检查 sidebar / 模型选择器 / settings 是否能正常加载数据。
  4. 用 `mcp__plugin_vercel_vercel__get_runtime_logs` 看到 `/trpc/lambda/*` 请求出现即验证后端有真实流量。
