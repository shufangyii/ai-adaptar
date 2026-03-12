# LLM Gateway — 实施路线图与任务清单 (Roadmap & Task List)

> **唯一权威路线图**。本文档合并了原 IMPLEMENTATION_PLAN、PRIORITY_AND_ROADMAP、DETAILED_TASK_LIST 的全部内容。
> 架构设计细节请参阅 [ARCHITECTURE.md](./ARCHITECTURE.md)；测试规格请参阅 [TEST_SPEC_TDD.md](./TEST_SPEC_TDD.md)。

**最后更新**: 2026-03-10
**技术栈**: NestJS + TypeScript + PostgreSQL + Redis + Kafka + LiteLLM + Elasticsearch

---

## 📊 优先级分级

| 级别   | 含义                   | 阶段      |
| ------ | ---------------------- | --------- |
| **P0** | 关键阻塞，必须首先完成 | Phase 1   |
| **P1** | 核心功能，高优先级     | Phase 1–2 |
| **P2** | 增强功能，中优先级     | Phase 3–4 |
| **P3** | 优化与治理，可延后     | 后续迭代  |

---

## 🏗️ Phase 1：基础设施与 MVP（Week 1–2）

**目标**：拉起本地开发环境，实现"请求 → 鉴权 → LiteLLM → 模型"全链路打通。

### 1.1 工程初始化（Week 1 · P0 · 约 3h）

- [ ] 初始化 `pnpm-workspace.yaml`、根 `package.json`、`tsconfig.json`、`nest-cli.json`
- [ ] 配置 ESLint + Prettier 规范
- [ ] 使用 `@nestjs/cli` 创建 `api-gateway` 应用
- [ ] 初始化模块结构：`src/proxy/`、`src/guards/`、`src/interceptors/`、`src/modules/`
- [ ] 初始化共享库：`libs/database/`、`libs/redis/`、`libs/shared-types/`
- [ ] 编写 `.env.example` 环境变量模板

### 1.2 本地基础设施容器化（Week 1 · P0 · 约 4h）

- [ ] 编写 `docker-compose.yml`，配置 **dev / full** 两种 Profile：
  - dev：PostgreSQL + Redis + LiteLLM Proxy
  - full：追加 Kafka + Zookeeper + Elasticsearch + Kibana
- [ ] 编写 `litellm-config.yaml`：
  - [ ] 强制 `timeout: 30s`、`max_retries: 3`
  - [ ] 至少两个带权重的 Provider（如 OpenAI 60% + Azure 40%）
  - [ ] 为每个 Provider 配置独立 QPS 上限
  - [ ] 开启 `stream_options: { include_usage: true }`

### 1.3 核心网关路由（Week 1 · P1 · 约 8h）

- [ ] 设计 OpenAI 兼容路由控制器
  - [ ] `ChatController` 处理 `POST /v1/chat/completions`
  - [ ] `ModelsController` 处理 `GET /v1/models`
  - [ ] 请求自动生成唯一 `request-id`
- [ ] 实现请求转发逻辑
  - [ ] 使用 NestJS `HttpModule` 或 `axios` 透传到 LiteLLM
  - [ ] **强制下游超时 30s 硬切断**
  - [ ] 完整复制上游响应头与状态码
- [ ] **流式纯净透传与异常中断防范**
  - [ ] 使用原生 Node.js 流 (`stream.pipe(res)`) 传递 SSE
  - [ ] **检测客户端异常断连并触发布 `AbortController` 向上游发送取消信号**
  - [ ] **严禁在主链路做 JSON 拆解或组装，跳过 NestJS 拦截器序列化，防高并发 OOM**
- [ ] 编写 E2E 测试验证完整链路

### 1.4 鉴权与中间件（Week 2 · P1 · 约 8h）

- [ ] 初始化 Prisma (`npx prisma init`)，连接 PostgreSQL
- [ ] 设计核心 Schema 并运行 Migration：
  - [ ] **Tenant** (id, name, description, status, created_at, updated_at)
  - [ ] **ApiKey** (id, tenant_id, key_hash, name, version_number, status, created_at, expires_at)
  - [ ] **BillingRecord** (id, tenant_id, request_id, model_name, token_count_input, token_count_output, estimated_cost, actual_cost, status, created_at, processed_at) — **强制按日期分区**
  - [ ] **RateLimitConfig** (五维限流参数存储)
- [ ] 实现 **AuthGuard**
  - [ ] 集成 `@nestjs/passport` + JWT
  - [ ] 从 `Authorization: Bearer sk-xxx` 提取 Key
  - [ ] **API Key 只存 Hash**（bcrypt/argon2），校验带版本号支持强制失效
  - [ ] 验证失败返回 401 Unauthorized
