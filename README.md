# dt — Decision Tree CLI

> 让 AI 知道你怎么想的，而不只是你要什么。

你描述需求，AI 开始生成。但它没有看到你脑子里的假设、边界和判断依据。

你们完成了一次对话，结论有了——但推导过程消失了。下次你自己也想不起来为什么当初这样决定。

你用 AI 做完一个项目。有人问你：这个地方为什么这样设计？你发现自己只能再去问 AI。

**dt 把这个过程记录下来。** 每一个节点存一次推导：前提是什么、逻辑是什么、达成了什么共识。AI 下次打开项目，直接站在你们已经对齐的地方继续工作。

---

## 演示

**决策树全局视图（浅色模式）**

![dt 工具整体界面](docs/浅色模式展示dt工具应该实现成什么样子.png)

每个节点展示标题、类型、状态。点击节点打开详情面板，查看完整的推导过程。

**节点详情面板——推导记录**

![节点详情：人在使用AI工具时的工作方式](docs/展示节点人在使用AI工具时的工作方式.png)

每个节点记录四层结构：已知前提 / 认知起点 / 推导逻辑 / 讨论共识。这是 AI 和人共享的"为什么"，不是 AI 单方面的结论。

![节点详情：AI Agent 的能力边界](docs/展示节点AI%20AGENT的能力边界与运作方式.png)

**暗色模式**

![深色模式下的前端页面](docs/深色模式下的前端页面.png)

---

## 这解决了什么

**如果你是开发者（用 Claude Code / Cursor）**

每次新会话都要重新交代背景。AI 推进太快，你来不及确认每个假设是否对齐。最终产物是 AI 的，改动时你不知道为什么这样做。

dt 让你的推导过程变成结构化文件——下一个 AI 读完，直接从你们已对齐的地方继续，不用重新猜你的意图。

**如果你每天用 AI 辅助思考（但不一定写代码）**

AI 回答太快，没有给你留下思考的空间。你有很多没说出口的判断标准，AI 不知道，但它不会停下来问。

dt 强迫双方慢下来——你先把判断依据写清楚，AI 才能在你真正理解的地方往下推。

**对所有人**

当你的思考图足够完整，可以让任何 AI Agent 调用它去执行任务。你的判断逻辑是结构化的，可追溯的，是你自己的。

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
# 在项目目录初始化决策树
dt init "项目名称"

# 查看当前状态
dt tree

# 添加根节点（你要解决的核心问题）
dt add goal "我们要解决什么问题" --root

# 拆解子问题
dt add subproblem "第一个子问题" --from 001

# 更新节点状态
dt update 003 --status decided --summary "已确定方案 B"

# 启动可视化界面
dt serve
```

会话开始时，AI 执行 `dt tree` 了解当前状态，然后直接在你们上次对齐的节点上继续工作。

---

## 数据结构

每个节点是一个本地 Markdown 文件。旧项目可以继续存放在 `.dt/nodes/` 下；新节点也可以放在项目里的任意目录，由 `.dt/index.yaml` 记录 `nodeId -> 文件路径`：

```markdown
---
dt: node/v1
id: '003'
title: 人类真实的工作决策模式是什么
summary: 任务分探索性与确定性，拆分是思考方式，回溯困境是人被淹没后失去判断力
type: subproblem
status: decided
root: false
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
（这个问题是什么，边界在哪里）

## 推导逻辑
（分析过程、方案比较、权衡。记录"为什么"比"是什么"更有价值）

## 讨论共识
（达成的结论。讨论进行中时可为空）
```

四层结构的意义：AI 和人共享同一份推导依据，不只是结论。

### 分布式节点

如果希望认知节点跟相关实现就近存放，可以指定路径：

```bash
dt add explore "登录鉴权设计" --from 002 --path src/auth/login-design.md
dt add explore "登录鉴权设计" --directory src/auth
```

DT 识别 Markdown 是否为节点，不依赖 `.dt.md` 文件名，而是检查 YAML frontmatter 是否符合 DT 节点结构；新节点会带有显式标记：

```yaml
dt: node/v1
```

`.dt/` 仍然是项目级索引中心：

- `.dt/tree.yaml` 保存项目元信息
- `.dt/index.yaml` 保存节点 ID 到真实 Markdown 路径的映射
- `.dt/nodes/` 作为默认兼容存储位置继续可用

常规 `dt tree/status/show/add/update/link` 会自动刷新索引并显示每个节点路径；手动批量整理、迁移或需要修复索引时，可以运行：

```bash
dt scan
```

执行全量扫描并刷新索引。`dt scan` 是修复/重建工具，不是日常必须步骤；`dt tree/status/show/add/update/link` 和 `dt serve` 都会自动刷新已知索引，`dt serve` 还会监听项目内 Markdown 和目录变化。

### 数据模型要点

- **节点可分布存放**：节点 Markdown 可以在项目任意目录，身份由 frontmatter 的 `id` 决定
- **索引中心**：`.dt/index.yaml` 缓存节点路径，避免每次全项目扫描
- **无 parent/children 字段**：关系统一通过 `edges` 表达
- **edges.type**：`from` = 本节点来自目标节点，`to` = 本节点指向目标节点
- **双向自动维护**：写入一侧的边，系统自动补全反向边
- **root 字段**：`true` 表示根节点，支持多根
- **跨项目引用**：`target: 'projectId::nodeId'` 格式，动态解析

---

## 核心命令

### 决策树操作

| 动作 | 命令 | 说明 |
|------|------|------|
| 看 | `dt tree` | 全局结构，自动检测用户编辑，多根并排 |
| 看 | `dt status` | 项目概览（节点统计、根节点列表） |
| 看 | `dt show <id>` | 节点详情（frontmatter + 正文） |
| 想 | `dt add <type> "标题"` | 先创建一个未挂接节点，之后再用 `dt link` 补关系 |
| 想 | `dt add <type> "标题" --from <id>` | 添加节点，指定父节点 |
| 想 | `dt add <type> "标题" --from <id> --path <path>` | 添加节点到指定 Markdown 路径 |
| 想 | `dt add <type> "标题" --directory <dir>` | 添加节点到指定文件夹，默认文件名为 `<id>.md` |
| 想 | `dt add <type> "标题" --from <id> --from <id2>` | 多父节点 |
| 想 | `dt add <type> "标题" --root` | 添加根节点 |
| 想 | `dt link <src> <tgt> "摘要" --direction from\|to` | 在已有节点之间建立边 |
| 想 | `dt link <src> "proj::id" "摘要" --depth 2` | 跨项目引用 |
| 写 | `dt update <id> --status/--title/--summary/--type` | 更新结构化字段 |
| 写 | `dt update <id> --root true\|false` | 设置根节点标记 |

节点正文可以直接编辑对应 Markdown 文件；用 `dt show <id>` 查看节点当前路径。

### 项目管理

| 命令 | 说明 |
|------|------|
| `dt init "名称"` | 初始化项目并自动注册到全局列表 |
| `dt scan` | 全量扫描项目 Markdown，修复或重建 `.dt/index.yaml` |
| `dt register [路径]` | 注册已有项目 |
| `dt projects` | 列出所有注册项目 |
| `dt serve` | 启动可视化服务 |

### 跨设备同步

| 命令 | 说明 |
|------|------|
| `dt remote set <github-url>` | 配置 GitHub 同步仓库（一次性设置） |
| `dt remote status` | 查看同步状态 |
| `dt remote list` | 列出云端所有项目 |
| `dt remote clone <id> [路径]` | 从云端下载某个项目到本机 |
| `dt push` | 推送当前项目到云端 |
| `dt pull` | 从云端拉取当前项目（覆盖本地） |

---

## 多项目支持

```bash
cd ~/code/project-a && dt init "项目 A"
cd ~/code/project-b && dt register

