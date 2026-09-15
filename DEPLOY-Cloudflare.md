# 部署到 Cloudflare（免费套餐）

这个平台原本是「Node + 本地文件 data/state.json」的架构，而 Cloudflare Workers 没有文件系统，
所以做了三处改造，让它既能继续在本地跑，也能一键部署到 Cloudflare：

| 文件 | 作用 |
| --- | --- |
| `lib/api.js` | 抽出的平台无关 API 层（登录、政策、教师操作等），本地服务与 Worker 共用 |
| `server.js` | 本地服务，只负责静态文件 + 读写 `data/state.json` |
| `worker/index.js` | Cloudflare Worker 入口：静态文件交给 Wrangler 的静态资源，游戏存档存在 D1（SQLite） |
| `wrangler.toml` | Worker 配置（名称、静态目录、D1 绑定） |
| `migrations/0001_init.sql` | D1 建表语句 |

前端轮询间隔可用 `window.MPS_POLL_MS` 调整（默认 5000ms），在 `public/index.html` 里加一行
`<script>window.MPS_POLL_MS = 10000</script>` 即可改成 10 秒一次，减少请求量。

---

## 方式 A：GitHub 自动部署（Workers Builds，推荐）

代码推到 GitHub 后，Cloudflare 会在每次 push 后自动构建并部署。

### 1. 先创建 D1 数据库并拿到 database_id（这一步不能省）

Cloudflare 控制台 → **Workers & Pages → D1 SQL 数据库 → 创建数据库**，名称填 `econ-sim`；
创建完成后打开它，复制页面上的 **Database ID**（32 位十六进制字符串）。

### 2. 把 id 填进 `wrangler.toml`

```toml
[[d1_databases]]
binding = "DB"
database_name = "econ-sim"
database_id = "粘贴上一步复制的 database_id"
```

同时确认文件顶部的 Worker 名字与 GitHub 仓库名一致：

```toml
name = "macro-simulator"
```

### 3. 提交

在 GitHub 网页上编辑 `wrangler.toml` → Commit changes，Workers Builds 会自动重新构建。
之后每次 push 代码都会自动上线，无需任何命令。

### 4. 建表

不需要手动执行：Worker 第一次收到请求时会自动 `CREATE TABLE IF NOT EXISTS world`。
想手动执行也可以：D1 控制台 → Console → 粘贴 `migrations/0001_init.sql` → Execute。

### 5. 常见报错

| 报错 | 原因 | 解决 |
| --- | --- | --- |
| `binding DB of type d1 must have a valid database_id` | `database_id` 还是占位符 | 按第 1、2 步填真实 id |
| `Failed to match Worker name` | 配置里的名字与仓库名不同 | 把 `wrangler.toml` 的 `name` 改成仓库名 |
| `no such table: world` | 表没建 | 新版代码会自动建表，拉最新代码重新部署即可 |

---

## 方式 B：本地命令行部署

### 一、准备（做一次即可）

1. 注册 Cloudflare 账号：https://dash.cloudflare.com/sign-up （免费）
2. 安装依赖（已装好 wrangler，可跳过）：

```bash
npm install
```

### 二、登录

```bash
npx wrangler login
```

会打开浏览器，点 **Allow** 授权即可。

### 三、创建数据库

```bash
npm run cf:db:create
```

终端会输出一段配置，把其中的 `database_id` 复制到 `wrangler.toml` 里，替换
`REPLACE_WITH_YOUR_D1_DATABASE_ID`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "econ-sim"
database_id = "这里粘贴真实的 id"
```

然后建表：

```bash
npm run cf:db:init
```

### 四、部署

```bash
npm run cf:deploy
```

完成后终端会给出地址，形如：

```
https://ibdp-econ-simulator.<你的子域>.workers.dev
```

把这个地址发给学生即可。教师账号默认 `teacher / econ2024`，**上线后请第一时间在「教师面板」里改密码**。

---

## 日常使用

| 操作 | 命令 |
| --- | --- |
| 改了代码后重新上线 | `npm run cf:deploy` |
| 本地模拟 Cloudflare 环境调试 | `npm run cf:dev` |
| 清空线上世界（重新开局） | `npm run cf:db:reset` |
| 查看线上实时日志 | `npx wrangler tail` |
| 备份线上存档 | `npx wrangler d1 export econ-sim --remote --output backup.sql` |

> 学生端每 5 秒轮询一次 `/api/state`，所以新开局后让大家刷新页面即可。

## 免费额度参考

| 项目 | 免费额度 |
| --- | --- |
| Workers 请求 | 100,000 次 / 天（UTC 0 点重置） |
| D1 读取 | 500 万行 / 天 |
| D1 写入 | 100,000 行 / 天，存储 5 GB |

一个 30 人的课堂，2 小时约 4.3 万次请求，在免费额度内。
如果一整天多人连续挂着，建议把 `MPS_POLL_MS` 调到 10000（10 秒），或下课后关掉页面。

## 可选：绑定自己的域名

Cloudflare 控制台 → Workers & Pages → 你的 Worker → Settings → Domains & Routes → Add，
按提示绑定已托管在 Cloudflare 的域名即可（免费额度内不限流量）。
