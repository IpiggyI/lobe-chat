# Upstream Digest: v2.2.2 → v2.2.3

> 上游 `upstream/main` 增量摘要（report-only 阶段产出）。冲突 / 分段 / 预演分析见 `design.md`，执行清单见 `implement.md`。

## 概况

- **同步源**：`upstream/main`（fork 跟踪 release 分支；上游开发在 `canary`）
- **起点**：`v2.2.2` = `248a4dca`（已是 HEAD 祖先）
- **目标**：`v2.2.3` = `upstream/main` HEAD = `553d3d8fc7`
- **范围**：`HEAD..upstream/main` = **134 commits**（截断防护已验证：133 换行 + 末行无换行 = 134）
- **BREAKING**：无（唯一含 "breaking" 字样的是修 CI lint 的描述）
- **canary**：领先 main **93 commit**（未发布，本任务不同步）

## 分类计数（134）

| 🐛 fix | ✨ feat | 💄 style | ♻️ refactor | 🔧 chore | docs | build | test | perf |
| ------ | ------- | -------- | ----------- | -------- | ---- | ----- | ---- | ---- |
| 45     | 35      | 19       | 13          | 9        | 3    | 3     | 2    | 1    |

## 主线（35 feat 按主题归并）

**1. Workspace 工作区系统（本次最大主线）**

- `#13977` support workspace lobehub · `#15560` workspace 后端 service slice
- 配套 5 个 DB 迁移（给现有表引入 `workspace_id` 作用域）

**2. Agent / 异构代理 / 设备执行（数量最多）**

- `#15543` 按设备工作目录 + 执行设备 UI・`#15353` device cwd 结构化 workingDirs
- `#15575` 阻止嵌套子代理调用・`#15481` 服务端 callSubAgent 异步挂起 / 恢复
- `#15512` 自动扫描项目 workspace (skills + AGENTS.md)・`#15566` 设备 RPC 列出项目 skills
- `#15557` Codex exec 默认绕过审批 / 沙箱・`#15602` `--raw-dump` 持久化 agent 流・`#15508` 工具结果质量分析 (tq)

**3. Connector / MCP 系统（新增）**

- `#15463` Connectors 系统：API 级工具权限 + 插件回退・`#15546` 自定义 OAuth MCP 连接器
- `#15469` stdio MCP 工具调用隧道到设备・`#15473` 隧道工具调用加类型判别符

**4. Sandbox 沙箱**

- `#15184` 支持 sandbox provider・`#15550` 用户上传文件同步进云沙箱

**5. 模型 / Model Bank**

- `#15639` 新增 **claude-fable-5**(Anthropic) · `#15376` MiniMax M3 + 重构模型拉取・`#15590` 用户级 LobeHub 模型可用性

**6. 其它面向用户**

- `#15581` 话题分享体验翻新・`#15629` 新注册直达 onboarding・`#15561` GitHub/Linear 链接渲染成富 chip
- `#15509` chat-input Pinned 区显示固定工具・`#15506` askUserQuestion 每问自定义输入・`#15413` topic 标题生成改用 XML (提升 DeepSeek 兼容)
- `#15489` Agent Run delivery checker · `#15544` 保留 utm_source 过 OIDC・`#14771` task 系统 qstash schedule

## 🗄️ 数据库迁移（部署时执行，不在本地跑）

```
0106_add_workspace_id_columns        0109_migrate_unique_constraints
0107_add_workspace_id_fk             0110_add_verify_tables_and_ai_infra_id
0108_add_workspace_id_indexes
```

## 🔥 冲突面（详见 design.md）

- merge-tree 实测 **17 个冲突文件**，净冲突 ≈ **13**（减去 4 个 #89 路径迁移重复变体）。
- **关键**：`#89 refactor: extract server into apps/server (#14949)` 把 4 个 fork 改过的 server 文件从 `src/server/` → `apps/server/src/`。
- **预演首卡点**：fork commit `35bf02e6e8 fix(search1api)` ↔ 上游 `#85` google SSRF 校验，冲突文件 `packages/model-runtime/src/providers/google/index.ts`。前 16 个 fork commit 干净，≥1 个 (`71f4ddc4cf`) 被 git 识别已上游化自动跳过。

## ✅ 安全区（auto-merge 无冲突，这轮不用碰）

- effort sliders：`ControlsForm.tsx` / `LevelSlider.tsx` / `modelParamsResolver.ts`
- incognito chat store：`aiChat/streamingExecutor.ts` / `conversationLifecycle.ts`
- locales（`locales/*` 与 `packages/locales/*`）

## 📦 依赖

- `@lobehub/editor` pin 到 `^4.17.1`（#15600）
- `node-gyp` bump 到 12.x（Windows/VS2026，#15562）
