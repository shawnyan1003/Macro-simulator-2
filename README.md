# Macro Simulator — IBDP Economics HL 宏观经济政策模拟器

一个用于 IBDP Economics HL 课堂的三国宏观经济政策模拟游戏：学生分组扮演三个国家的政策制定者，通过调整利率、政府支出、税率等政策工具应对冲击，系统按季度推进并联动国际贸易与汇率；教师端可推进时间、发布事件、调整评分权重。

## 功能

- **三个国家**：制造业驱动的新兴经济体 / 消费驱动的发达经济体 / 出口导向的发展中经济体，互相通过贸易与汇率联动
- **政策工具**：利率、政府支出、税收、关税、准备金率等，含滞后与乘数效应
- **AI 政策解读**：学生用自然语言描述政策，自动解析为参数（可选）
- **教师端**：注册学生账号、推进季度、注入事件（通胀冲击、金融危机等）、调整评分权重、踢出学生、重置世界
- **实时排名**：GDP 增速、通胀、失业率、债务、基尼系数、HDI 综合评分
- **中英双语界面**
- **存档**：本地版存 `data/state.json`，Cloudflare 版存 D1 数据库，刷新不丢进度

## 本地运行（零依赖，Node ≥ 18）

```bash
npm start          # 打开 http://localhost:3000
npm run selftest   # 模型自检
npm run reset      # 重置存档
```

首次启动会自动生成 `data/state.json`，教师账号密码会打印在控制台。

## 部署到 Cloudflare Workers（免费）

```bash
npm install                          # 安装 wrangler
npx wrangler login
npm run cf:db:create                 # 创建 D1 数据库，把输出的 database_id 填入 wrangler.toml
npm run cf:db:init                   # 初始化表结构
npm run cf:deploy                    # 部署，得到 https://xxx.workers.dev
```

详细说明见 [DEPLOY-Cloudflare.md](DEPLOY-Cloudflare.md)。

> 提示：前端默认 5 秒轮询一次 `/api/state`。免费版 Workers 每天 10 万请求，课堂人数多时建议调大 `public/app.js` 里的 `MPS_POLL_MS`（毫秒），例如 15000。

## 项目结构

```
server.js            本地 Node 服务（静态文件 + API，存档到 data/state.json）
worker/index.js      Cloudflare Worker 入口（复用 lib/api.js，存档到 D1）
lib/model.js         宏观经济模型：季度推进、政策传导、事件、评分
lib/api.js           平台无关的 API 层（本地与 Worker 共用）
lib/countries.js     三国初始参数与现实校准参考值
lib/glossary.js      经济学名词表
lib/policyai.js      自然语言政策解析
public/              前端（index.html / app.js / style.css / i18n.js）
migrations/          D1 建表 SQL
scripts/             selftest / reset 脚本
```

## 免责声明

三国设定为教学抽象，参数基于公开宏观数据校准，不指代任何真实国家。
