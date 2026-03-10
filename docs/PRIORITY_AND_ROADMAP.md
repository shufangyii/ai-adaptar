# LLM Gateway 项目 - 优先级与执行路线图

## 📊 优先级分级体系

### P0 - 关键阻塞（必做）
这些任务直接影响项目可行性，必须首先完成，才能推进后续开发。

### P1 - 核心功能（高优先级）
这些任务构成 MVP 的核心功能，应在 Phase 1-2 内完成。

### P2 - 增强功能（中优先级）
这些任务提升系统的可靠性与运维性，应在 Phase 3-4 内完成。

### P3 - 优化与治理（低优先级）
这些任务提升系统的智能化与成本优化，可延后迭代。

---

## 🎯 执行优先级排序

### 第一周：工程搭建与基础路由（Week 1）

**目标**: 拉起完整的本地开发环境，实现最小化 MVP

| 优先级 | 任务 | 预计工作量 | 关键依赖 |
|--------|------|----------|---------|
| **P0** | 初始化 pnpm workspace 与 NestJS 应用 | 2-3h | 无 |
| **P0** | 编写 docker-compose.yml (dev profile) | 2-3h | pnpm 初始化 |
| **P0** | 编写 LiteLLM config.yaml 基础配置 | 1h | docker-compose |
| **P1** | 实现基础 ChatController 与请求转发 | 3-4h | 上述完成 |
| **P1** | 实现流式 SSE 透传逻辑 | 2-3h | ChatController |
| **P1** | 配置 NestJS HttpModule 与超时控制 | 2h | ChatController |
| **P1** | 编写 E2E 测试验证完整链路 | 2h | 上述完成 |

**Week 1 验收**:
```
✓ pnpm workspace 初始化完成
✓ docker-compose up -d 成功启动本地环境
✓ npm run start:dev api-gateway 启动成功
✓ curl 请求能收到 LiteLLM 流式回复
✓ E2E 测试通过率 >= 80%
```

---

### 第二周：鉴权与基础限流（Week 2）

**目标**: 实现 API Key 鉴权与初步的限流保护

| 优先级 | 任务 | 预计工作量 | 关键依赖 |
|--------|------|----------|---------|
| **P0** | 初始化 Prisma 与 PostgreSQL 连接 | 2h | docker-compose |
| **P0** | 设计与迁移核心数据库 Schema (Tenant/ApiKey) | 2h | Prisma |
| **P1** | 实现 AuthGuard (JWT + Header 解析) | 3h | Prisma |
| **P1** | 实现 API Key Hash 存储与校验 | 2h | AuthGuard |
| **P1** | 集成 OpenTelemetry 并注入 Trace-Id | 2h | api-gateway |
| **P1** | 实现基础 QPS 限流 (Redis + 简单计数器) | 3h | Redis 连接 |
| **P1** | 创建 RateLimitGuard 并集成 | 2h | 基础限流 |
| **P2** | 编写认证与限流的单元测试 | 2-3h | 上述完成 |

**Week 2 验收**:
```
✓ PostgreSQL 中 Tenant/ApiKey/BillingRecord 表成功创建
✓ 无 Key 或错误 Key 的请求返回 401
✓ 合法 Key 请求通过鉴权
✓ 超限请求返回 429
✓ 所有请求包含 Trace-Id Header
✓ 单元测试通过率 >= 90%
```

---

### 第三周：五维限流与成本预估（Week 3）

**目标**: 实现完整的五维限流与前置成本预估机制

| 优先级 | 任务 | 预计工作量 | 关键依赖 |
|--------|------|----------|---------|
| **P0** | 编写 Redis Lua 脚本 (Token Bucket) | 4h | Redis 连接 |
| **P0** | 实现五维限流维度与拦截逻辑 | 4h | Lua 脚本 |
| **P1** | 实现 Streaming 生命周期的并发释放 | 3h | 五维限流 |
| **P1** | 实现余额水位校验与安全放行 | 3h | Prisma + Redis 余额表 |
| **P1** | 取消强制预扣，实现防超支兜底机制 | 2h | 水位校验 |
| **P2** | 轻量 DLP 引擎 (正则扫描) | 3h | api-gateway |
| **P2** | 编写限流与成本的集成测试 | 3h | 上述完成 |

**Week 3 验收**:
```
✓ 五维限流完整可用，429 返回准确
✓ 并发限制精确释放，无泄漏
✓ 低余额请求被水位校验拦截，返回 402
✓ 不再强制冻结，采用兜底机制防超支
✓ DLP 检测 PII/Injection 但不阻断主流
✓ 集成测试通过率 >= 85%
```

---

### 第四周：Kafka 与异步计费（Week 4）

**目标**: 建立完整的异步日志与计费闭环

