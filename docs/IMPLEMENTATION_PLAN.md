# LLM Gateway 实施计划与详细任务清单 (Implementation Plan & Task List)

本项目旨在基于 NestJS 和 LiteLLM 构建企业级大模型网关。以下是详细的实施步骤和验证计划。

## 阶段一：基础设施搭建与 MVP (Phase 1: Infrastructure & MVP)

**目标**：拉起本地开发环境，实现最基础的“请求 -> 鉴权 -> LiteLLM -> 模型”全链路打通。

### 1. 初始化 pnpm workspace 工程

- [ ] 按 `pnpm workspace` 规范初始化工作区 `llm-gateway-platform`。
- [ ] 结合 `@nestjs/cli` 创建核心应用 `api-gateway`。
- [ ] 配置根目录 `pnpm-workspace.yaml`, `package.json`, `tsconfig.json`, `nest-cli.json` 以及基础的 ESLint/Prettier。

### 2. 本地基础设施容器化 (Docker Compose)

- [ ] 编写 `docker-compose.yml`，**建议配置 Profiles (如 dev / full) 分离拉起**，核心组件包含：
  - PostgreSQL (数据库)
  - Redis (缓存与限流)
  - Kafka & Zookeeper/KRaft (消息队列，必选，仅在 full profile 下启动)
  - Elasticsearch (日志存储，仅在 full profile 下启动)
  - LiteLLM Proxy (模型代理)
- [ ] 编写 `litellm-config.yaml` 基础配置文件。**必须强制设置：`timeout`, `max_retries`，以及为每个 provider 单独配置 QPS 上限**。同时开启 `stream_options: { include_usage: true }`，配置至少两个带权重的 Provider 用于同一个模型池。

### 3. 核心网关服务 (Gateway Service) - 基础路由

- [ ] 设计通用的 OpenAI 兼容路由控制器 (`ChatController`, `ModelsController`)。
- [ ] 使用 `HttpModule` 或原生 Node 请求库透传给内网 LiteLLM Proxy。**所有请求必须带上唯一的 `request-id`。网关层必须强制统一设置下游超时 (如 30s 硬切断)**。
- [ ] **全局熔断**：在网关层引入 Circuit Breaker (**禁止自写，建议使用成熟库如 `opossum`**)，防止悬挂连接。且单节点**必须配置最大并发阈值**，防 Node 事件循环阻塞。
- [ ] **流式纯净透传**：实现 Server-Sent Events (SSE) 管道透传，**严禁在主链路做 JSON 拆解或组装重组，必须直接使用原生 Node.js 流 (`req.pipe(res)`) 跳过 NestJS 拦截器的多余对象封装开销，防高并发 OOM**。

### 4. 鉴权与中间件 (Authentication & Middleware)

- [ ] 引入 `Passport` 和 JWT 构建 AuthGuard。**所有 API Key 只存 Hash 不存明文，校验时必须带有版本号以支持紧急强制失效。**
- [ ] 在网关拦截校验 `Authorization: Bearer sk-...` Header。所有的全量权限与路由规则配置**必须支持热更新或动态加载**。
- [ ] **追踪体系接入**：配置 OpenTelemetry 生成下发统一 `Trace-Id` (**该 ID 后续必须能够贯穿 MQ 抵达消费者**)。

**验证计划 (Phase 1 Verification)**:

- 启动 `docker-compose up -d`，确保所有组件正常运行。
- 启动 NestJS 服务 `npm run start:dev api-gateway`。
- 发送带有合法 API Key 的 cURL 请求给网关，验证是否能成功收到大模型的流式回复。
- 发送无 Key 或错误 Key 的请求，验证 401 Unauthorized 拦截。
- （自动化测试）编写基础的 E2E 测试，模拟客户端请求鉴权和路由转发。

---

## 阶段二：数据模型、限流与配额管理 (Phase 2: Database, Rate Limiting & Quotas)

**目标**：引入真正的数据落地，实现多租户隔离，并能够根据配置进行五维速率限制、基于模型及 Prompt 的执行前成本预估，以及全链路安全审查。

