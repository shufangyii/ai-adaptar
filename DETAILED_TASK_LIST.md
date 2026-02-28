# 企业级 LLM 网关项目 - 详细任务清单

## 📋 项目概览

**项目名称**: llm-gateway-platform  
**项目目标**: 为公司内部多个项目组提供统一、安全、高可用的生产级 LLM 网关  
**技术栈**: NestJS + TypeScript + PostgreSQL + Redis + Kafka + LiteLLM + Elasticsearch  
**架构模式**: Microservices (Monorepo + pnpm workspace)

---

## 🏗️ 阶段一：基础设施搭建与 MVP (Phase 1)

### 1.1 工程初始化与工作区搭建

- [ ] **初始化 pnpm workspace**
  - [ ] 创建项目根目录 `llm-gateway-platform`
  - [ ] 初始化 `pnpm-workspace.yaml` 配置文件
  - [ ] 编写根目录 `package.json` (workspace 配置 + 公共依赖)
  - [ ] 配置 `tsconfig.json` (path aliases 指向各子包)
  - [ ] 配置 `nest-cli.json` 支持 monorepo 模式
  - [ ] 配置 ESLint + Prettier 规范

- [ ] **创建 NestJS 核心应用 `api-gateway`**
  - [ ] 使用 `@nestjs/cli` 创建应用框架
  - [ ] 初始化模块结构:
    - [ ] `src/proxy/` - LiteLLM 转发逻辑
    - [ ] `src/guards/` - 认证与限流守卫
    - [ ] `src/interceptors/` - 流式数据拦截与统计
    - [ ] `src/modules/` - 业务模块
  - [ ] 配置环境变量模板 (`.env.example`)

- [ ] **初始化共享库 `libs`**
  - [ ] `libs/database/` - Prisma schema 与 ORM 抽象
  - [ ] `libs/redis/` - Redis 客户端与公共缓存库
  - [ ] `libs/shared-types/` - 共用 DTO、Enums、类型定义

### 1.2 本地基础设施容器化

- [ ] **编写 docker-compose.yml**
  - [ ] 配置 PostgreSQL (dev profile)
  - [ ] 配置 Redis Standalone (dev profile)
  - [ ] 配置 Kafka + Zookeeper (full profile 可选)
  - [ ] 配置 Elasticsearch (full profile 可选)
  - [ ] 配置 LiteLLM Proxy 容器 (dev profile)
  - [ ] 添加 Profile 分离逻辑 (dev / full)
  - [ ] 编写启动脚本与健康检查

- [ ] **编写 LiteLLM 配置文件 (`litellm-config.yaml`)**
  - [ ] 配置 timeout (硬切断，推荐 30s)
  - [ ] 配置 max_retries (推荐 2-3 次)
  - [ ] 配置至少两个 Provider (如 OpenAI + Azure) 带权重
  - [ ] 为每个 Provider 配置独立 QPS 上限
  - [ ] 开启 `stream_options: { include_usage: true }`
  - [ ] 配置日志级别与 Debug 模式

### 1.3 核心网关服务 - 基础路由

- [ ] **设计 OpenAI 兼容路由控制器**
  - [ ] 创建 `ChatController` 处理 `/v1/chat/completions`
  - [ ] 创建 `ModelsController` 处理 `/v1/models` 列表
  - [ ] 支持流式 (streaming) 和非流式响应
  - [ ] 所有请求自动生成唯一 `request-id`

- [ ] **实现请求转发逻辑**
  - [ ] 使用 NestJS `HttpModule` 或 `axios` 透传到 LiteLLM
  - [ ] **强制设置下游超时 (30s 硬切断)**
  - [ ] 实现 Server-Sent Events (SSE) 管道，严禁主链路 JSON 拆解重组
  - [ ] 完整复制上游响应头与状态码

