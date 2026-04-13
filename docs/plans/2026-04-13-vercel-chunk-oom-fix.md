# 2026-04-13 Vercel chunk OOM fix

## 任务背景

- 时间：2026-04-13
- 目标：修复最新 Vercel deployment `dpl_34Cu44kcid9dPfJD1BcMZy2Qmjcx` 在 `build:spa:raw` 的 `rendering chunks` 阶段触发 OOM 的问题。
- 直接证据：最新线上日志显示 `providerConfig -> app-stores -> providerConfig` 循环 chunk，随后在 `rendering chunks...` 后出现 OOM。

## 选定方案

- 移除 `src/store/** -> app-stores` 的全量手动分块。
- 改为仅对历史高频 barrel 告警目录做定向分块：`agent`、`tool`、`home`、`notebook`。
- 删除只为 `app-stores` 服务的 PWA precache ignore。
- 将 Vercel 这条 SPA 构建链的 heap 从 `7168` 提升到 `8192`。

## 方案调整

- 首次推送后，最新线上日志确认 `providerConfig -> app-stores -> providerConfig` 已消失，但出现了新的局部循环：
  - `store-home -> store-tool -> store-home`
  - `store-home -> store-tool -> store-notebook -> store-home`
- 因此第二轮调整为：彻底移除 `src/store/**` 的手动分块，只保留 `model-bank -> providerConfig` 和现有 vendor 规则。

## 执行步骤

1. 修改 `plugins/vite/sharedRendererConfig.ts`，用定向 store chunk 替代全量 `app-stores`。
2. 修改 `vite.config.ts`，移除 `app-stores` 专用 `globIgnores`，保留通用 Workbox 文件大小阈值。
3. 修改 `package.json`，提升 `build:spa`、`build:spa:mobile`、`build:spa:raw`、`build:vercel` 的 heap。
4. 根据最新线上日志回滚定向 store chunk，彻底移除 `src/store/**` 手动分块。

## 涉及文件

- `plugins/vite/sharedRendererConfig.ts`
- `vite.config.ts`
- `package.json`
