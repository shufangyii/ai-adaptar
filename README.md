# LLM Gateway Platform

企业级 LLM 网关平台，基于 NestJS 和 LiteLLM 构建，为多个项目组提供统一、安全、高可用的生产级 LLM 网关服务。

## 技术栈

- **框架**: NestJS (Node.js/TypeScript)
- **包管理**: pnpm + Turbo (Monorepo)
- **LLM 适配**: LiteLLM
- **数据库**: PostgreSQL + Prisma
- **缓存**: Redis
- **消息队列**: Kafka
- **日志存储**: Elasticsearch

## 项目结构

```
llm-gateway-platform/
├── apps/
│   ├── api-gateway/        # 核心网关服务
│   ├── admin-api/          # 管理后台服务
│   └── background-worker/  # 异步计费与日志消费者
├── libs/
│   ├── database/           # 数据库共享库
│   ├── redis/              # Redis 共享库
│   └── shared-types/       # 共享类型定义
├── docs/                   # 项目文档
├── package.json            # 根 package.json
├── pnpm-workspace.yaml     # pnpm workspace 配置
└── turbo.json              # Turbo 配置
```

## 快速开始

### 前置要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### 安装依赖

```bash
pnpm install
```

### 开发模式运行

```bash
# 启动 api-gateway 服务
pnpm -F api-gateway run start:dev

# 启动所有服务（并行）
pnpm run dev
```

### 构建

```bash
# 构建所有包
pnpm run build

# 构建指定包
pnpm -F api-gateway run build
```

### 测试

```bash
# 运行所有测试
pnpm run test

# 运行 E2E 测试
pnpm run test:e2e
```

### 代码检查

```bash
# Lint 检查
pnpm run lint

# 类型检查
pnpm run typecheck

# 格式化代码
pnpm run format
```

## 环境变量

参考 `apps/api-gateway/.env.example` 文件配置环境变量。

## Phase 1.1 完成情况

✅ pnpm workspace 初始化
✅ NestJS 核心应用 `api-gateway` 创建
✅ 共享库 `libs` 初始化
  - `libs/database` - 数据库模块
  - `libs/redis` - Redis 模块
  - `libs/shared-types` - 共享类型定义
✅ 基础配置文件
  - ESLint + Prettier
  - TypeScript 配置
  - Turbo 配置

## 下一步

参考 `docs/DETAILED_TASK_LIST.md` 查看完整的任务清单。

## License

UNLICENSED
