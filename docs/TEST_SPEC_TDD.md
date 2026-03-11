# LLM Gateway TDD 测试规格文档 (TDD Test Specification)

本文档定义了 LLM 网关项目的测试驱动开发 (TDD) 路径。所有功能开发应遵循：**编写测试 (Red) -> 实现代码 (Green) -> 重构 (Refactor)**。

## 1. 测试策略概览

- **单元测试 (Unit Tests)**: 针对独立模块（如过滤器、限流算法、成本计算）。
- **集成测试 (Integration Tests)**: 验证组件间交互（如 NestJS -> Redis, NestJS -> PostgreSQL）。
- **E2E 测试 (End-to-End Tests)**: 模拟完整请求链路（Client -> Gateway -> LiteLLM -> Mock Provider）。

---

## 2. 阶段一：MVP 与 基础设施 (Phase 1)

### 2.1 鉴权守卫 (AuthGuard)

**目标**: 确保请求必须携带合法的 API Key。

| ID       | 描述                   | 输入                                | 预期结果         |
| :------- | :--------------------- | :---------------------------------- | :--------------- |
| AUTH-001 | 无 Header 请求         | 无 `Authorization`                  | 401 Unauthorized |
| AUTH-002 | 错误前缀               | `Authorization: Basic sk-...`       | 401 Unauthorized |
| AUTH-003 | 非法 Key (Hash 不匹配) | `Authorization: Bearer invalid-key` | 401 Unauthorized |
| AUTH-004 | 合法 Key               | `Authorization: Bearer valid-sk`    | 200/201 Success  |

### 2.2 基础代理转发 (Proxy Forwarding)

**目标**: 验证请求能正确流向 LiteLLM。

| ID        | 描述                     | 测试类型    | 验证点                                       |
| :-------- | :----------------------- | :---------- | :------------------------------------------- |
| PROXY-001 | 包含 Trace-Id            | Integration | 转发到 LiteLLM 的请求 Header 包含 `trace-id` |
| PROXY-002 | 超时控制                 | Unit/Int    | 下游超过 30s 无响应，网关主动切断并返回 504  |
| PROXY-003 | 断路器 (Circuit Breaker) | Unit        | 当 LiteLLM 持续失败时，熔断器进入 OPEN 状态  |
| PROXY-004 | 原生 Stream 边发边解析   | Unit        | 使用 `stream.pipe` 透传时，能正确监听并截取最后一块的 `usage` JSON 数据 |
| PROXY-005 | 客户端异常断开连接       | Integration | 客户端切断连接时，触发 `AbortController`，验证往 LiteLLM 上游请求被中止 |

### 2.3 早期基准压力测试 (Shift-Left Load Testing)

**目标**: 尽早暴露 Node.js 内存与代理连接池瓶颈，验证流式回压及事件循环健康度。

| ID       | 描述                 | 测试类型     | 验证点                                                   |
| :------- | :------------------- | :----------- | :------------------------------------------------------- |
| PERF-001 | 500 并发长文本流压测 | E2E/Stress   | 验证 `stream.pipe` 透传在 500 并发下无 OOM，事件循环延迟容忍度在 50ms 内 |

---

## 3. 阶段二：多租户与限流 (Phase 2)

### 3.1 五维限流 (Rate Limiting 2.0)

**目标**: 验证 Lua 脚本限流的准确性。

| ID     | 描述     | 场景                        | 预期结果                       |
| :----- | :------- | :-------------------------- | :----------------------------- |
| RL-001 | QPS 限流 | 发送频率 > 配置阈值         | 返回 429 Too Many Requests     |
| RL-002 | 并发限流 | 同时发起 10 个请求 (限额 5) | 前 5 个成功，后 5 个被拦截     |
| RL-003 | 并发释放 | Streaming 请求结束          | Redis 中的并发计数器应正确减 1 |

### 3.2 安全水位校验 (Watermark Balance Check)

**目标**: 基于安全阈值放行，防止账户余额赤字。

| ID       | 描述             | 输入                 | 预期结果               |
| :------- | :--------------- | :------------------- | :--------------------- |
| COST-001 | 余额低于安全水位 | 账户余额 < 阈值金额  | 402 Payment Required   |
| COST-002 | 余额正常         | 账户余额 >= 阈值金额 | 放行请求，不做预扣冻结 |

---

## 4. 阶段三：异步计费与审计 (Phase 3)

### 4.1 异步日志记录 (Async Logging)

**目标**: 确保日志高可靠投递。

| ID      | 描述             | 验证点                                                   |
| :------ | :--------------- | :------------------------------------------------------- |
| LOG-001 | Kafka 生产幂等性 | 模拟网络抖动，Producer 重试不产生重复消息                |
| LOG-002 | 消费计费幂等性   | 消费者处理同一 `request-id` 消息两次，余额只扣除一次     |
| LOG-003 | 异常断流统计     | Streaming 意外中断，系统根据已接收内容进行 Fallback 结算 |

---

## 5. 阶段四：管理与压力测试 (Phase 4)

### 5.1 系统韧性 (Resilience)

**目标**: 极端情况下的系统表现。

| ID      | 场景           | 验证说明                                                      |
| :------ | :------------- | :------------------------------------------------------------ |
| RES-001 | Redis 宕机切主 | 验证鉴权逻辑是否能利用本地缓存短时降级或快速恢复              |
| RES-002 | 1000 并发压测  | 使用 `k6` 或 `Vegeta` 进行打量，P95 延迟增加量需在 100ms 以内 |

---

## 6. 如何运行测试 (Instructions)

### 环境准备

```bash
# 启动依赖容器 (Redis, Postgres)
docker-compose up -d
```

### 运行命令

- **单元测试**: `npm run test`
- **集成测试**: `npm run test:e2e`
- **压力测试**: `./scripts/stress-test.sh`