- [ ] **全局熔断与并发控制**
  - [ ] 集成成熟 Circuit Breaker 库 (推荐 `opossum`)
  - [ ] 配置单节点最大并发数阈值 (防 Node 事件循环阻塞)
  - [ ] 在连接超过阈值时返回 503 Service Unavailable
  - [ ] 编写熔断器监控与日志

### 1.4 鉴权与中间件

- [ ] **API Key 鉴权守卫 (AuthGuard)**
  - [ ] 集成 `@nestjs/passport` 与 JWT
  - [ ] 实现 `HeaderStrategy` 从 `Authorization: Bearer sk-xxx` 提取 Key
  - [ ] **所有 API Key 只存 Hash 不存明文** (使用 bcrypt 或 argon2)
  - [ ] 支持 Key 版本号机制以支持紧急强制失效
  - [ ] 验证失败返回 401 Unauthorized

- [ ] **全链路追踪体系**
  - [ ] 集成 OpenTelemetry 客户端
  - [ ] 为每个请求生成并下发统一 `Trace-Id`
  - [ ] **Trace-Id 必须贯穿 MQ 抵达消费者**
  - [ ] 配置 Jaeger 或其他追踪后端 (可选)

- [ ] **动态配置热更新**
  - [ ] 支持权限规则动态加载无需重启
  - [ ] 提供 Admin API 触发配置同步

---

## 🔐 阶段二：数据模型、限流与配额管理 (Phase 2)

### 2.1 数据库集成与多租户设计

- [ ] **初始化 Prisma**
  - [ ] `npx prisma init` 连接 PostgreSQL
  - [ ] 配置连接池与读写分离策略 (如有主从)
  - [ ] 生成 Prisma Client

- [ ] **设计与迁移数据库 Schema**
  - [ ] **Tenant 表** (租户/项目组)
    - [ ] id (UUID, PK)
    - [ ] name, description
    - [ ] status (active/suspended)
    - [ ] created_at, updated_at

  - [ ] **ApiKey 表** (API 秘钥)
    - [ ] id (UUID, PK)
    - [ ] tenant_id (FK)
    - [ ] key_hash (bcrypt hash, 唯一索引)
    - [ ] name, description
    - [ ] version_number (支持强制失效)
    - [ ] status (active/revoked)
    - [ ] created_at, expires_at

  - [ ] **BillingRecord 表** (计费流水，**强制按日期分区**)
    - [ ] id (UUID, PK)
    - [ ] tenant_id (FK)
    - [ ] request_id (唯一索引，幂等)
    - [ ] model_name, token_count_input, token_count_output
    - [ ] estimated_cost, actual_cost
    - [ ] status (pending/completed/refunded)
    - [ ] created_at, processed_at

  - [ ] **RateLimitConfig 表** (限流配置)
    - [ ] 五维限流参数存储

  - [ ] 运行 `prisma migrate dev` 应用 Schema 变更

### 2.2 缓存层集成

- [ ] **Redis 连接与初始化**
  - [ ] 创建 Redis 单例工厂 (推荐 Cluster 而非 Sentinel)
  - [ ] 配置连接池参数
  - [ ] 编写健康检查逻辑

- [ ] **API Key 权限缓存**
  - [ ] 从数据库加载 Key Hash，缓存到 Redis
  - [ ] **所有缓存强制附带 TTL** (推荐 1 小时)
  - [ ] 实现缓存失效与同步机制
  - [ ] 监控缓存命中率

### 2.3 五维限流实现 (Rate Limiting 2.0)

- [ ] **编写 Redis Lua 脚本**
  - [ ] 实现 Token Bucket 算法的原子脚本
  - [ ] 每次执行自动刷新 TTL
  - [ ] 输出剩余额度作为监控指标

- [ ] **五层拦截维度实现**
  - [ ] **(1) API Key QPS**: 单个 Key 每秒请求数
  - [ ] **(2) Project TPM**: 项目总 Token 使用率 (每分钟)
  - [ ] **(3) 并发连接**: 同时活跃的流式请求数
  - [ ] **(4) 模型级 QPS**: 特定模型的速率限制
  - [ ] **(5) IP 黑名单**: 源 IP 级别的拦截