- [ ] 实现基础 QPS 限流（Redis 简单计数器 + TTL）
- [ ] 创建 `RateLimitGuard` 并集成，超限返回 429

**Week 1-2 验收 (包含早期基准压测)**:

```
✓ docker-compose up -d 成功启动本地环境
✓ NestJS api-gateway 启动成功
✓ curl 请求能收到 LiteLLM 流式回复
✓ 客户端异常断连能触发上游停止生成
✓ 早期压测通过 (使用 k6 等工具发起如 500 并发的长文本流式请求打量，验证内存消耗与事件循环健康度，排查网络池复用与序列化瓶颈)
✓ 无 Key / 错误 Key 返回 401
✓ 超限请求返回 429
✓ E2E 测试通过率 >= 80%
```

---

## 🔐 Phase 2：多租户限流与配额管理（Week 3–4）

**目标**：实现五维限流、余额水位校验、DLP 安全扫描，以及熔断保护。

### 2.1 缓存层集成（Week 3 · P1 · 约 4h）

- [ ] 创建 Redis 连接单例工厂（推荐 Cluster 模式）
- [ ] 配置连接池参数与健康检查
- [ ] API Key 权限缓存到 Redis，**所有缓存强制附带 TTL**（推荐 1h）
- [ ] 实现缓存失效与同步机制

### 2.2 五维限流 Rate Limiting 2.0（Week 3 · P0 · 约 8h）

- [ ] 编写 Redis Lua 脚本（Token Bucket 原子操作，每次刷新 TTL）
- [ ] 五层拦截维度：
  - [ ] (1) API Key QPS
  - [ ] (2) Project TPM（滑动窗口 + 分段桶，防边界突刺）
  - [ ] (3) 并发连接数
  - [ ] (4) 特定模型 QPS
  - [ ] (5) IP 黑名单
- [ ] **并发释放**：绑定 Streaming `end`/`close`/`error` 事件精确释放，防泄漏
- [ ] 创建 `RateLimitGuard`，超限返回 429

### 2.3 余额水位校验与 DLP（Week 3 · P1 · 约 5h）

- [ ] **水位阈值检查**：查 Redis 余额，余额 > 安全阈值则放行，低于阈值返回 402
  - [ ] 放弃精准预扣冻结，采用轻量水位校验
- [ ] **轻量 DLP 引擎**（正则/规则扫描）
  - [ ] 检测 PII（邮箱、电话、身份证）
  - [ ] 检测 Prompt Injection 攻击特征
  - [ ] **挂掉时优雅降级，不阻断主流量**
  - [ ] **严禁主链路出现二次网络请求嵌套**

### 2.4 全局熔断（Week 4 · P1 · 约 4h）

- [ ] 集成 Circuit Breaker（推荐 `opossum`）
- [ ] 配置单节点最大并发阈值，防 Node 事件循环阻塞
- [ ] 超阈值返回 503 Service Unavailable
- [ ] 编写熔断器状态转移测试

### 2.5 全链路追踪（Week 4 · P2 · 约 2h）

- [ ] 集成 OpenTelemetry，生成统一 `Trace-Id`
- [ ] Trace-Id 必须贯穿 MQ 抵达消费者

### 2.6 验证计划

- [ ] 手动：配置极低 Rate Limit (2 req/min)，验证 429
- [ ] 手动：标记租户配额为 0，验证 402
- [ ] 自动化：基于 Testcontainers 的 Redis 集成测试
- [ ] 自动化：验证并发度限制准确性与 TTL 续期

**Week 3-4 验收**:

```
✓ 五维限流完整可用，429 返回准确
✓ 并发限制精确释放，无泄漏
✓ 低余额请求被水位校验拦截，返回 402
✓ DLP 检测 PII/Injection 但不阻断主流
✓ 熔断器能正确切断故障请求，恢复后自动恢复
✓ 集成测试通过率 >= 85%
```

---

## 📊 Phase 3：可观测性、异步计费与审计日志（Week 5–7）

**目标**：精准统计 Token 消耗，异步计费闭环，海量日志落 ES。

### 3.1 Token 统计与原生流拦截（Week 5 · P1 · 约 4h）

- [ ] 实现原生的 Node.js 响应流监听器（不要使用标准的 NestJS Interceptor 拦截器，以防触发序列化导致内存爆炸）
- [ ] 在 `stream.pipe()` 透传数据的同时，监听并提取 Provider 返回的真实 `usage` JSON 块
  - [ ] **废弃 Tiktoken，完全信任 Provider usage**
