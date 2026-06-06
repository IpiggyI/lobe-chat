# Implementation — fix-spa-trpc-vite8-preload-null-specifier

## Ordered Checklist

1. [ ] **改动 A**：编辑 `plugins/vite/sharedRendererConfig.ts`，在第 71 行（model-bank 规则下方）插入 model-runtime 命名规则。
2. [ ] **改动 B**：同一文件第 124 行 `?? null` → `?? undefined`。
3. [ ] **写 spec**：新建 `.trellis/spec/guides/spa-build-pitfalls.md`，记录 fork dynamic import 与 manualChunks 的契约。
4. [ ] **更新 spec 索引**：编辑 `.trellis/spec/guides/index.md`，把 `spa-build-pitfalls.md` 加入列表。
5. [ ] **本地 sanity check**（不跑 build）：用 `grep` 验证 `sharedRendererConfig.ts` 中既无残留 `?? null`、又含 `vendor-model-runtime`。
6. [ ] **commit**：单一 commit，gitmoji `🐛 fix:` 前缀，message 体里说明 A+B 同时改的原因。
7. [ ] **push 到 origin/main**：触发 Vercel 自动部署。
8. [ ] **等待 Vercel 部署 READY**：通过 `mcp__plugin_vercel_vercel__list_deployments` 轮询，或让用户从 dashboard 确认。
9. [ ] **用户验证**：登录、检查 Console + Network 是否恢复正常。
10. [ ] **runtime log 验证**：用 `mcp__plugin_vercel_vercel__get_runtime_logs` 查询 `/trpc/lambda/*` 在登录后 1 分钟内有正常调用。
11. [ ] **归档**：触发 archive skill 留档结案。

## Validation Commands

```bash
# 改完后 sanity check（不跑 build）
grep -n 'model-runtime\|?? null\|?? undefined' plugins/vite/sharedRendererConfig.ts

# 期望输出包含：
#   model-bank 那一行
#   新加的 model-runtime → vendor-model-runtime 一行
#   ?? undefined（替换后的）
#   没有 ?? null 残留
```

```bash
# spec 索引检查
grep -n 'spa-build-pitfalls' .trellis/spec/guides/index.md
```

## 风险点 / Rollback Plan

| 风险 | 影响 | 应对 |
|---|---|---|
| Vercel build 因为多了一个 chunk 配置而 OOM | 部署失败 | 回退该提交，回到上一个 READY 部署：从 Vercel dashboard promote 上一个；或 `git revert HEAD && git push` |
| Vite/Rolldown 拒绝 `vendor-model-runtime` 命名 | build 报错 | 改用 `providerConfig` 或其他已知工作的命名前缀 |
| 修复无效，Console 仍报 null specifier | 用户体验不变 | 取一份 Vercel 部署的 `client-*.js` 直接 grep `"null"` 找到具体 chunk path，定位 Rolldown 真正写入 null 的位置 |
| 修复有效但 sidebar 仍 loading（其他 bug） | 误判 | 看新部署的 runtime logs：若 TRPC 调用已恢复但 UI 仍 loading，则是其他下游问题（如 DB 迁移） |

## Follow-up before `task.py start`

- [ ] 用户对 prd.md / design.md / implement.md 三件套总体认可（这一步就是当前对话节点）。
- [ ] 用户确认 commit / push 时机（是修完立即 push 还是 review 后批量 push）。
