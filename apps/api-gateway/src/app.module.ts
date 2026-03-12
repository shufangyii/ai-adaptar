/**
 * API Gateway 应用主模块 (AppModule)
 * 集成了配置管理、数据库、Redis、限流、DLP 等核心模块
 */
import { DatabaseModule } from '@llm-gateway/database';
import { RedisModule } from '@llm-gateway/redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DlpModule } from './modules/dlp/dlp.module';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  // 全局配置模块：从 .env.local 或 .env 读取环境变量
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // 数据库模块：提供 Prisma 服务
    DatabaseModule,
    // Redis 模块：提供缓存和限流服务
    RedisModule,
    // 限流模块：全局的 QPS/TPM 并发限流
    RateLimitModule,
    // DLP 模块：数据丢失防护（PII 检测）
    DlpModule,
    // 代理模块：核心的请求转发逻辑
    ProxyModule,
  ],
  // 应用控制器（主入口）
  controllers: [AppController],
  // 应用服务（应用逻辑）
  providers: [AppService],
})
export class AppModule {}