- [ ] 异常断流 Fallback 估算：
  - [ ] 流意外中断时按已接收内容保守估算
  - [ ] 标记 `status: ESTIMATED`，记录异常日志
  - [ ] 等待每日对账修正

### 3.2 Kafka 集成（Week 5 · P0 · 约 6h）

- [ ] docker-compose 添加 Kafka + Zookeeper
- [ ] NestJS 集成 Kafka Producer（`kafkajs` 或 `nestjs-kafka`）
  - [ ] `enable.idempotence=true`（幂等写入）
  - [ ] `acks=all`（写入确认）
- [ ] 定义 CallLog 消息 DTO
  - [ ] **Partition Key**：使用 `hash(projectId + traceId)` 打散防热点
  - [ ] 包含 request_id、trace_id、model_name、token_count、cost、timestamp
- [ ] 创建 DLQ Topic 接收失败消息
- [ ] 在提取出 usage 后，异步投递日志，**非阻塞主流程**

### 3.3 后台消费者（Week 6 · P1 · 约 8h）

- [ ] 创建 `background-worker` NestJS 应用
- [ ] 实现 Kafka Consumer 监听日志 Topic
- [ ] **计费逻辑**：
  - [ ] 计算消费金额（模型 + Token 数）
  - [ ] **放弃 PG 行级锁**，使用 Redis Lua 原子扣减余额
  - [ ] 后台定时 Batch Update 归档至 PostgreSQL
  - [ ] 基于 `requestId` 唯一性约束做幂等校验
- [ ] 每日对账 Cron Job：对比 Provider 账单 vs 本地 BillingRecord，差异告警

### 3.4 Elasticsearch 集成（Week 7 · P1 · 约 6h）

- [ ] docker-compose 添加 Elasticsearch + Kibana
- [ ] Consumer 中集成 ES Client
- [ ] 设计 ES Index Mapping（仅元数据，**剔除完整 Prompt 原文**）
- [ ] 配置 ILM 生命周期 + 冷热分层 + 按日期 Index Rollover

### 3.5 监控指标（Week 7 · P3 · 约 3h）

- [ ] 建立 Prometheus 指标（请求数/延迟/错误率/Token 消耗/限流拒绝/Kafka LAG）
- [ ] 配置告警规则：错误率 > 1%、P99 > 500ms、Kafka 堆积 > 10w

**Phase 3 验收**:

```
✓ 日志消息成功投递 Kafka 并被消费
✓ BillingRecord 表中有计费记录，余额被正确扣除
✓ 重复消息不导致重复扣费（幂等性）
✓ Kibana 能按 TraceId / TenantId 检索日志
✓ ILM 配置成功，索引自动轮转
✓ 对账 Job 成功执行
```

---

## 🎯 Phase 4：管理后台与生产部署（Week 8–12）

**目标**：Admin API、K8s 部署、压力测试验收。

### 4.1 管理后台 Admin API（Week 8–9 · P1 · 约 16h）

- [ ] 创建 `admin-api` NestJS 应用
- [ ] JWT 认证 + RBAC 权限角色管理
- [ ] 核心接口：
  - [ ] 租户 CRUD
  - [ ] API Key 生成 / 轮转 / 撤销
  - [ ] 配额分配与查询
  - [ ] 账单查询与成本分析
  - [ ] LiteLLM 路由权重动态修改（**热刷无需重启**）
- [ ] 审计日志：记录所有管理操作
- [ ] Secret 管理：从 K8s Secrets 或云 KMS 挂载，不写明文
- [ ] 动态配置热更新：支持权限规则动态加载

### 4.2 容器化与 K8s 部署（Week 10–11 · P1 · 约 12h）

- [ ] 多阶段 Dockerfile（**Runtime 镜像彻底剔除 Dev 依赖**），配置 CPU/Memory Limit
- [ ] Helm Chart：
  - [ ] **api-gateway**: HPA (CPU+RPS) + PDB + liveness/readiness probe
  - [ ] **background-worker**: 适当副本数 + 资源限制
  - [ ] **LiteLLM Proxy**: **高 replicas 横向扩容**（Python GIL 限制）+ 严格 readinessProbe + OOM Kill 防护
- [ ] ConfigMap + Secrets 管理
- [ ] Service / Ingress 服务发现

### 4.3 致命破坏压测（Week 11–12 · P2 · 约 12h）

- [ ] **压测 1**：全 Provider 返回 5xx → 验证熔断器 + 退款链路
- [ ] **压测 2**：停止 Consumer，Kafka 堆积 → 验证网关无影响 + 追赶恢复
- [ ] **压测 3**：Redis Master 故障切主 → 验证缓存重建 + 鉴权降级
- [ ] **压测 4**：1000+ 并发长文本 Streaming → P95 增幅 ≤ 100ms，无断流，计费无遗漏