- [ ] **并发释放机制**
  - [ ] **绑定 Streaming 结束事件** (`end` / `close` / `error`)
  - [ ] 精确释放并发计数，防泄漏
  - [ ] 编写单测验证释放逻辑

- [ ] **防突刺设计**
  - [ ] TPM 采用滑动窗口 + 分段桶算法
  - [ ] 避免时间边界导致的峰值突刺
  - [ ] 编写边界场景单测

- [ ] **创建 RateLimitGuard**
  - [ ] 集成到 `api-gateway` 的 HTTP 处理流程
  - [ ] 拦截超限请求返回 429 Too Many Requests

### 2.4 前置成本预估与 DLP

- [ ] **成本预估器 (Cost Estimator)**
  - [ ] 根据 Prompt 长度估算成本
  - [ ] **设置单次预估最大成本上限 Cap**
  - [ ] 在数据库中更新"冻结金额"做预扣定金
  - [ ] 预估失败返回 402 Payment Required
  - [ ] 编写单测覆盖边界场景

- [ ] **轻量级 DLP 引擎**
  - [ ] 开发脱离大模型二次耗时的正则/规则扫描
  - [ ] 检测 PII (邮箱、电话、身份证等)
  - [ ] 检测 Prompt Injection 攻击特征
  - [ ] **挂掉时进行优雅降级，不阻断正常业务**
  - [ ] **严禁在主链路出现二次网络请求嵌套**

### 2.5 验证计划 (Phase 2 Verification)

- [ ] **手动测试**
  - [ ] 创建测试租户和 API Key
  - [ ] 配置极低 Rate Limit (2 req/min)，验证 429 拦截
  - [ ] 标记租户配额为 0，验证余额不足提示
  - [ ] 发送超过 Cap 的请求，验证预估拒绝

- [ ] **自动化测试**
  - [ ] 基于 Testcontainers 的 Redis 集成测试
  - [ ] 验证并发度限制准确性 (并发数 +/-1)
  - [ ] 验证 TTL 自动续期机制
  - [ ] 验证幂等写入与防重入

---

## 📊 阶段三：可观测性、异步计费与审计日志 (Phase 3)

### 3.1 Token 统计与响应拦截

- [ ] **全链路拦截器实现**
  - [ ] 创建 `GatewayInterceptor` 拦截所有响应
  - [ ] 提取来自 Provider 的真实 `usage` 字段
  - [ ] **废弃 Tiktoken，完全信任 Provider 的 usage**
  - [ ] 编写流式 Token 统计逻辑

- [ ] **异常断流的 Fallback 估算**
  - [ ] 当流式意外中断时，根据已接收内容进行估算
  - [ ] 采用保守估算策略防欠费
  - [ ] 记录异常中断日志便于对账

### 3.2 Kafka 高级集成

- [ ] **NestJS Kafka 模块配置**
  - [ ] 安装 `nestjs-kafka` 或原生 `kafkajs`
  - [ ] 配置 Producer 参数:
    - [ ] `enable.idempotence=true` (幂等写入)
    - [ ] `acks=all` (写入确认)
    - [ ] 重试次数与退避策略

- [ ] **消息结构化设计**
  - [ ] 定义 CallLog DTO (纯 JSON 结构化)
  - [ ] `ProjectId` 作为 Partition Key 保障顺序消费
  - [ ] 包含 request_id、token_count、cost_estimat、timestamp 等

- [ ] **Dead Letter Queue 机制**
  - [ ] 创建 DLQ Topic 接收失败消息
  - [ ] 配置重试次数与超时

- [ ] **异步日志发送**
  - [ ] 在 `GatewayInterceptor` 中投递日志到 Kafka
  - [ ] 非阻塞，防止主流程延迟增加

