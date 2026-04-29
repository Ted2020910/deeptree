# dt — Decision Tree CLI

> 人机协作的决策过程外化工具

dt 让 AI 和人类在同一棵决策树上思考。每个节点记录一个讨论单元的认知起点、推导逻辑和达成共识，所有内容本地化为 Markdown 文件，对人可读、对 AI 可操作、对 Git 可追溯。

---

## 为什么需要 dt

**人与人之间的对齐**可以通过多种模态完成——表情、语气、肢体语言、沉默、犹豫。对齐是多通道并行发生的。

**人与 AI 之间只有语言这一个通道。** 语言天然有歧义，AI 不会皱眉、不会犹豫——它会自信地沿着错误的理解一路推导下去，直到产出一个"看起来正确但根基歪了"的结论。

因此，人-AI 协作的核心瓶颈不是 AI 的能力，而是**对齐的精度**。dt 的解法：把决策过程变成一棵本地的有向图，每个节点是一个讨论单元，强制记录推导过程而非只记录结论。人和 AI 共享同一份结构，每一步都可以被人审计和纠正。

---

## 安装

```bash
git clone https://github.com/Ted2020910/deeptree.git
cd deeptree
npm install
npm run build
npm link          # 全局注册 dt 命令
```

---

## 快速开始

```bash
# 在项目目录初始化决策树（自动注册到全局列表）
dt init "项目名称"

# 查看当前状态
dt tree
dt status

# 添加根节点
dt add goal "我们要解决什么问题" --root

# 添加子节点（指定父节点）
dt add subproblem "第一个子问题" --from 001

# 多父节点
dt add subproblem "依赖多个前提的问题" --from 001 --from 002

# 在已有节点之间建立边
dt link 003 007 "两个子问题共享同一约束" --direction to

# 跨项目引用（需先注册目标项目）
dt link 003 other-project::015 "依赖其结论" --depth 2

# 更新节点状态
dt update 003 --status decided --summary "已确定方案 B"

# 查看节点详情
dt show 003

# 启动可视化界面
dt serve
```

---

## 核心命令

### 决策树操作

| 动作 | 命令 | 说明 |
|------|------|------|
| 看 | `dt tree` | 全局结构，自动检测用户编辑，多根并排 |
| 看 | `dt status` | 项目概览（节点统计、根节点列表） |
| 看 | `dt show <id>` | 节点详情（frontmatter + 正文） |
| 想 | `dt add <type> "标题" --from <id>` | 添加节点，指定父节点 |
| 想 | `dt add <type> "标题" --from <id> --from <id2>` | 多父节点（可多次 `--from`） |
| 想 | `dt add <type> "标题" --root` | 添加根节点 |
| 想 | `dt link <src> <tgt> "摘要" --direction from\|to` | 建立已有节点之间的边（自动补反向边） |
| 想 | `dt link <src> "proj::id" "摘要" --depth 2` | 跨项目引用 |
| 写 | `dt update <id> --status/--title/--summary/--type` | 更新结构化字段 |
| 写 | `dt update <id> --root true\|false` | 设置根节点标记 |

节点正文通过直接编辑 `.dt/nodes/xxx.md` 来更新，无需 CLI。

### 项目管理（多项目）

| 命令 | 说明 |
|------|------|
| `dt init "名称"` | 初始化项目并自动注册到全局列表 |
| `dt register [路径]` | 注册已有项目（默认当前目录） |
| `dt unregister <id>` | 从全局列表移除项目 |
| `dt projects` | 列出所有注册项目及可达状态 |
| `dt serve` | 启动可视化服务（自动加载所有注册项目） |

---

## 多项目支持

dt 支持在一个 `dt serve` 实例中管理多个分散在不同目录的项目。

```bash
# 在不同目录注册多个项目
cd ~/code/project-a && dt init "项目 A"
cd ~/code/project-b && dt register

# 查看所有注册项目
dt projects

# 任意目录启动服务，自动加载所有项目
dt serve
```

