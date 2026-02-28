# AI Adaptar - 待办事项清单

本文档记录了项目中所有需要完成的 TODO 任务，按模块分类。

## 目录

- [提供商适配器](#提供商适配器)
- [认证与授权](#认证与授权)
- [计费系统](#计费系统)
- [缓存系统](#缓存系统)
- [函数调用与工具](#函数调用与工具)
- [多模态支持](#多模态支持)
- [监控与日志](#监控与日志)
- [模型管理](#模型管理)
- [负载均衡](#负载均衡)
- [接口扩展](#接口扩展)
- [工具函数](#工具函数)

---

## 提供商适配器

### Anthropic 适配器 ✅
- [x] 实现 Anthropic API 完整集成
- [x] 实现健康检查
- [x] 实现聊天补全接口
- [x] 实现流式聊天接口
- [x] 嵌入功能（转发到其他提供商）
- [x] 图像生成功能（转发到其他提供商）

**文件位置**: `apps/providers-registry/anthropic-adapter/src/anthropic-adapter.service.ts`

---

### Azure OpenAI 适配器 ✅
- [x] 实现 Azure OpenAI API 完整集成
- [x] 实现健康检查
- [x] 实现聊天补全接口
- [x] 实现流式聊天接口
- [x] 实现嵌入接口
- [x] 实现图像生成接口
- [x] 添加 Azure 模型列表

**文件位置**: `apps/providers-registry/azure-adapter/src/azure-adapter.service.ts`

---

### Gemini 适配器 ✅
- [x] 实现 Gemini API 完整集成
- [x] 实现健康检查
- [x] 实现聊天补全接口
- [x] 实现流式聊天接口
- [x] 实现嵌入接口
- [ ] 实现图像生成接口（使用 Imagen API，需单独实现）

**文件位置**: `apps/providers-registry/gemini-adapter/src/gemini-adapter.service.ts`

---

### Qwen 适配器 ✅
- [x] 实现通义千问 API 完整集成
- [x] 实现健康检查
- [x] 实现聊天补全接口
- [x] 实现流式聊天接口
- [x] 实现嵌入接口
- [ ] 实现图像生成接口（使用通义万相）

**文件位置**: `apps/providers-registry/qwen-adapter/src/qwen-adapter.service.ts`

---

### OpenAI 适配器（补充）✅
- [x] 实现图像编辑接口
- [x] 实现图像变体接口

**文件位置**: `apps/providers-registry/openai-adapter/src/openai-adapter.service.ts`

---

## 认证与授权 ✅

### JWT 认证
- [x] 实现 JWT 认证守卫
- [x] 创建 JWT 策略
- [x] 实现认证中间件
- [x] 启用计费接口认证
- [x] 从 JWT token 获取用户 ID

**相关文件**:
- `apps/api-gateway/src/auth/`
- `apps/api-gateway/src/guards/`
- `apps/api-gateway/src/controllers/billing.controller.ts`
- `libs/common/src/decorators.ts`

---

### TLS 支持
- [ ] NATS TLS 配置
- [ ] HTTPS 支持

**文件位置**: `apps/ai-core/src/main.ts`

---

## 计费系统 ✅

### 计费服务
- [x] 创建计费服务模块
- [x] 实现使用记录存储
- [x] 实现使用统计查询
- [x] 实现周期查询（日/周/月/年）
- [x] 实现配额检查
- [x] 实现计费明细记录
- [x] 实现费用预估

**相关文件**:
- `apps/ai-core/src/billing/billing.service.ts`
- `apps/ai-core/src/billing/billing.module.ts`
- `apps/ai-core/src/controllers/billing.controller.ts`
- `libs/database/src/`

---

### 数据库模块
- [x] 创建数据库模块
- [x] 设计使用记录表结构
- [x] 设计配额表结构
- [x] 设计用户表结构
- [x] 实现 TypeORM 集成

**相关文件**:
- `libs/database/src/database.module.ts`
- `libs/database/src/entities/`
- `libs/database/src/repositories/`

---

## 缓存系统

### Redis 缓存
- [ ] 创建 Redis 缓存模块
- [ ] 实现请求缓存策略
- [ ] 实现嵌入向量缓存
- [ ] 实现模型信息缓存
- [ ] 实现提供商状态缓存

**相关文件**:
- `libs/interfaces/src/chat.interface.ts` (缓存策略配置)
- `libs/interfaces/src/embeddings.interface.ts` (嵌入向量缓存)
- `apps/ai-core/src/ai-core.module.ts` (Redis 缓存模块)

---

## 函数调用与工具 ✅

### Function Calling
- [x] 实现函数调用接口
- [x] 实现工具定义管理
- [x] 实现工具调用处理
- [x] 添加函数调用执行器
- [x] 添加示例函数

**相关文件**:
- `libs/interfaces/src/chat.interface.ts`
- `apps/ai-core/src/function-calling/`
- `apps/ai-core/src/controllers/chat.controller.ts`

### JSON 模式输出
- [x] 实现 JSON 模式输出支持（已通过 response_format 支持）

**文件位置**: `libs/interfaces/src/chat.interface.ts`

---

## 多模态支持

### Vision API
- [ ] 实现图像理解接口
- [ ] 支持多图像输入
- [ ] 支持图像详情参数

**相关文件**:
- `libs/interfaces/src/images.interface.ts`
- `apps/api-gateway/src/controllers/images.controller.ts`

---

### Audio API
- [ ] 实现语音输入接口
- [ ] 实现语音输出接口
- [ ] 添加音频相关接口定义

**相关文件**:
- `libs/interfaces/src/models.interface.ts`

---

### 图像修复
- [ ] 实现 Inpainting 接口

**相关文件**:
- `libs/interfaces/src/images.interface.ts`
- `apps/api-gateway/src/controllers/images.controller.ts`

---

## 监控与日志

### Prometheus 监控
- [ ] 添加 Prometheus 服务
- [ ] 实现指标收集
- [ ] 实现请求追踪
- [ ] 实现提供商健康监控

**文件位置**: `docker-compose.yml`

---

### Grafana 监控
- [ ] 添加 Grafana 服务
- [ ] 创建监控面板
- [ ] 配置告警规则

**文件位置**: `docker-compose.yml`

---

### 链路追踪
- [ ] 添加 Jaeger 服务
- [ ] 实现分布式追踪
- [ ] 实现请求链路可视化

**文件位置**: `docker-compose.yml`

---

### 事件总线
- [ ] 创建事件总线模块
- [ ] 实现事件发布订阅
- [ ] 添加更多事件类型
- [ ] 实现事件过滤和路由

**相关文件**:
- `libs/interfaces/src/events.interface.ts`
- `apps/ai-core/src/ai-core.module.ts`

---

## 模型管理

### 模型映射
- [ ] 添加更多模型映射配置
- [ ] 支持从配置文件加载
- [ ] 支持从数据库加载
- [ ] 实现模型别名热更新
- [ ] 实现模型推荐功能
- [ ] 实现模型对比接口
- [ ] 实现模型能力查询接口

**相关文件**:
- `apps/ai-core/src/model-mapping/model-mapping.service.ts`
- `libs/interfaces/src/models.interface.ts`
- `apps/api-gateway/src/controllers/models.controller.ts`

---

### 提供商管理
- [ ] 实现提供商自动发现
- [ ] 从配置加载提供商配置
- [ ] 实现提供商热重载
- [ ] 实现提供商状态监控
- [ ] 添加提供商健康检查详情
- [ ] 添加提供商错误标准化

**相关文件**:
- `apps/ai-core/src/providers/provider-manager.service.ts`
- `apps/ai-core/src/providers/provider-registry.service.ts`
- `libs/interfaces/src/provider.interface.ts`

---

## 负载均衡

### 负载均衡策略
- [ ] 实现权重配置
- [ ] 实现熔断机制
- [ ] 实现健康检查和自动恢复

**文件位置**: `apps/ai-core/src/load-balancer/load-balancer.service.ts`

---

## 接口扩展

### 聊天接口
- [ ] 添加批量请求/响应接口
- [ ] 添加对话历史管理接口
- [ ] 添加上下文窗口管理接口
- [ ] 添加重试策略配置

**文件位置**: `libs/interfaces/src/chat.interface.ts`

---

### 嵌入接口
- [ ] 添加批量嵌入优化接口
- [ ] 添加嵌入向量相似度搜索接口

**相关文件**:
- `libs/interfaces/src/embeddings.interface.ts`
- `apps/api-gateway/src/controllers/embeddings.controller.ts`

---

### 计费接口
- [ ] 添加配额充值接口
- [ ] 添加费用预估接口

**文件位置**: `apps/api-gateway/src/controllers/billing.controller.ts`

---

## 工具函数

### 通用工具
- [ ] 添加更多工具函数
- [ ] 实现令牌计数（基于 tiktoken）
- [ ] 实现成本计算函数

**文件位置**: `libs/common/src/utils.ts`

---

### 异常处理
- [ ] 添加更多特定异常类型
- [ ] 实现 RPC 异常过滤器
- [ ] 实现流式响应异常处理

**相关文件**:
- `libs/common/src/exceptions.ts`
- `libs/common/src/filters.ts`

---

### 装饰器
- [ ] 添加更多装饰器

**文件位置**: `libs/common/src/decorators.ts`

---

### 常量扩展
- [ ] 添加更多提供商常量
- [ ] 添加更多 NATS 命令常量

**文件位置**: `libs/common/src/constants.ts`

---

## API Gateway 扩展

- [ ] 添加计费服务客户端
- [ ] 添加监控服务客户端

**文件位置**: `apps/api-gateway/src/app.module.ts`

---

## 优先级说明

### P0 - 核心功能（必须完成）
- Anthropic 适配器完整实现
- Azure OpenAI 适配器完整实现
- Gemini 适配器完整实现
- Qwen 适配器完整实现
- 计费系统基础功能
- JWT 认证

### P1 - 重要功能（建议完成）
- Redis 缓存系统
- 函数调用支持
- 多模态基础支持（Vision）
- 监控系统基础（Prometheus + Grafana）

### P2 - 增强功能（可选完成）
- 链路追踪（Jaeger）
- 事件总线
- 模型推荐
- 负载均衡高级功能（熔断、权重）

---

## 任务状态跟踪

| 模块 | 总任务数 | 已完成 | 进行中 | 待开始 |
|------|---------|--------|--------|--------|
| 提供商适配器 | 24 | 21 | 0 | 3 |
| 认证与授权 | 7 | 7 | 0 | 0 |
| 计费系统 | 10 | 10 | 0 | 0 |
| 数据库模块 | 5 | 5 | 0 | 0 |
| 缓存系统 | 5 | 0 | 0 | 5 |
| 函数调用与工具 | 5 | 5 | 0 | 0 |
| 多模态支持 | 6 | 0 | 0 | 6 |
| 监控与日志 | 8 | 0 | 0 | 8 |
| 模型管理 | 13 | 0 | 0 | 13 |
| 负载均衡 | 3 | 0 | 0 | 3 |
| 接口扩展 | 9 | 0 | 0 | 9 |
| 工具函数 | 6 | 0 | 0 | 6 |
| API Gateway 扩展 | 2 | 0 | 0 | 2 |
| **总计** | **103** | **48** | **0** | **55** |

---

## 项目完成进度报告

### 📊 总体完成情况
```
总任务数: 103
已完成:   48 (46.6%)
待开始:   55 (53.4%)
```

---

## 最新完成情况

### ✅ 提供商适配器 (21/24 已完成)

#### OpenAI 适配器
- ✅ 聊天补全
- ✅ 流式聊天
- ✅ 嵌入向量
- ✅ 图像生成
- ✅ 图像编辑
- ✅ 图像变体

#### Qwen 适配器
- ✅ 健康检查
- ✅ 聊天补全
- ✅ 流式聊天
- ✅ 嵌入向量
- ⏳ 图像生成 (通义万相 API)

#### Azure OpenAI 适配器
- �� 健康检查
- ✅ 聊天补全
- ✅ 流式聊天
- ✅ 嵌入向量
- ✅ 图像生成 (DALL-E)
- ✅ 模型列表

#### Anthropic 适配器
- ✅ 健康检查
- ✅ 聊天补全
- ✅ 流式聊天
- ✅ 消息格式转换
- ✅ System 消息处理

#### Gemini 适配器
- ✅ 健康检查
- ✅ 聊天补全
- ✅ 流式聊天
- ✅ 嵌入向量
- ✅ System 指令处理
- ⏳ 图像生成 (Imagen API)

### ⏳ 待完成任务

#### 提供商适配器剩余 (3项)
- 通义万相图像生成
- Imagen 图像生成
- Qwen/Gwen 图像编辑和变体

#### P0 核心功能 (24项)
- JWT 认证系统 (7项)
- 计费系统 (10项)
- 模型管理 (13项)