### 3.3 后台消费者微服务 (Log Consumer Worker)

- [ ] **创建 `background-worker` NestJS 应用**
  - [ ] 独立微服务，处理异步计费与日志落盘

- [ ] **Kafka 消费者实现**
  - [ ] 监听日志 Topic，按 ProjectId 分区顺序消费
  - [ ] 处理毒消息与异常重试

- [ ] **计费逻辑**
  - [ ] 接收消息，计算消费金额 (模型 + Token 数)
  - [ ] 使用**事务 + 行级锁 (`SELECT ... FOR UPDATE`)** 更新余额
  - [ ] **基于 `requestId` 的唯一性约束做幂等防重入**
  - [ ] 成功后记录 BillingRecord

- [ ] **Elasticsearch 集成**
  - [ ] 连接 ES 集群
  - [ ] 剔除消耗容量的完整 Prompt 原文
  - [ ] 仅将部分哈希、打标、元数据结构化写入 ES
  - [ ] 配置索引 Mapping

- [ ] **每日对账 Cron Job**
  - [ ] 定时对比 Provider 账单与本地 BillingRecord
  - [ ] 发现差异时发送告警
  - [ ] 执行差额补正逻辑

### 3.4 验证计划 (Phase 3 Verification)

- [ ] **端到端流程验证**
  - [ ] 发送完整对话请求到网关
  - [ ] 检查 Kafka 控制台消息已落盘
  - [ ] 检查 PostgreSQL 余额被正确扣除
  - [ ] 检查 Kibana (ES) 能搜索到对应 TraceId 的日志

- [ ] **自动化测试**
  - [ ] Mock MQ 输入，验证计费计算
  - [ ] 验证幂等消费 (重复处理同一消息)
  - [ ] 验证异常断流估算逻辑

---

## 🎯 阶段四：管理后台系统与生产部署 (Phase 4)

### 4.1 架构演进路线 (智能路由与健康体系)

- [ ] **建立模型监控指标 (SLA 看板)**
  - [ ] 实时追踪 Latency / Error Rate / Cost
  - [ ] 异步巡查机制，不在主链路阻塞统计
  - [ ] Prometheus + Grafana 可视化

- [ ] **动态路由与权重更新**
  - [ ] 实现路由降权机制
  - [ ] **动态权重修改必须支持热刷无需重启**
  - [ ] 提供 Admin API 触发权重变更

- [ ] **Prompt 工程中台化**
  - [ ] 独立微服务管理 Prompt 模板
  - [ ] 支持 AB 测试注入
  - [ ] Prompt 版本管理

### 4.2 管理后台服务 (Admin API)

- [ ] **创建 `admin-api` 应用**
  - [ ] RESTful 配置下发接口
  - [ ] JWT 认证 (与 api-gateway 同机制)
  - [ ] 权限角色管理 (RBAC)

- [ ] **核心接口设计**
  - [ ] **租户管理**: 创建/查询/更新/删除租户
  - [ ] **API Key 管理**: 创建/轮转/撤销 Key
  - [ ] **配额管理**: 设置/查询租户配额与消费额度
  - [ ] **计费查询**: 查询租户账单与成本明细
  - [ ] **LiteLLM 路由配置**: 动态调整模型权重与 Provider

- [ ] **Secret 管理**
  - [ ] 所有敏感 Secret (数据库密码、API Key 等) 从 K8s Secrets 或云 KMS 挂载
  - [ ] 绝不写入配置中心明文

- [ ] **审计日志**
  - [ ] 记录所有管理后台的操作 (创建/修改/删除)
  - [ ] 支持管理员追溯

### 4.3 容器化与 Kubernetes 部署

- [ ] **多阶段 Dockerfile**
  - [ ] 构建阶段: 编译 TypeScript、打包依赖
  - [ ] 运行时阶段: **彻底剔除 Dev 依赖**，最小化镜像
  - [ ] 配置 CPU Limit / Memory Limit

