# 企业级 LLM 网关项目 - 文档导航与速查

## 📚 文档结构

本项目包含三份核心规划文档：

| #   | 文档                                   | 内容                                                     | 适合角色           |
| --- | -------------------------------------- | -------------------------------------------------------- | ------------------ |
| 1   | [ARCHITECTURE.md](./ARCHITECTURE.md)   | 架构设计、技术栈选型、微服务分解、数据流设计             | 架构师、技术负责人 |
| 2   | [ROADMAP.md](./ROADMAP.md)             | 实施路线图、周度计划、详细任务清单、优先级排序、验收标准 | 项目经理、开发团队 |
| 3   | [TEST_SPEC_TDD.md](./TEST_SPEC_TDD.md) | TDD 测试规格、验证标准、运行命令                         | QA、测试工程师     |

---

## 🏗️ 项目核心信息速查

### 技术栈

| 层级         | 技术                | 用途                          |
| ------------ | ------------------- | ----------------------------- |
| **Web 框架** | NestJS (TypeScript) | 业务网关、Admin API、后台任务 |
| **数据库**   | PostgreSQL + Prisma | 租户、Key、计费流水存储       |
| **缓存**     | Redis Cluster       | 限流、鉴权缓存、分布式锁      |
| **消息队列** | Kafka               | 异步日志与计费                |
| **日志存储** | Elasticsearch       | 海量审计日志与全文检索        |
| **LLM 代理** | LiteLLM             | 统一模型适配与路由            |
| **容器编排** | Kubernetes          | 生产部署与自动扩缩容          |
| **包管理**   | pnpm + Turbo        | Monorepo 工作区管理           |

### 服务模块

```
llm-gateway-platform/
├── apps/
│   ├── api-gateway/          # 核心业务网关
│   │   ├── proxy/            # LiteLLM 转发
│   │   ├── guards/           # AuthGuard / RateLimitGuard
│   │   └── interceptors/     # 流式统计
│   ├── admin-api/            # 管理后台 REST API
│   └── background-worker/    # 异步计费与日志消费
├── libs/
│   ├── database/             # Prisma Schema + ORM
│   ├── redis/                # Redis 客户端 + 限流
│   └── shared-types/         # DTO / Enums / Types
└── deploy/
    ├── docker-compose.yml
    ├── k8s/
    └── litellm-config.yaml
```

### 请求处理流程

```
1. 业务应用 → 网关 (sk-gateway-xxx)
2. AuthGuard 验证 Key (Redis 缓存)
3. RateLimitGuard 五维限流 (Lua 原子操作)
4. WatermarkCheck 余额水位校验（放弃预扣，安全水位放行）
5. DLP 轻量安全扫描 (无二次请求)
6. 转发到 LiteLLM (带 Trace-Id)
7. 流式响应原生透传给业务方 (stream.pipe)
8. 在 Pipe 过程中监听 Chunk 提取 Token Usage，投递 Kafka
9. background-worker 异步计费与落 ES
```

---

## 🎯 阅读建议

**第一次接触项目** (15 分钟)：

1. 本 README → 2. ROADMAP.md 概览 → 3. ARCHITECTURE.md 深入

**准备开始开发** (1 小时)：

1. ROADMAP.md 找到当前 Phase 的任务 → 2. TEST_SPEC_TDD.md 查看验收标准

---

## ⚠️ 关键点

### 🔴 必须做对的事

1. **Token 计费不能遗漏** — 信任 Provider usage，幂等消费，每日对账
2. **并发释放必须精确** — Streaming 结束事件绑定释放，防泄漏
3. **消费幂等性** — 基于 requestId 唯一约束，Redis Lua 原子扣费
4. **不能阻塞主链路** — DLP 异步可降级，Kafka 投递非阻塞
5. **熔断与降级** — Circuit Breaker 状态转移准确，Redis 故障能快速恢复

### 🟢 可以后续优化

1. 智能路由（按 Prompt 分配模型）
2. 模型健康评分与自动降权
3. Prompt 中台化与 AB 测试
4. OpenTelemetry/Jaeger 完整追踪

---

**项目所有者**: CTO
**最后更新**: 2026-03-10
