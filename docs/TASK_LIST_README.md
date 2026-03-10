# 企业级 LLM 网关项目 - 完整分析与任务清单

## 📚 文档导航

本项目包含三份核心规划文档，请按顺序阅读：

### 1️⃣ **项目架构设计** (`architecture.md` - 项目根目录)
- **内容**: 企业级架构设计、技术栈选型、微服务分解、数据流设计
- **适合**: 架构师、技术负责人
- **关键信息**:
  - 核心技术栈: NestJS + PostgreSQL + Redis + Kafka + LiteLLM + Elasticsearch
  - 四层关键架构: 业务网关 → LiteLLM 代理 → 大模型提供商 → 审计计费
  - 五维限流: QPS / TPM / 并发 / 模型级 / IP 黑名单
  - 完整的 pnpm workspace 目录结构建议

### 2️⃣ **实施计划详细** (`implementation_plan.md` - 项目根目录)
- **内容**: 四个阶段的详细任务分解、验收标准
- **适合**: 项目经理、开发团队
- **关键信息**:
  - Phase 1 (MVP): 基础设施搭建、OpenAI 兼容路由、鉴权
  - Phase 2: 数据模型、五维限流、成本预估、DLP
  - Phase 3: Kafka 异步计费、Elasticsearch 日志、幂等消费
  - Phase 4: Admin 管理后台、Kubernetes 部署、压力测试验收

### 3️⃣ **TDD 测试规格** (`test_spec_tdd.md` - 项目根目录)
- **内容**: 四个阶段的测试规格、验证标准、运行命令
- **适合**: QA、测试工程师
- **关键信息**:
  - 单元测试、集成测试、E2E 测试分层
  - 关键功能的验收标准表格
  - 压力测试命令与预期指标

---

## 📋 详细任务清单（本文档目录）

### 📄 **DETAILED_TASK_LIST.md** (18KB)
**完整的项目任务检查清单，按 Phase 组织，包含 200+ 个具体任务项**

**结构**:
- 阶段一 (Phase 1): 工程初始化、基础路由、鉴权 → **验收标准 5 项**
- 阶段二 (Phase 2): 数据模型、五维限流、成本预估 → **验收标准 6 项**
- 阶段三 (Phase 3): Kafka 异步计费、Elasticsearch、对账 → **验收标准 4 项**
- 阶段四 (Phase 4): Admin API、Kubernetes、压力测试 → **验收标准 6 项**
- 测试覆盖: 单元 / 集成 / E2E / 压力测试分类
- 项目监控: Prometheus 指标、告警规则、日志聚合
- 交付清单: MVP vs 生产级交付物对比
- **关键决策表**: 架构选择与理由
- **风险矩阵**: 风险、影响、缓解方案

**用途**: 
```
✓ 当你需要查看某个具体的任务清单时
✓ 当你需要验收某个 Phase 的完成度时
✓ 当你需要与团队协调任务分配时
```

---

### 🎯 **PRIORITY_AND_ROADMAP.md** (11KB)
**详细的周度执行计划、优先级分级、并行机会与风险防控**

**结构**:
- 优先级分级: P0 / P1 / P2 / P3 定义与说明
- 周度计划 (12 周):
  - **W1**: pnpm 初始化、docker-compose、基础路由
  - **W2**: 鉴权、Trace-Id、基础限流
  - **W3**: 五维限流 Lua 脚本、成本预估
  - **W4**: Kafka 集成、异步计费
  - **W5**: Elasticsearch、Kibana、监控指标
  - **W6-7**: Circuit Breaker、熔断测试、Grafana
  - **W8-9**: Admin API、管理后台
  - **W10-12**: Kubernetes、Dockerfile、压力测试
- 每周关键交付物与验收标准
- 并行任务机会 (加快进度)
- 风险触发条件与应对方案
- 决策点与审查机制

**用途**:
```
✓ 当你需要了解完整的项目时间规划时
✓ 当你需要决定本周的工作重点时
✓ 当你需要评估风险与缓解策略时
```

---

## 🏗️ 项目核心信息速查表

