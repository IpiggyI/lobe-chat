# PRD: 同步上游 v2.2.2 → v2.2.3

<!-- Trellis PRD：聚焦“为什么做、做什么、验收口径”，技术方案写到 design.md -->

## 1. 背景与问题

椰椰维护的 fork（IpiggyI/lobe-chat）当前停在上游 `v2.2.2`（248a4dca，2026-06-08 同步）。上游 `main` 已发布 `v2.2.3`（`553d3d8fc7`），含 **134 个新 commit**（Workspace 工作区系统、Agent / 异构代理、Connectors/MCP、Sandbox、模型更新等），无 BREAKING。需把 fork 同步到 `v2.2.3`，同时保住 fork 的自定义功能不被覆盖。

## 2. 目标与非目标

### 目标

- 把本地 `main` 从 `v2.2.2` 同步到上游 `v2.2.3`（`553d3d8fc7`）。
- 保住 7 个 fork 自定义功能：runtime tools toggle、manual activation、search1api 修复、effort sliders、incognito chat、klavis/market 修复、topic 修复。
- 采用 4 段分段 rebase，每段落一个可验证 checkpoint。
- 冲突点由椰椰参与决定解决方向（不自作主张解业务冲突）。

### 非目标

- 不同步 canary 分支（领先 main 93 个 commit 的未发布内容）。
- 不在本地跑测试（推 Vercel 验证）。
- 不自动 push（force-with-lease 需椰椰显式授权）。

## 3. 验收标准

- [ ] 本地 `main` HEAD 的上游基底为 `v2.2.3`（`553d3d8fc7`）。
- [ ] fork 自定义 commit 全部 replay（已上游化的允许 git 自动跳过，预演已见 ≥1 个 `71f4ddc4cf`）。
- [ ] `bun run type-check` 通过。
- [ ] 7 个自定义功能在 Vercel 预览环境验证不回归。
- [ ] DB migration 0106-0110 在部署时执行（不在本地跑）。
- [ ] 4 段 checkpoint 分支均保留，backup 分支保留。

## 4. 关键约束与边界

- 同步源：`upstream/main`（fork 跟踪 release 分支；上游开发在 canary）。
- 分段锚点：Seg1=#62（`235a16fc11`）、Seg2=#88（`64d3bdb978`）、Seg3=#128（`c02e5720c2`）、Seg4=v2.2.3（`553d3d8fc7`）。基于冲突簇切分。
- untracked 工具目录（`.agents/ .codex/ .cursor/`）rebase 前移开、后恢复（目录级碰撞陷阱）。
- backup 分支：`backup/main-<timestamp>`。
- push 策略：`force-with-lease` 到 `origin/main`，需椰椰显式授权。

## 5. 备注（本任务的来历）

本任务目录最初由一次故障 session（harness 吐损坏数据、AskUserQuestion 乱码、task.py 误建）残留，椰椰并未手动创建。2026-06-14 重建：`task.json`/`prd.md`/`implement.md` 按本会话真实跑出的 git 分析重写，`design.md` 为故障后 session 写入、内容真实可靠。冲突分析、分段、预演结论详见 `design.md`。