### 1. 数据库集成 (Prisma + PostgreSQL)

- [ ] 初始化 Prisma (`npx prisma init`) 并连接 PG。**如果使用 PostgreSQL 主从架构，需在 AppModule 中明确读写分离策略**。
- [ ] 设计 Schema 模型，结合**表分区设计**（如 `BillingRecord` 强制按日期分区），包含：
  - `Tenant` (租户/项目组)
  - `ApiKey` (API 秘钥 Hash，关联租户，含失效版本号)
  - `BillingRecord` (计费流水表)
- [ ] 运行 Prisma Migration 应用数据库变更。

### 2. 缓存层集成 (Redis Cluster)

- [ ] 将 API Key 权限等缓存到 Redis 中（**建议采用 Redis Cluster 替代 Sentinel 防单点写热点**）。
- [ ] **所有写入 Redis 的鉴权与路由缓存，必须强制附带 TTL 保底**，避免失效机制故障导致死数据长期存在。

### 3. 基于 Redis Lua 的五维限流 (Rate Limiting 2.0)

- [ ] 编写支持 Token Bucket 算法的 Lua 原子脚本，且每次执行必须刷新 TTL，并附带剩余额度作为监控指标输出。
- [ ] 设计五层拦截维度：(1)API Key QPS, (2)Project TPM, (3)并发连接, (4)特定模型 QPS, (5)IP黑名单。
- [ ] **防突刺与内存释控**：TPM 的桶设计强制采用滑动窗口结合分段桶。**所有基于并发数的限流，必须绑定 Streaming 的结束事件 (`end` / `close` / `error`) 来精确释放**。

### 4. 基于安全阈值的余额检查与 DLP (Balance Check & DLP)

- [ ] **水位阈值检查**：放弃精准预扣机制，仅在网关层做极轻量的并发数限制与 Token 余额水位校验。只要租户可用余额大于安全阈值直接放行。
- [ ] **安全防线 (DLP)**：开发脱离大模型二次耗时依赖的极轻量正则/规则扫描引擎。如果扫描挂了进行优雅降级（不阻断正常业务）。**严禁其在网关主链路上出现二次网络请求嵌套**。

**验证计划 (Phase 2 Verification)**:

- 在数据库中手动创建测试租户和 API Key。
- 配置极低的 Rate Limit（例如 2 req/min），发送超过该频率的请求，验证是否返回 429。
- 将某租户的配额标记为 0，发送请求，验证是否返回配额不足提示。
- （自动化测试）编写基于 Testcontainers 或 Mock Redis 的集成测试，验证并发度限制的准确性。

---

## 阶段三：可观测性、异步计费与审计日志 (Phase 3: Observability & Asynchronous Logging)

**目标**：精准统计 Token 消耗，不阻塞主流程地将海量日志落入 ES，并异步完成计费闭环。

### 1. Token 统计与响应拦截

- [ ] 在 `api-gateway` 中编写全链路拦截器 (`GatewayInterceptor`)。
- [ ] **流式精确 Token 统计**：废弃使用 Tiktoken 全量解析以保 Node 性能。依赖 Provider 返回的真实 `usage`。**同时必须为 Streaming 异常断流场景封装兜底的 fallback 估算公式**。

### 2. Kafka 高级集成 (Enterprise Message Broker)

- [ ] 配置 NestJS 连接 Kafka。**Producer 必须开启幂等写入 (`enable.idempotence=true`)**。
- [ ] 组装纯结构化的 JSON Payload，**严禁单纯使用 `ProjectId` 导致热点分布，必须以 `hash(projectId + traceId)` 作为 Partition Key 将请求打散到不同分区**，设计健壮的 Dead Letter Queue 预防毒消息锁区。

### 3. 后台消费者微服务 (Log Consumer Worker)