### 核心技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **Web 框架** | NestJS | v9+ | 业务网关、Admin API、后台任务 |
| **语言** | TypeScript | 5.0+ | 全栈类型安全 |
| **数据库** | PostgreSQL | 14+ | 租户、Key、计费流水存储 |
| **缓存** | Redis Cluster | 7.0+ | 限流、鉴权缓存、分布式锁 |
| **消息队列** | Kafka | 3.0+ | 异步日志与计费 |
| **日志存储** | Elasticsearch | 8.0+ | 海量审计日志与全文检索 |
| **LLM 代理** | LiteLLM | 1.0+ | 统一模型适配与路由 |
| **容器编排** | Kubernetes | 1.24+ | 生产部署与自动扩缩容 |
| **包管理** | pnpm | 8.0+ | Monorepo 工作区管理 |

### 核心服务模块

```
llm-gateway-platform/
├── apps/
│   ├── api-gateway/          # 核心业务网关
│   │   ├── controllers/      # ChatController / ModelsController
│   │   ├── guards/           # AuthGuard / RateLimitGuard / QuotaGuard
│   │   ├── interceptors/     # GatewayInterceptor (流式统计)
│   │   └── services/         # CostEstimator / DLP / CircuitBreaker
│   ├── admin-api/            # 管理后台 REST API
│   │   ├── tenants/          # 租户 CRUD
│   │   ├── api-keys/         # Key 生成/轮转
│   │   ├── billings/         # 账单查询
│   │   └── routes/           # LiteLLM 路由动态修改
│   └── background-worker/    # 异步计费与日志消费
│       ├── kafka-consumer/   # 日志消息消费
│       ├── billing-engine/   # 计费逻辑 (事务 + 幂等)
│       └── cron-tasks/       # 每日对账与同步
├── libs/
│   ├── database/             # Prisma Schema + ORM 抽象
│   ├── redis/                # Redis 客户端 + 限流库
│   └── shared-types/         # DTO / Enums / Types
└── deploy/
    ├── docker/               # Dockerfile (多阶段构建)
    ├── k8s/                  # Kubernetes YAML / Helm Chart
    └── litellm-config.yaml   # LiteLLM 路由与 Provider 配置
```

### 数据库 Schema 核心表

| 表 | 主要字段 | 用途 |
|----|---------|------|
| **Tenant** | id / name / status | 项目组/租户管理 |
| **ApiKey** | id / tenant_id / key_hash / version | API 秘钥 + 版本控制 |
| **BillingRecord** | request_id / tenant_id / token_count / cost | 计费流水 (按日分区) |
| **RateLimitConfig** | tenant_id / dimension / limit / window | 五维限流配置 |

### 关键控制流

```
请求流程:
1. 业务应用 → 网关 (sk-gateway-xxx)
2. AuthGuard 验证 Key (Redis 缓存)
3. RateLimitGuard 五维限流 (Lua 原子操作)
4. WatermarkCheck 检查余额水位（放弃强一致性预扣，实施安全水位放行）
5. DLP 轻量安全扫描 (无二次请求)
6. 转发到 LiteLLM (带 Trace-Id)
7. LiteLLM 转发到实际 Provider (如 OpenAI)
8. 流式响应透传给业务方 (严禁重组)
9. 提取 Token Usage，投递到 Kafka
10. 后台消费者异步计费与结算

Response 路径:
Provider → LiteLLM → api-gateway → 业务应用
                        ↓
                   GatewayInterceptor
                        ↓
                   提取 usage、拦截 Token、投递 Kafka
                        ↓
                  background-worker
                        ↓
                   计费、更新余额、落盘 ES
```

---

## 🎯 快速开始指南

### 阅读顺序建议

**第一次接触项目** (15 分钟):
1. 本 README (你正在读)
2. `PRIORITY_AND_ROADMAP.md` 快速了解 12 周规划
3. `architecture.md` 深入理解架构

**准备开始开发** (2 小时):
1. `DETAILED_TASK_LIST.md` 找到当前 Phase 的任务列表
2. `implementation_plan.md` 了解该 Phase 的具体要求
3. `test_spec_tdd.md` 查看验收标准与测试方案

**遇到关键决策** (30 分钟):
1. `DETAILED_TASK_LIST.md` 中的"关键决策与风险控制"表
2. `PRIORITY_AND_ROADMAP.md` 中的"关键风险与防控"表

---

## 📊 项目规模评估