项目注册表保存在 `~/.dt/projects.json`，跨目录、跨会话持久化。前端 Header 提供项目选择器，切换时 URL 同步为 `?project=:id`，刷新后保持当前项目。

### 跨项目引用

节点可以引用其他已注册项目的节点：

```bash
# 引用 other-project 项目的 015 节点，拉取深度为 2
dt link 009 other-project::015 "依赖其 API 设计结论" --depth 2
```

- 格式：`projectId::nodeId`（双冒号分隔）
- **硬引用**：项目未注册或路径不可达时报错，提示先 `dt register`
- 动态解析：直接读取目标项目文件，无镜像缓存，始终是最新内容

---

## 可视化界面

`dt serve` 启动本地 Web 服务器（默认 `http://localhost:3000`）：

- **Canvas**：交互式决策树图，支持拖拽、缩放
- **Dagre 自动布局**：节点按层级自动排列，新增节点自动插入，内容更新不重置位置
- **一键整理**：Header 右侧 `⊞` 按钮重新运行 Dagre 布局，整理手动拖乱的节点
- **Detail Panel**：点击节点打开编辑面板，支持 Markdown 预览与内容编辑
- **实时同步**：文件变更通过 WebSocket 自动推送前端刷新（已修复 Windows 下 chokidar 兼容性问题）
- **双主题**：`[LT]` / `[DK]` 切换 OLED 暗色与纸白亮色
- **多项目**：注册多个项目后，Header 出现项目选择器

---

## 数据结构

每个节点是一个 Markdown 文件，存放在 `.dt/nodes/` 下：

```markdown
---
id: '003'
root: false
title: 人类真实的工作决策模式是什么
summary: 任务分探索性与确定性，拆分是思考方式，回溯困境是人被淹没后失去判断力
type: subproblem
status: decided
edges:
  - target: '002'
    type: from
    summary: 从第一性原理理解人类决策模式，是设计 dt 的前提
  - target: '004'
    type: to
    summary: 理解决策模式后，推导 dt 本质要做什么
---

## 已知前提
（来自其他节点或外部的既有共识、约束条件）

## 认知起点
（本节点讨论的具体出发点：这个问题是什么，边界在哪里）

## 推导逻辑
（分析过程、方案比较、权衡。记录"为什么"比"是什么"更有价值）

## 讨论共识
（达成的结论或决策。讨论进行中时可为空）
```

### 数据模型要点

- **无 parent/children 字段**：关系统一通过 `edges` 表达
- **edges.type**：`from` = 本节点来自目标节点（目标是父），`to` = 本节点指向目标节点（目标是子）
- **双向自动维护**：写入一侧的边，系统自动补全反向边
- **root 字段**：`true` 表示根节点，作为 `dt tree` 起始点，支持多根
- **跨项目引用**：`target: 'projectId::nodeId'` 格式，动态解析，不缓存
- **底层是有向图（DAG）**，不是严格的树——支持多父节点

---

## 与 Claude Code 集成

`dt init` 会在项目根目录写入 `CLAUDE.md`，告知 Claude Code：

1. 会话开始时先执行 `dt tree` 了解当前状态
2. 遵循**对齐原则**——逐词确认理解，暴露推导过程，主动标记不确定性
3. 使用四层正文结构（已知前提 / 认知起点 / 推导逻辑 / 讨论共识）记录每个节点的讨论

---

## Git 集成

dt 写操作后自动执行 `git add .dt/ && git commit`，对 AI Agent 完全透明：

- AI 操作后工作区始终是干净的
- 工作区出现 unstaged 变更 = 人类编辑
- `dt tree` / `dt status` 执行时自动检测并提示

---

## 节点类型

预设类型（均可用自定义字符串替换）：

| 类型 | 用途 |
|------|------|
| `goal` | 目标或根问题 |
| `subproblem` | 子问题拆解 |
| `solution` | 方案 |
| `evaluation` | 方案评估 |
| `reflection` | 回顾与复盘 |

---

## License

MIT
