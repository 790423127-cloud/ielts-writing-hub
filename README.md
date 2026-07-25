# IELTS Writing Hub

独立运行的 IELTS Academic / General Training 写作、评分和复盘工作台，基于 **Next.js App Router + TypeScript**。网站不提供公共题库，用户自行粘贴有权使用的题目。

## 已完成的功能

- Academic Task 1 / Task 2、General Training Task 1 / Task 2。
- 用户粘贴题目，系统检查题目特征与所选任务是否冲突。
- Academic Task 1 本地题图预览、可选视觉模型提取、用户确认事实层。
- 作文编辑、写前计划、20/40 分钟计时、实时字数和本地草稿。
- 最近 30 次练习、平均分、最高分、最弱项和深色模式。
- 60 分钟 A/G 模拟考试，Task 2 按双倍权重计算练习估分。
- 表达收藏、标签、搜索、复制和 Markdown 导出。
- 双独立评分官、分歧审计、条件裁决和高分边界 Pro 复核。
- Overall、四项分、原文证据、边界解释、修改优先级和人工复核提示。
- 高置信度句子检查和一键应用。
- 全文总览、逐句修改、语法词形拼写、结构与任务回应。
- 题目范文、基于原文的 +0.5/+1.0 修改版和目标分验证。
- A1/A2/G1/G2 专用 AI 教师规则和分开的错误记忆。

## 独立架构

```text
app/                   Next.js 页面与原生 Route Handlers
components/            前端组件
lib/                   会话、存储、题型识别和 API 客户端
server/ai/             AI 提供商客户端、超时、重试和 JSON 校验
server/scoring/        A/G 四类任务、评分提示、标准化、分歧审计和评分内核
server/learning/       高级反馈与生成上下文
types/                 共享 TypeScript 类型
tests/                 不调用付费模型的核心回归测试
```

新仓库不再把 `/api/grade-writing`、详细反馈、范文生成或实时检查转发到旧网站。旧的 `SCORING_UPSTREAM_URL`、`UPSTREAM_BASE_URL` 和代理文件已无用途，应从 Vercel 环境变量中删除。

## Vercel 环境变量

必须配置：

```text
DEEPSEEK_API_KEY=你的密钥
```

可选模型配置：

```text
DEEPSEEK_BASE_URL=https://api.deepseek.com/chat/completions
SCORE_EXAMINER_MODEL=deepseek-v4-flash
SCORE_ADJUDICATOR_MODEL=deepseek-v4-flash
SCORE_HIGH_SPECIALIST_MODEL=deepseek-v4-pro
SCORE_TEACHER_MODEL=deepseek-v4-pro
SCORE_FEEDBACK_MODEL=deepseek-v4-pro
AI_REQUEST_TIMEOUT_MS=120000
```

Academic Task 1 自动读取题图是可选功能，需要一个兼容 OpenAI Chat Completions 格式的视觉接口：

```text
VISION_API_URL=
VISION_API_KEY=
VISION_MODEL=
```

未配置视觉模型时，用户仍可手动填写并确认事实摘要；核心评分不受影响。

## Vercel 项目设置

- Framework Preset：`Next.js`
- Build Command：默认，关闭 Override
- Output Directory：留空，关闭 Override；不要填写 `public`
- Install Command：默认，关闭 Override
- Root Directory：`./`

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

## 评分行为

1. 服务端重新计算字数并验证任务类型。
2. 两名 AI 评分官独立给出四项分和原文证据。
3. 对分数差异、上限审计、统一四项分和人工复核信号进行审计。
4. 出现实质分歧时由独立裁决模型重评；高分边界使用 Pro 模型复核。
5. 最终四项分冻结后生成或修复详细反馈，本地代码不擅自加减分。
6. Academic Task 1 只依据用户确认的事实层核对数据；未确认时标记人工复核，不凭空扣分。

## 隐私与版权

- 不内置、不展示、不建立公共题库。
- 题目、草稿、模拟考试、表达收藏和练习历史默认保存在用户浏览器。
- 普通评分只发送题目、作文和必要任务信息；题图只有在用户点击“AI 读取题图”时才发送给配置的视觉服务。
- 用户应仅提交其有权使用的材料。
- 本项目不是 IELTS 官方产品，AI 估分不等于正式成绩。
