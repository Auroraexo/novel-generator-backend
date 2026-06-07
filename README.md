# Novel Generator — Backend

基于 AI 的网文短篇小说生成器后端 API（NestJS）。

配套前端仓库：[novel-generator-frontend](https://github.com/Auroraexo/novel-generator-frontend)

## 技术栈

- NestJS + TypeScript
- Prisma + PostgreSQL
- BullMQ + Redis
- OpenAI 兼容 LLM 接口

## 快速开始

### 环境要求

- Node.js >= 20
- PostgreSQL
- Redis

### 安装与运行

```bash
npm install
cp .env.example .env   # 配置数据库、Redis、LLM
npx prisma migrate dev
npm run start:dev
```

默认监听 `http://localhost:3001`，API 前缀 `/api`。

### 环境变量

见 `.env.example`。

## 项目结构

```
src/
├── llm/         # LLM 调用封装
├── prompt/      # Prompt 模板
├── project/     # 项目 CRUD
├── setting/     # 故事设定 + 灵感
├── outline/     # 章纲生成
├── chapter/     # 正文生成
├── summary/     # 摘要压缩
├── memory/      # 累积记忆
└── generation/  # 生成队列 + SSE
prisma/          # 数据库 Schema
```

Prompt 设计说明见 `prompt.md`。

## License

MIT
