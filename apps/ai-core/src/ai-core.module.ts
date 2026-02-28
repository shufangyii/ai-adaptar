import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  ChatController,
  EmbeddingsController,
  ImagesController,
  ModelsController,
  BillingController,
} from './controllers';
import { ProviderManager } from './providers/provider-manager.service';
import { ProviderRegistry } from './providers/provider-registry.service';
import { LoadBalancer } from './load-balancer/load-balancer.service';
import { ModelMappingService } from './model-mapping/model-mapping.service';
import { BillingModule } from './billing/billing.module';
import { FunctionCallingModule } from './function-calling/function-calling.module';
import { DatabaseModule } from '@ai-adaptar/database';
import { OpenAIAdapter } from '../providers-registry/openai-adapter/src/openai-adapter.service';
import { AnthropicAdapter } from '../providers-registry/anthropic-adapter/src/anthropic-adapter.service';
import { AzureAdapter } from '../providers-registry/azure-adapter/src/azure-adapter.service';
import { GeminiAdapter } from '../providers-registry/gemini-adapter/src/gemini-adapter.service';
import { QwenAdapter } from '../providers-registry/qwen-adapter/src/qwen-adapter.service';

/**
 * AI 核心服务模块
 * 负责路由请求到对应的提供商适配器，处理负载均衡和故障转移
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // 数据库模块 (计费、日志)
    DatabaseModule,
    // 计费模块
    BillingModule,
    // 函数调用模块
    FunctionCallingModule,
    // TODO: 添加 Redis 缓存模块
    // TODO: 添加事件总线模块
  ],
  controllers: [
    ChatController,
    EmbeddingsController,
    ImagesController,
    ModelsController,
    BillingController,
  ],
  providers: [
    ProviderManager,
    ProviderRegistry,
    LoadBalancer,
    ModelMappingService,
    // 注册所有提供商适配器
    OpenAIAdapter,
    AnthropicAdapter,
    AzureAdapter,
    GeminiAdapter,
    QwenAdapter,
  ],
  exports: [
    ProviderManager,
    LoadBalancer,
    ModelMappingService,
  ],
})
export class AiCoreModule {}