- [ ] 创建新的 NestJS App（如 `background-worker`）。
- [ ] 监听上述 MQ 的队列。接收消息后执行以下操作：
  - 计算本次调用的消费金额 (依据使用的模型和 Token 量)。
  - **基于 Redis 的准实时落账与 PG 异步批量刷盘**：放弃在高并发消费链路使用 PostgreSQL 的行级锁 (`SELECT ... FOR UPDATE`)。改用 **Redis Lua 脚本**做高性能原子额度扣减。定期（如 1 分钟/批量 1000 条）执行 Batch Update 归档至 PostgreSQL 账单数据库中。**基于 `requestId` 的唯一性约束做防重入幂等校验**。后台设立 Cron Job 每日跑一次对账单 Reconciliation。
  - **Elasticsearch 集成**：剔除消耗容量的完整 Prompt 原文，仅将部分哈希结果、打标及元数据以结构化 JSON 写入 ES。**运维测必须立刻为索引配置：ILM 生命周期、时序冷热节点分层以及按日期的 Index Rollover 防硬盘崩溃**。

**验证计划 (Phase 3 Verification)**:

- 模拟一次完整的长对话向网关发送请求。
- 检查消息队列控制台，确认有消息被放入队列并被消费掉。
- 连接 PostgreSQL 数据库，核对对应账号的余额是否确实扣除了相应的 Token 费用。
- 连接 Kibana (对接 ES)，搜索对应的 TraceId，确认能查阅到带有详细耗时及 Token 统计的调用日志。
- （自动化测试）编写消费者服务的单元测试，Mock MQ 输入，验证计费计算逻辑与数据更新逻辑。

---

## 阶段四：管理后台系统与生产部署 (Phase 4: Admin API & Production Deployment)

**目标**：提供供前端使用的管理接口，提供 AI 中台高阶治理能力（路由引擎/Prompt 中心），准备 K8s 部署生产资产。

### 0. 架构演进路线池 (智能路由与健康体系)

- [ ] **建立模型监控指标 (SLA 看板)**：提供针对 Latency / Error Rate / Cost 的看板与异步巡查机制（不在主链路做统计阻塞）。
- [ ] **动态路由体系**：实现路由降权机制，**任何涉及到动态权重的修改，必须能做成热刷而不必滚动重启系统**。
- [ ] **Prompt 工程中台化**：构建支持独立运营的微服务。

### 1. 管理后台服务 (Admin API Service)

- [ ] 创建 `admin-api` 应用提供 RESTful 配置下发。涉及配置库如需脱敏数据（如 API 秘钥本体）的读取解密。
- [ ] 所有的系统核心 Secret 将直接从 K8s Secrets 或公有云的 KMS 挂载，不写在配置中心明文中。

### 2. 容器化构建与终态演习 (DevOps & Stress Testing)

- [ ] 完善多阶段 Dockerfile，**保证 Runtime 镜像彻底剔除 Dev 依赖**，并在 Docker 侧制定 CPU Limit / Memory Limit。
- [ ] 在 K8s Yaml 或 Helm Chart 中，对网关与后台服务**配置 HPA (CPU+RPS) 及 PodDisruptionBudget**。对 LiteLLM Proxy，由于其 Python 单进程 GIL 限制，**强烈要求使用高 `replicas` 进行横向扩容**，而非单机大 CPU 垂直扩容。配置必须通过且苛刻的 `readinessProbe` 防盲目吸入流量。
- [ ] **上线前三类致命破坏验收压测**：
  1. 模拟全 Provider 全部报 `5xx` 错误下的可用性及退款链路状态分析。
  2. 构造压溃 ES/Log Consumer 导致 Kafka 破亿级堆积下的内存/积压场景反应。
  3. 进行一次彻底的 Redis Master 驱逐切主灾难演飞（观察缓存重建与持久化雪崩率）。
  4. 最终全链路 `1000+` 高并发的长文本 Streaming 防断流压测验收。

**验证计划 (Phase 4 Verification)**:

- 启动 `admin-api` 服务。
- 使用 Postman 或写脚本依次调用：创建新租户 -> 生成 Key -> 调用获取数据流 -> 查询后台扣费明细并对比一致性。
- （系统集成测试）在本地或测试环境拉起完整镜像堆栈，进行全量回归和压力测试 (使用类似 Vegeta 的工具生成打量请求)，确保在 1000 并发下系统的稳定性和低延迟。