| 优先级 | 任务 | 预计工作量 | 关键依赖 |
|--------|------|----------|---------|
| **P0** | docker-compose 添加 Kafka + Zookeeper | 2h | docker-compose |
| **P0** | NestJS 集成 Kafka Producer | 2h | Kafka 启动 |
| **P1** | 实现 CallLog 消息结构化与发送 | 2h | Kafka Producer |
| **P1** | 在 GatewayInterceptor 中投递日志 | 2h | Interceptor |
| **P1** | 创建 background-worker 应用框架 | 2h | pnpm workspace |
| **P1** | 实现 Kafka Consumer 与消息处理 | 3h | background-worker |
| **P1** | 实现计费逻辑 (Redis 准实时 + PG 异步批处理) | 3h | Consumer |
| **P2** | 实现每日对账 Cron Job | 2h | 计费逻辑 |
| **P2** | 编写消费与幂等性的单元测试 | 2h | 上述完成 |

**Week 4 验收**:
```
✓ Kafka 集群成功启动
✓ 日志消息成功投递到 Topic
✓ Consumer 成功消费消息
✓ BillingRecord 表中有新的计费记录
✓ 租户余额被正确扣除
✓ 重复消息不导致重复扣费 (幂等性)
✓ 对账 Job 成功执行
```

---

### 第五周：Elasticsearch 与审计日志（Week 5）

**目标**: 实现完整的海量日志检索与可观测性

| 优先级 | 任务 | 预计工作量 | 关键依赖 |
|--------|------|----------|---------|
| **P1** | docker-compose 添加 Elasticsearch + Kibana | 2h | docker-compose |
| **P1** | Consumer 中集成 ES Client | 2h | background-worker |
| **P1** | 设计与创建 ES Index Mapping | 2h | ES 启动 |
| **P1** | 实现脱敏与结构化日志写入 | 2h | Consumer |
| **P2** | 配置 ILM 生命周期管理 | 2h | ES Index |
| **P2** | 配置冷热分层策略 | 1h | ILM |
| **P2** | 在 Kibana 中验证日志检索 | 1h | 上述完成 |
| **P3** | 建立 Prometheus 监控指标 | 3h | api-gateway |
| **P3** | 编写 E2E 日志查询测试 | 2h | 上述完成 |

**Week 5 验收**:
```
✓ Elasticsearch 与 Kibana 成功启动
✓ 日志成功写入 ES
✓ Kibana 能按 TraceId / TenantId 检索日志
✓ ILM 配置成功，索引自动轮转
✓ 冷热分层生效，旧索引下沉
✓ Prometheus 指标已暴露
```

---

### 第六-七周：Circuit Breaker & 熔断测试（Week 6-7）

**目标**: 实现高可用与容灾机制

| 优先级 | 任务 | 预计工作量 | 关键依赖 |
|--------|------|----------|---------|
| **P1** | 集成 opossum Circuit Breaker 库 | 2h | api-gateway |
| **P1** | 配置 CB 参数与状态转移逻辑 | 2h | opossum |
| **P1** | 实现单节点最大并发限制 | 2h | api-gateway |
| **P2** | 模拟 LiteLLM 故障，验证 CB 工作 | 2h | 上述完成 |
| **P2** | 编写断路器的状态转移测试 | 2h | 单元测试 |
| **P3** | 构建 Grafana 看板监控系统健康度 | 3h | Prometheus |
| **P3** | 编写压力测试脚本 (使用 k6) | 3h | 上述完成 |

**Week 6-7 验收**:
```
✓ 熔断器能正确切断故障 Provider 请求
✓ 故障恢复后自动恢复正常流量
✓ 单节点并发限制生效，超额返回 503
✓ Grafana 看板展示系统实时状态
✓ 压力测试下系统表现稳定
```

---

### 第八-九周：Admin API 与管理后台（Week 8-9）

**目标**: 完成管理员侧配置与审核

| 优先级 | 任务 | 预计工作量 | 关键依赖 |
|--------|------|----------|---------|
| **P1** | 创建 `admin-api` 应用框架 | 2h | pnpm workspace |
| **P1** | 实现租户管理 CRUD 接口 | 2h | Prisma |
| **P1** | 实现 API Key 生成/轮转/撤销 | 2h | admin-api |
| **P1** | 实现配额分配与查询接口 | 2h | admin-api |
| **P1** | 实现账单查询与成本分析接口 | 2h | admin-api |
| **P1** | 实现 LiteLLM 路由权重动态修改 | 2h | admin-api |
| **P2** | 权限与审计日志 (RBAC) | 2h | admin-api |
| **P2** | 编写 admin-api 的 E2E 测试 | 2h | 上述完成 |

