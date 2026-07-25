# IELTS Writing Hub

一个基于 **Next.js App Router + TypeScript** 的 IELTS Academic / General Training 写作工作台。网站不提供公共题库，用户自行粘贴有权使用的题目。

## 当前功能

- Academic Task 1 / Task 2、General Training Task 1 / Task 2 四类任务。
- 用户粘贴题目，系统检查题目特征与用户选择是否冲突。
- Academic Task 1 本地题图预览与用户确认的事实层。
- 作文编辑、写前计划、20/40 分钟计时、实时字数。
- 浏览器本地草稿、最近 30 次练习、统计和深色模式。
- 统一 A/G 评分、四项报告、原文证据和人工复核提示。
- 高置信度句子检查。
- 四项深度反馈、全文总览、逐句修改、语法词形。
- 非 Academic Task 1 的范文、+0.5/+1.0 改写和 AI 教师精讲。
- A/G 与 Task 分开的教师错误记忆。
- Markdown 报告导出。

## 架构

```text
app/                 Next.js 页面与 Route Handlers
components/          页面组件
lib/                 会话、题型识别、本地存储、API 客户端
types/               共享 TypeScript 类型
tests/               不依赖浏览器的核心逻辑测试
```

旧版原生 HTML、单体 `app.js`、自建开发服务器和旧 Vercel Functions 已删除。评分及高级 AI 功能通过同源 Route Handlers 转发到现有评分服务，因此浏览器不会暴露密钥，也不需要跨域访问。

## 环境变量

Vercel 至少配置：

```text
SCORING_UPSTREAM_URL=https://ielts-gt-writing-hub.vercel.app/api/grade-writing
```

其他接口会从该地址自动推导同一个 `/api` 基础地址。也可以显式配置：

```text
UPSTREAM_BASE_URL=https://ielts-gt-writing-hub.vercel.app/api
UPSTREAM_BEARER_TOKEN=
```

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 检查

```bash
npm test
npm run typecheck
npm run build
```

## Academic Task 1 限制

图片只在用户浏览器中预览，不会自动上传给评分模型。评分器依据用户填写的事实摘要和关键特征核对内容。

旧上游的“范文生成”和“教师精讲”仍可能使用 G 类 Task 1 书信规则，因此 Academic Task 1 暂时禁用这两个入口，避免错误规则串线。四项评分和 criterion feedback 仍使用 Academic Task 1 专用逻辑。

## 隐私与版权

- 不内置、不展示、不建立公共题库。
- 题目、草稿和练习历史默认保存在用户浏览器。
- 用户应仅提交其有权使用的材料。
- 本项目不是 IELTS 官方产品，AI 估分不等于正式成绩。

<!-- Vercel redeploy trigger: 2026-07-26 -->