- [ ] **Helm Chart 配置**
  - [ ] **api-gateway** Deployment:
    - [ ] 配置 HPA (基于 CPU + RPS 双指标)
    - [ ] 配置 PodDisruptionBudget (PDB)
    - [ ] 配置 Resource Requests/Limits
    - [ ] 配置 liveness/readiness probes

  - [ ] **background-worker** Deployment:
    - [ ] 配置适当的副本数
    - [ ] 配置资源限制

  - [ ] **LiteLLM Proxy** Deployment:
    - [ ] **配置严格的 readinessProbe** (防盲目吸入流量)
    - [ ] 强制规定路由策略加载完成才就绪
    - [ ] 配置 OOM Kill 防护

  - [ ] **服务发现**: Service / Ingress 配置

- [ ] **配置中心与秘钥管理**
  - [ ] ConfigMap 存储非敏感配置
  - [ ] Secrets 存储敏感信息 (数据库密码等)
  - [ ] 支持配置热更新 (通过 ConfigMap 变更触发)

### 4.4 三类致命破坏验收压测 (Chaos Engineering)

- [ ] **压测 1: 全 Provider 5xx 错误场景**
  - [ ] 模拟所有下游 Provider 返回 5xx
  - [ ] 验证熔断器快速反应
  - [ ] 验证错误返回给客户端
  - [ ] **验证退款链路** (已扣费金额是否正确冲销)

- [ ] **压测 2: ES/Log Consumer 破亿级堆积**
  - [ ] 停止消费者，让 Kafka 堆积消息
  - [ ] 观察网关性能变化 (应无影响，因为非阻塞)
  - [ ] 恢复消费者，验证追赶速度
  - [ ] 监控内存与磁盘增长

- [ ] **压测 3: Redis Master 驱逐切主灾难**
  - [ ] 模拟 Redis Master 故障，强制切主
  - [ ] 观察缓存重建时延
  - [ ] 观察鉴权延迟峰值
  - [ ] 验证持久化恢复完整性

- [ ] **压测 4: 1000+ 并发长文本 Streaming**
  - [ ] 使用 `k6` 或 `Vegeta` 生成打量
  - [ ] 验证系统稳定性 (无 OOM / Panic)
  - [ ] P95 延迟增幅 <= 100ms
  - [ ] 流式响应无断流
  - [ ] Token 计费无遗漏

### 4.5 验证计划 (Phase 4 Verification)

- [ ] **Admin API 完整链路验收**
  - [ ] 启动 `admin-api` 服务
  - [ ] 调用: 创建租户 -> 生成 Key -> 调用网关 -> 查询账单
  - [ ] 验证端到端流程一致性

- [ ] **系统集成与回归测试**
  - [ ] 本地或测试环境拉起完整镜像堆栈
  - [ ] 全量功能回归 (鉴权、限流、计费、DLP 等)
  - [ ] 性能压力测试 (1000 并发)

---

## 🧪 测试覆盖与 TDD 驱动

### 单元测试 (Unit Tests)
- [ ] **AuthGuard**: 测试各种 Key 格式与验证
- [ ] **RateLimitGuard**: 测试 Lua 脚本逻辑，边界情况
- [ ] **CostEstimator**: 测试成本计算与 Cap 限制
- [ ] **DLP Engine**: 测试正则匹配与 Fallback
- [ ] **Circuit Breaker**: 测试熔断状态转移

### 集成测试 (Integration Tests)
- [ ] **Redis + PostgreSQL**: 测试缓存与数据库交互
- [ ] **NestJS + Kafka**: 测试消息发送与消费
- [ ] **Gateway + LiteLLM**: 测试代理转发与流式

### E2E 测试 (End-to-End Tests)
- [ ] **完整请求链路**: Client -> Gateway -> LiteLLM -> Provider
- [ ] **流式响应验证**: 确保响应完整，无截断
- [ ] **异常处理**: 下游超时、错误的恢复