| 指标 | 数值 | 说明 |
|------|------|------|
| **总任务数** | 200+ | 包括 4 个阶段、4 类测试 |
| **总代码行数 (预估)** | 20K-30K | NestJS + Node.js + TypeScript |
| **核心依赖数** | 50+ | npm 包 (含 NestJS / Prisma / Kafka 等) |
| **数据库表数** | 10+ | 含分区表与索引 |
| **Kubernetes 资源** | 20+ | Deployment / Service / Configmap / Secret 等 |
| **预计团队规模** | 4-6 人 | 1 架构师 + 2-3 后端 + 1-2 测试 + 1 运维 |
| **预计时间 (周)** | 10-12 | 取决于团队经验与资源投入 |

---

## ⚠️ 关键点强调

### 🔴 **必须做对的事** (这些直接影响生产稳定性)

1. **Token 计费不能有遗漏**
   - 使用 Provider 的真实 `usage` 字段，废弃 Tiktoken 估算
   - 流式异常断流时必须有 Fallback 补差机制
   - 每日对账发现差异立即告警

2. **并发释放必须精确**
   - Streaming 生命周期末尾绑定释放逻辑，防泄漏
   - 单测覆盖边界场景 (异常、超时、客户端断开)

3. **消费幂等性必须保证**
   - 基于 `requestId` 的唯一约束防重入
   - 基于 Redis Lua 保证扣费原子性，并异步批量落库
   - Mock 测试重复消费同一消息

4. **不能阻塞主链路**
   - DLP 安全扫描必须异步可降级，故障不能阻断业务
   - Kafka 投递非阻塞，日志丢失不能导致网关故障
   - 所有外部调用都要有 timeout

5. **熔断与降级要可靠**
   - Circuit Breaker 状态转移要准确
   - 单节点并发不能超限，超限返回 503
   - Redis 故障时要能快速恢复 (本地缓存降级)

### 🟡 **需要提前规划的事** (这些影响架构扩展性)

1. 数据库表的分区策略 (BillingRecord 按日期分区)
2. Redis Cluster 的槽位分配与扩容计划
3. Elasticsearch 的索引生命周期与冷热分层
4. Kubernetes 的资源配额与网络策略

### 🟢 **可以后续优化的事** (可延后迭代)

1. 智能路由 (根据 Prompt 长度分配高阶/平价模型)
2. 模型健康评分与自动降权
3. Prompt 工程中台化与 AB 测试
4. OpenTelemetry/Jaeger 完整追踪 (初期可省略)

---

## 🤝 协作建议

### 与团队同步进度

- **周会议题**: 上周 Phase 进度 → 本周 Phase 任务 → 风险阻塞
- **Daily Standup**: 检查昨日任务完成度，同步 Blocker
- **Code Review**: 所有 PR 必须通过架构师 / 高级工程师审查

### 测试验收标准

- 每个 Phase 必须达到 **>=85% 的验收标准** 才能进入下一 Phase
- 所有 P0/P1 任务的单测 / 集成测试必须通过
- 压力测试 (P95 延迟、吞吐量) 必须达到基线指标

### 文档更新

- 随着开发进度更新相关文档 (特别是架构、API、部署指南)
- 每周末更新 `PRIORITY_AND_ROADMAP.md` 的实际进度
- 最终交付时完整的 Runbook 与故障处理手册

---

## 📞 常见问题速查

**Q: 为什么选择 NestJS 而不是 FastAPI？**  
A: 企业级特性 (DI/Guards/Interceptors)、TypeScript 类型安全、Monorepo 成熟支持。FastAPI 性能高但在架构灵活性上不足。

**Q: 为什么要分离 background-worker？**  
A: 异步计费与日志消费不能阻塞主网关流量。单独服务便于独立扩容、故障隔离、灰度发布。

**Q: 为什么 Redis 采用 Cluster 而非 Sentinel？**  
A: 在高吞吐限流场景下，Cluster 的分布式写入性能更强，避免单点热key 瓶颈。

**Q: DLP 为什么不用大模型二次判断？**  
A: 成本与延迟太高。轻量正则/规则足以拦截 90% 的 PII 泄露与 Prompt Injection。

**Q: 如何处理流式意外断流的计费？**
A: 水位校验 + Fallback 估算。根据安全水位放行，异常中断时按接收长度估算最终补差扣除。

---

## 📌 版本与变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-02-28 | 初版发布，包含 4 Phase 的完整规划 |

---

**项目所有者**: CTO  
**最后更新**: 2026-02-28 07:47 UTC  
**维护状态**: 🟢 Active  

---

💡 **提示**: 使用 `ctrl+y` 在编辑器中快速打开所有文档进行快速参考。