**Phase 4 验收**:

```
✓ Admin API 全链路：创建租户 → 生成 Key → 调用网关 → 查询账单一致
✓ Dockerfile 构建成功，镜像 <= 200MB
✓ Helm Chart 部署成功，HPA 扩缩容正常
✓ 四类压测全部通过
✓ 完整的部署 Runbook 与故障处理手册
```

---

## 🚀 后续演进（Phase 5+）

| 方向        | 内容                                                     |
| ----------- | -------------------------------------------------------- |
| 智能路由    | Agent/Smart Router，按 Prompt 长度或业务性质自动分配模型 |
| 模型健康    | 基于 Latency + Error Rate 的评分机制，主动更新路由权重   |
| Prompt 中台 | 独立 Prompt Service，模板管理 + AB 测试注入              |
| 统一追踪    | OpenTelemetry/Jaeger 全链路 + mTLS 内网零信任            |

---

## 📅 周度快速参考

| 周     | 交付                | 验收标准                       |
| ------ | ------------------- | ------------------------------ |
| W1     | MVP 原型            | 请求通过网关成功转发 LiteLLM   |
| W2     | 鉴权 + 早基准压测   | 401/429 返回正确，性能摸底通过 |
| W3     | 五维限流 + 水位校验 | 429/402 准确，并发释放无泄漏   |
| W4     | 熔断 + Tracing      | Circuit Breaker 正确切断/恢复  |
| W5     | Kafka 集成          | 日志投递 + Consumer 消费正常   |
| W6     | 异步计费            | 余额扣除正确，幂等性通过       |
| W7     | ES + 监控           | Kibana 检索 + Prometheus 指标  |
| W8-9   | Admin API           | CRUD 完整，动态配置热刷        |
| W10-12 | K8s + 终极破坏测试  | 部署成功，四类压测通过         |

---

## ⚠️ 关键风险与防控

| 风险           | 触发条件            | 应对方案                                         |
| -------------- | ------------------- | ------------------------------------------------ |
| 时间超期       | 任何阶段超期 > 50%  | 延后 P2/P3，优先交付 P0/P1                       |
| Token 计费错误 | Phase 3 测试失败    | 逐步排查，必要时重设计计费逻辑                   |
| Kafka 数据丢失 | Producer 幂等未生效 | 检查幂等配置，必要时启用 Exactly Once            |
| 性能不达标     | P95 > 600ms         | 增加 LiteLLM + api-gateway 副本，优化 Redis 批量 |
| 部署失败       | Helm 异常           | 蓝绿部署，保留上版本快速回滚                     |

---

## 📞 决策审查机制

| 时间点     | 审查内容                                |
| ---------- | --------------------------------------- |
| Week 2 末  | MVP 全链路打通，确认可进入 Phase 2      |
| Week 4 末  | 限流 + 水位校验正确，确认可进入 Phase 3 |
| Week 7 末  | 计费零遗漏，审计日志完整                |
| Week 12 末 | 四类压测全部通过，确认可上线            |

---

## 🧪 测试覆盖

### 单元测试

- [ ] AuthGuard：各种 Key 格式与验证
- [ ] RateLimitGuard：Lua 脚本逻辑，边界情况
- [ ] CostEstimator：成本计算
- [ ] DLP Engine：正则匹配与 Fallback
- [ ] Circuit Breaker：状态转移

### 集成测试

- [ ] Redis + PostgreSQL 交互
- [ ] NestJS + Kafka 消息发送与消费
- [ ] Gateway + LiteLLM 代理转发与流式

### E2E 测试

- [ ] 完整请求链路：Client → Gateway → LiteLLM → Provider
- [ ] 流式响应完整性
- [ ] 异常处理：下游超时/错误的恢复

---

## 📝 核心架构决策

| 决策点   | 选择          | 理由                                   |
| -------- | ------------- | -------------------------------------- |
| Web 框架 | NestJS        | 企业级特性、DI、Guards/Interceptors    |
| 数据库   | PostgreSQL    | 高并发、JSONB、完整 ACID               |
| 缓存     | Redis Cluster | 高速读写、分布式一致性、避免单点写热点 |
| 消息队列 | Kafka         | 高吞吐、顺序消费、持久化               |
| LLM 适配 | LiteLLM       | 100+ 模型支持、开源成熟                |
| 日志存储 | Elasticsearch | 海量全文检索、聚合分析                 |
| 部署     | Kubernetes    | 容器编排、自动扩缩容                   |