dt projects   # 查看所有注册项目
dt serve      # 任意目录启动，自动加载所有项目
```

跨项目引用：

```bash
dt link 009 other-project::015 "依赖其 API 设计结论" --depth 2
```

---

## 跨设备同步

dt 支持通过一个私有 GitHub 仓库（`dt-cloud`）在多台设备之间同步决策树数据。

**设计原则：**
- **手动触发**：`dt push` 推送，`dt pull` 拉取，不自动同步
- **当前项目范围**：push/pull 只操作当前所在目录的项目
- **保留项目相对路径**：云端保存 `.dt/` 元数据和节点 Markdown 的项目相对路径；不同机器仍可把同一个项目放在不同根目录
- **push 以本地为准**：推送时用当前本地项目快照覆盖云端项目快照
- **pull 以云端为准**：云端内容直接覆盖本地

**初始化（任意一台机器执行一次）：**

```bash
# 1. 在 GitHub 创建空的私有仓库（如 dt-cloud）

# 2. 配置同步
dt remote set git@github.com:你的用户名/dt-cloud.git

# 3. 推送当前项目
dt push
```

**在新机器上接入：**

```bash
dt remote set git@github.com:你的用户名/dt-cloud.git

dt remote list          # 查看云端有哪些项目
dt remote clone deeptree ~/workspace/deeptree   # 下载到本机

# 之后在项目目录里手动 push/pull
cd ~/workspace/deeptree
dt pull                 # 拉取最新
dt push                 # 推送本地修改
```

**全局 dt**（`~/.dt/global/`）同样支持 push/pull，跨设备共享公共上下文。

---

## 可视化界面

`dt serve` 启动本地 Web 服务器（默认 `http://localhost:3000`）：

- **Project Explorer**：左侧项目文件树，显示 DT Markdown 的真实位置，支持选择目录、新建文件夹、在指定目录新建节点
- **Canvas**：交互式决策树图，支持拖拽、缩放
- **Dagre 自动布局**：节点按层级自动排列
- **先建点后连线**：可以先创建未挂接节点，再在画布或详情面板里补充关系
- **一键整理**：Header 右侧 `⊞` 按钮重新运行布局
- **Detail Panel**：点击节点打开编辑面板，支持 Markdown 预览与内容编辑
- **实时同步**：文件变更通过 WebSocket 自动推送前端刷新
- **双主题**：`[LT]` / `[DK]` 切换亮色与暗色

### 桌面应用

网页版本仍然可用，但桌面应用更适合读取和监听本地项目文件系统。当前实现用 Electron 包裹现有本地服务：

```bash
npm run desktop      # 开发/本机运行桌面版
npm run dist:mac     # 构建 macOS 应用包
npm run dist:win     # 构建 Windows 应用包
```

桌面版与 `dt serve` 使用同一套 API、索引和前端界面，因此功能保持一致。

---

## 与 AI Agent 集成

`dt init` 会在项目根目录写入轻量入口文件（如 `CLAUDE.md` / `AGENTS.md`），只告诉 Agent：

1. 加载全局 `$dt` skill
2. 会话开始时先执行 `dt tree` 了解当前状态
3. 用 `dt show <id>` 查看节点正文与真实路径

对齐原则、写作风格、项目架构说明都放在全局 `dt` skill 中，不再复制到每个项目里。

---

## 节点类型

节点类型是**自由字符串**，无硬性限制。推荐写作风格来自全局 `$dt` skill；可通过 `dt style` 查看当前可用模板。

> 新建节点不预填任何项目内模板，内容完全自由。

---

## License

MIT