**Week 8-9 验收**:
```
✓ 能通过 API 完成租户创建
✓ 能生成新 API Key 并分配配额
✓ 能查询与统计租户的成本明细
✓ 能动态修改 LiteLLM 路由权重
✓ Admin 操作被完整审计记录
```

---

### 第十-十二周：Kubernetes 部署与压测（Week 10-12）

**目标**: 完成生产环境部署与验收

| 优先级 | 任务 | 预计工作量 | 关键依赖 |
|--------|------|----------|---------|
| **P1** | 编写多阶段 Dockerfile (api-gateway) | 2h | 上述完成 |
| **P1** | 编写多阶段 Dockerfile (background-worker) | 1h | 上述完成 |
| **P1** | 编写 Helm Chart (api-gateway) | 3h | Dockerfile |
| **P1** | 编写 Helm Chart (background-worker) | 2h | Dockerfile |
| **P1** | 配置 HPA 与 PDB | 2h | Helm Chart |
| **P2** | 配置高 replicas 及 readinessProbe for LiteLLM | 1h | Helm Chart |
| **P2** | 配置 ConfigMap & Secrets 管理 | 2h | Helm Chart |
| **P3** | **致命破坏压测 1** (Provider 5xx) | 3h | Helm Chart |
| **P3** | **致命破坏压测 2** (Kafka 堆积) | 3h | 同上 |
| **P3** | **致命破坏压测 3** (Redis 切主) | 3h | 同上 |
| **P3** | **致命破坏压测 4** (1000+ 并发) | 3h | 同上 |
| **P2** | 编写部署与运维文档 | 3h | 全部完成 |

**Week 10-12 验收**:
```
✓ Dockerfile 构建成功，镜像尺寸 <= 200MB
✓ Helm Chart 部署成功，所有 Pod 运行正常
✓ HPA 成功扩缩容 (基于 CPU/RPS)
✓ 四类压测全部通过
  - Provider 全部故障时系统返回明确错误
  - Kafka 堆积不影响网关性能
  - Redis 切主时短暂降级，快速恢复
  - 1000 并发下 P95 延迟增幅 <= 100ms
✓ 完整的部署 Runbook 与故障处理手册
```

---

## 🚀 快速参考：每周关键交付物

| 周 | 关键交付 | 验收标准 |
|----|---------|---------|
| W1 | MVP 原型 | 单个请求能通过网关转发成功 |
| W2 | 鉴权系统 | API Key 验证生效，401 返回正确 |
| W3 | 限流与成本 | 429 与 402 拦截准确 |
| W4 | 异步计费 | 计费流水正确记录，幂等性验证 |
| W5 | 可观测性 | 日志能在 Kibana 中检索，指标暴露 |
| W6-7 | 高可用 | 熔断器工作，并发限制生效 |
| W8-9 | 管理后台 | Admin API 完整，配置可动态修改 |
| W10-12 | 生产部署 | Kubernetes 部署成功，四类压测通过 |

---

## 💡 并行任务机会

以下任务可与前面阶段并行进行，加快整体进度：

1. **单元测试编写**: 可在任何开发任务完成后立即编写，无需等待集成
2. **文档撰写**: 每周可同步更新架构文档、API 文档、运维指南
3. **镜像优化**: Week 5 开始可并行开始 Dockerfile 优化
4. **监控告警**: Week 5 完成 ES 后，可并行配置 Prometheus & Grafana
5. **性能基线**: Week 4 就可以开始做初步的负载测试，为 Week 10 的压测奠基

---

## ⚠️ 关键风险与防控

| 风险 | 触发条件 | 应对方案 |
|------|---------|---------|
| 时间超期 | 任何阶段超期超过 50% | 评估是否可延后 P2/P3 功能，优先交付 P0/P1 |
| Token 计费错误 | Phase 3 测试失败 | 回到 Phase 3 逐步排查，必要时重设计计费逻辑 |
| 数据丢失 | Phase 3 Kafka 丢消息 | 立即检查 Producer 幂等配置，必要时启用 Exactly Once |
| 性能不达标 | Phase 4 压测 P95 > 600ms | 增加 LiteLLM 和 api-gateway 副本数，优化 Redis 批量操作 |
| 部署失败 | Phase 4 Helm 部署异常 | 采用蓝绿部署，保留上一版本快速回滚 |

---

## 📞 决策点与审查机制

每个 Phase 完成后必须进行决策审查：

- **Phase 1 审查** (Week 1 末): 确认 MVP 可行，是否继续 Phase 2
- **Phase 2 审查** (Week 3 末): 确认限流逻辑正确，是否可进入 Phase 3
- **Phase 3 审查** (Week 5 末): 确认计费零遗漏，审计日志完整
- **Phase 4 审查** (Week 12 末): 四类压测全部通过，确认可上线

---

**优先级定义最后更新**: 2026-02-28  
**适用范围**: LLM Gateway 整个项目周期
