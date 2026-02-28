# AI Adaptar

多厂商 AI 模型适配层 - 基于 NestJS 的微服务架构

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

## 项目简介

AI Adaptar 是一个统一的 AI 模型适配层，为多个 AI 提供商（OpenAI、Anthropic、Azure、Google Gemini、通义千问等）提供统一的 API 接口。采用微服务架构，支持负载均衡、故障转移、计费管理、函数调用等功能。

## 功能特性

- [x] 多 AI 提供商适配 (OpenAI, Anthropic, Azure, Gemini, Qwen)
- [x] 统一的 API 接口
- [x] 负载均衡
- [x] 模型路由映射
- [x] 流式响应支持
- [x] JWT 认证系统
- [x] 计费系统
- [x] 配额管理
- [x] 函数调用 (Function Calling)
- [ ] 请求缓存 (TODO)
- [ ] 多模态支持 (Vision/Audio) (TODO)

## 项目进度

```
总任务数: 103
已完成:   48 (46.6%)
待开始:   55 (53.4%)
```

详见 [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) 或 [TODO.md](./TODO.md)

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│              (REST API + JWT 认证 + 请求验证)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Auth      │  │ Controllers │  │  Guards     │             │
│  │   Module    │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                         │ NATS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          AI Core                                 │
│         (模型路由 / 负载均衡 / 函数调用 / 计费)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Provider  │  │   Function  │  │   Billing   │             │
│  │   Manager   │  │   Calling   │  │   Service   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Provider Adapters                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ OpenAI   │ │Anthropic │ │  Azure   │ │ Gemini   │  ...      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
ai-adaptar/
├── apps/
│   ├── api-gateway/              # API 网关服务
│   │   ├── src/
│   │   │   ├── auth/            # JWT 认证
│   │   │   ├── guards/          # 认证守卫
│   │   │   └── controllers/     # REST 控制器
│   │   └── package.json
│   │
│   ├── ai-core/                  # AI 核心服务
│   │   ├── src/
│   │   │   ├── billing/         # 计费模块
│   │   │   ├── function-calling/ # 函数调用
│   │   │   ├── controllers/     # NATS 控制器
│   │   │   ├── providers/       # 提供商管理
│   │   │   ├── load-balancer/   # 负载均衡
│   │   │   └── model-mapping/   # 模型映射
│   │   └── package.json
│   │
│   └── providers-registry/       # 提供商适配器
│       ├── openai-adapter/       # ✅ 完整实现
│       ├── anthropic-adapter/    # ✅ 完整实现
│       ├── azure-adapter/        # ✅ 完整实现
│       ├── gemini-adapter/       # ✅ 核心功能
│       └── qwen-adapter/         # ✅ 核心功能
│
├── libs/
│   ├── interfaces/               # 接口定义
│   ├── common/                   # 公共模块
│   └── database/                 # 数据库模块
│
├── docker-compose.yml            # 开发环境
├── PROJECT_SUMMARY.md            # 项目总结
├── TODO.md                       # 任务清单
└── README.md
```

## 支持的 AI 提供商

| 提供商 | 状态 | 聊天 | 流式 | 嵌入 | 图像 |
|--------|------|------|------|------|------|
| **OpenAI** | ✅ 完整 | ✅ | ✅ | ✅ | ✅ |
| **Anthropic** | ✅ 完整 | ✅ | ✅ | - | - |
| **Azure OpenAI** | ✅ 完整 | ✅ | ✅ | ✅ | ✅ |
| **Google Gemini** | ✅ 核心 | ✅ | ✅ | ✅ | ⏳ |
| **通义千问** | ✅ 核心 | ✅ | ✅ | ✅ | ⏳ |

## 快速开始

### 前置要求

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose

### 安装依赖

```bash
# 安装 workspace 依赖
pnpm install
```

### 启动基础服务

```bash
docker-compose up -d
```

这将启动：
- NATS 消息队列
- Redis 缓存
- PostgreSQL 数据库

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，添加相应的 API Keys
```

### 构建项目

```bash
pnpm build
```

### 启动服务

```bash
# 启动 API Gateway
pnpm --filter @ai-adaptar/api-gateway start:dev

# 启动 AI Core Service
pnpm --filter @ai-adaptar/ai-core start:dev
```

### 访问服务

- API Gateway: http://localhost:3000
- API 文档: http://localhost:3000/api/docs
- NATS 监控: http://localhost:8222

## API 使用示例

### 聊天补全

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello, AI Adaptar!"}
    ]
  }'
```

### 函数调用

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "现在几点了？"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_current_time",
          "description": "Get the current time",
          "parameters": {
            "type": "object",
            "properties": {
              "timezone": {"type": "string"}
            }
          }
        }
      }
    ]
  }'
```

### 流式聊天

```bash
curl -X POST http://localhost:3000/v1/chat/completions/stream \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Tell me a joke"}
    ],
    "stream": true
  }'
```

### 用户注册

```bash
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "securepassword123"
  }'
```

### 用户登录

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "securepassword123"
  }'
```

### 获取使用统计

```bash
curl -X GET http://localhost:3000/v1/billing/usage \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 开发指南

### 添加新的提供商适配器

1. 在 `apps/providers-registry/` 下创建新的适配器目录
2. 实现 `AIProvider` 接口
3. 在 `ai-core` 模块中注册新适配器

### 添加新模型映射

编辑 `apps/ai-core/src/model-mapping/model-mapping.service.ts`，在 `initializeMappings` 方法中添加新模型配置。

### 添加自定义函数

在 `apps/ai-core/src/function-calling/example-functions.ts` 中添加新的函数注册。

## API 文档

启动服务后访问: http://localhost:3000/api/docs

## 监控

- NATS 监控: http://localhost:8222
- NATS Exporter: http://localhost:7777
- Prometheus: http://localhost:9090 (待配置)
- Grafana: http://localhost:3001 (待配置)

## 许可证

MIT

---

**开发状态**: 活跃开发中
**最后更新**: 2026-02-28
**详细文档**: [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | [TODO.md](./TODO.md)
