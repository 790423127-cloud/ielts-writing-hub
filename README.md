# IELTS Writing Studio v0.1

一个不提供公共题库的 IELTS Academic / General Training 写作工作台。用户先选择四类任务之一，再粘贴自己有权使用的题目、输入作文并提交评分。

## 第一版功能

- Academic Task 1 / Task 2、General Training Task 1 / Task 2 四选一。
- 用户自行粘贴题目。
- Academic Task 1 图片本地预览、图表类型和事实摘要确认。
- 20/40分钟计时、实时字数、写前计划。
- 草稿和最近20次练习保存在浏览器 localStorage。
- 统一评分请求格式，对接现有 `/api/grade-writing` v6.5 服务。
- Overall、四项分、总体判断、原文证据和复核提示展示。
- 响应式页面和深色模式。
- 现有高级接口代理预留：criterion feedback、essay generator、writing feedback、live check、template reference。

## 架构说明

这是一个全新、独立的项目，不修改原有 `ielts-gt-writing-hub` 仓库。第一版为了尽快交付和降低迁移风险，通过服务端代理调用现有统一评分部署；浏览器不会直接跨域调用旧网站，也不会暴露密钥。

第二阶段可以把已经验证的 `api/_scoring/` v6.5 内核完整迁入本仓库，届时只需替换代理层，前端和会话数据结构不需要重写。

## 本地运行

要求 Node.js 20+。

```powershell
Copy-Item environment.template .env.local
npm start
```

打开：`http://127.0.0.1:4000`

运行测试：

```bash
npm test
```

## Vercel 部署

1. 在 Vercel 导入本仓库。
2. 添加环境变量：

```text
SCORING_UPSTREAM_URL=https://ielts-gt-writing-hub.vercel.app/api/grade-writing
```

如上游以后设置访问令牌，再添加 `UPSTREAM_BEARER_TOKEN`。

## Academic Task 1 限制

第一版的图片仅用于用户本地查看，不会自动发送给评分模型。评分器依据用户填写的 `visualFacts.referenceDescription` 和 `keyFeatures` 核对数据事实。

只有在用户确实核对图表事实后才应勾选“我已核对事实摘要”。这不是视觉模型自动验证。

## 隐私与版权

- 不内置、不展示、不建立公共题库。
- 题目和草稿默认只存在用户浏览器。
- 用户应仅提交其有权使用的材料。
- 本项目不是 IELTS 官方产品，AI 分数不等于正式成绩。
