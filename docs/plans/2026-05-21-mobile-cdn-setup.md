# Mobile SPA CDN 拆分方案

> 创建时间: 2026-05-21
> 触发上下文: Vercel build 8GB OOM；vercel buildCommand 跳过 build:spa:mobile 又导致 fork mobile UI 改动不可见
> 状态: workflow 就绪，等待 Cloudflare R2 凭证配置后首次触发

## 背景

椰椰的 fork (IpiggyI/lobe-chat) 长期存在 "mobile UI 改动看不到" 的盲区，已确认根因：

1. `vercel.json` 的 `buildCommand` 是 `build:vercel`
2. `build:vercel` 不跑 `build:spa:mobile`（2026-04-20 为避 Next.js build OOM 故意移除）
3. `scripts/generateSpaTemplates.mts` 在检测到 `dist/mobile/index.html` 缺失时走 fallback，import `mobileHtmlTemplate.source.ts`
4. 这个 fallback 文件由上游 release 流程生成，指向上游 CDN `web-assets.lobehub.com/mobile/<timestamp>/...` 的固定快照 —— 跟 fork 改动无关

加回 `build:spa:mobile` 会让 `public/_spa/` 体积翻倍，Next.js Turbopack build 在 8GB build container 内 SIGKILL（commit `69901a6e89` 实测验证）。

## 选定方案

复用上游已有的 `scripts/mobileSpaWorkflow`（vite build + S3 upload + 重写 source.ts），通过 GitHub Actions 手动触发，避开 Vercel 8GB 限制。

```
GitHub Actions (workflow_dispatch)
  └─ build:spa:mobile (独立 runner，不和 next.js 抢内存)
     └─ uploadAssets → 上传到 fork 自有 Cloudflare R2
        └─ generateMobileTemplate 重写 mobileHtmlTemplate.source.ts
           └─ git commit + push main → Vercel 自动 redeploy
              └─ Vercel build 仍然只跑 desktop + next.js（不变，不 OOM）
                 └─ 运行时 Next.js spa route 返回新 template，浏览器加载 R2 上的 mobile bundle
```

更新频率：椰椰估计一年 2-3 次，手动触发完全可接受。

## 实施步骤

### A. 椰椰手动操作（一次性 setup）

1. **Cloudflare R2**
   - 创建 bucket，例如 `lobe-chat-mobile-spa`
   - 开公开访问（R2.dev 子域名 或 绑定自定义子域名）
   - Manage R2 API Tokens → 创建 token，权限 Object Read & Write，绑定本 bucket
   - 记下：Account ID、Access Key ID、Secret、Endpoint URL（`https://<account-id>.r2.cloudflarestorage.com`）、公开访问 URL
2. **GitHub repo Settings → Secrets and variables → Actions**，新增：

   | secret                        | 值                                                    |
   | ----------------------------- | ----------------------------------------------------- |
   | `MOBILE_S3_BUCKET`            | bucket 名                                             |
   | `MOBILE_S3_ENDPOINT`          | R2 endpoint URL                                       |
   | `MOBILE_S3_ACCESS_KEY_ID`     | R2 token Access Key                                   |
   | `MOBILE_S3_SECRET_ACCESS_KEY` | R2 token Secret                                       |
   | `MOBILE_S3_PUBLIC_DOMAIN`     | R2 公开 URL（如 `https://pub-xxx.r2.dev` 或自定义域） |
   | `MOBILE_S3_REGION`            | `auto`                                                |

### B. 首次触发

3. GitHub Actions → Build Mobile SPA → Run workflow
4. workflow 自动跑：vite build → 上传 R2 → 改写 `mobileHtmlTemplate.source.ts` → commit 回 main
5. main 上的新 commit 触发 Vercel 部署（不含 mobile build，不 OOM）
6. 部署完成后访问 mobile 端验证：
   - `app.lobehub.com/` (mobile UA) → 首页应看到 incognito + image/tasks 入口
   - DevTools Network → `index.mobile-*.js` 来自 R2 域名

### C. 后续维护

- 每次涉及 mobile router 用到的代码（store /services/features /i18n / 共享 packages）变动后，想让 mobile 用户看到改动 → GitHub Actions 重新跑一次 `Build Mobile SPA`。
- 不动 mobile 时，常规 push 到 main 只触发 Vercel desktop build，与现状一致。

## 涉及文件

| 文件                                     | 状态             | 备注                                                |
| ---------------------------------------- | ---------------- | --------------------------------------------------- |
| `package.json:build:vercel`              | revert           | 去掉本次加入的 `build:spa:mobile`，恢复 4-20 后状态 |
| `.github/workflows/build-mobile-spa.yml` | 新增             | manual trigger workflow                             |
| `scripts/mobileSpaWorkflow/index.ts`     | 复用上游         | 无改动                                              |
| `scripts/cdnWorkflow/s3/index.ts`        | 复用上游         | 无改动                                              |
| `mobileHtmlTemplate.source.ts`           | 由 workflow 重写 | 当前指向上游 CDN，首次跑完后改指向 R2               |

## 用途

- 任务中断后快速恢复上下文：本文档 + `.trellis/tasks/05-21-vercel-mobile-deployment-invisible/` 是完整溯源链
- 长期参考：fork 维护者的 mobile UI 发布手册