---

## 📈 项目监控与运维指标

- [ ] **设置 Prometheus Metrics**
  - [ ] Gateway 请求数、延迟、错误率
  - [ ] Token 消耗与成本
  - [ ] 限流拒绝数、并发峰值
  - [ ] Redis 命中率、延迟
  - [ ] Kafka 消费延迟 (LAG)

- [ ] **配置告警规则**
  - [ ] 错误率 > 1% 告警
  - [ ] 延迟 P99 > 500ms 告警
  - [ ] Redis 连接数异常告警
  - [ ] Kafka 堆积 > 10w 消息告警

- [ ] **配置日志聚合**
  - [ ] 所有服务日志汇聚到中心日志系统
  - [ ] 支持按 TraceId / TenantId / RequestId 快速检索

---

## ✅ 交付清单

### MVP 交付 (Phase 1-2)
- [ ] 完整的 pnpm workspace 工程
- [ ] 能处理基本请求的 api-gateway 服务
- [ ] PostgreSQL 多租户数据模型
- [ ] Redis 五维限流实现
- [ ] 本地 docker-compose 快速启动
- [ ] 基础的 Unit + E2E 测试

### 生产级交付 (Phase 3-4)
- [ ] 完整的 Kafka + Elasticsearch 审计日志系统
- [ ] Admin 管理后台与配额管理
- [ ] Kubernetes Helm Chart 与部署文档
- [ ] 压力测试报告与性能基线
- [ ] 灾难恢复演练文档与 Runbook

---

## 📝 关键决策与风险控制

### 核心架构决策
| 决策点 | 选择 | 理由 |
|--------|------|------|
| Web 框架 | NestJS | 企业级特性、DI、模块化 |
| 数据库 | PostgreSQL | 高并发、JSONB、完整 ACID |
| 缓存 | Redis Cluster | 高速读写、分布式一致性 |
| 消息队列 | Kafka | 高吞吐、顺序消费、持久化 |
| LLM 适配 | LiteLLM | 百多模型支持、开源成熟 |
| 日志存储 | Elasticsearch | 海量全文检索、聚合分析 |
| 部署 | Kubernetes | 容器编排、自动扩缩容 |

### 关键风险与缓解
| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| Token 计费不准 | 收入遗漏 | 信任 Provider usage，幂等消费，每日对账 |
| 流式断流未结算 | 负产值 | Pre-cost 预扣 + Fallback 补差 |
| Redis 宕机 | 鉴权中断 | 本地缓存降级 + 快速恢复 |
| Kafka 堆积 | 延迟上升 | 异步非阻塞 + 消费者扩容 |
| Provider 不可用 | 服务中断 | 多 Provider 权重池 + 熔断 + 降级 |

---

## 🗓️ 预计时间规划

> **注**: 此处仅供参考，实际时间取决于团队规模与资源分配

- **Phase 1 (基础设施)**: 1-2 周
- **Phase 2 (多租户与限流)**: 2-3 周
- **Phase 3 (审计与计费)**: 2-3 周
- **Phase 4 (生产与运维)**: 2-4 周

**总计**: 7-12 周，建议采用敏捷迭代，每周发布一个 MVP 微增量。

---

## 🚀 快速启动命令

```bash
# 克隆项目
git clone <repo-url>
cd llm-gateway-platform

# 安装依赖
pnpm install

# 启动本地开发环境
docker-compose up -d  # 仅启动 dev 组件

# 初始化数据库
pnpm -F database run migrate:dev

# 启动 api-gateway 服务
pnpm -F api-gateway run start:dev

# 启动测试
pnpm run test
pnpm run test:e2e

# 启动完整环境（包括 Kafka/ES）
docker-compose --profile full up -d
```

---

**文档维护人**: CTO  
**最后更新**: 2026-02-28  
**版本**: 1.0
