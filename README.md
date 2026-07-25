# IELTS Writing Studio v0.2

一个不提供公共题库的 IELTS Academic / General Training 写作、评分和复盘工作台。用户先选择四类任务之一，再粘贴自己有权使用的题目。

## v0.2 功能

- Academic Task 1 / Task 2、General Training Task 1 / Task 2 四选一。
- 用户自行粘贴题目，不内置公共题库。
- 题目特征识别与任务冲突提醒；Task 2 的 A/G 仍以用户选择为准。
- Academic Task 1 图片本地预览、图表类型和事实摘要确认。
- 20/40分钟计时、实时字数、写前计划和草稿自动保存。
- 最近30次练习、平均分、最高分和最弱评分项统计。
- 统一评分请求、Overall、四项分、证据和复核提示。
- 最后一句高置信度快速检查，并可一键应用修正。
- 四个学习反馈模块：全文总览、逐句升级、语法词形拼写、结构与任务回应。
- 题目范文、基于原文的 +0.5 和 +1.0 修改版。
- AI教师精讲和 A1/G1/A2/G2 分开的错误记忆。
- Markdown 报告导出、深色模式和手机适配。

## Academic Task 1 安全限制

当前上游 `writing-feedback` 和 `essay-generator` 的部分旧 Task 1 高级提示仍以 G 类书信为主。因此 v0.2：

- Academic Task 1 的核心评分和四项评分报告正常使用；
- 全文总览、逐句升级、语法词形拼写可以使用；
- 暂时禁用 Academic Task 1 的“结构与任务回应”“三步改写”“教师精讲”，避免把书信规则错误套进图表作文。

后续会接入 Academic Task 1 专用 overview、关键特征、比较、数据准确性、地图和流程图规则。

## 架构

这是独立仓库，不修改 `ielts-gt-writing-hub`。当前通过本仓库的服务端代理调用现有统一评分和高级学习接口，浏览器不会直接跨域请求旧站，也不会暴露密钥。

## 本地运行

要求 Node.js 20+。

```powershell
Copy-Item environment.template .env.local
npm start
```

打开 `http://127.0.0.1:4000`。

```bash
npm test
```

## Vercel

环境变量：

```text
SCORING_UPSTREAM_URL=https://ielts-gt-writing-hub.vercel.app/api/grade-writing
```

Vercel 连接 GitHub 后，推送到 `main` 会自动重新部署。

## 隐私与版权

- 不内置、不展示、不建立公共题库。
- 题目、草稿、教师记忆默认保存在当前浏览器。
- 历史记录不保存 Academic Task 1 原图数据，避免 localStorage 超限。
- 用户应仅提交其有权使用的材料。
- 本项目不是 IELTS 官方产品，AI 分数不等于正式成绩。
