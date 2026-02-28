import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './controllers/chat.controller';
import { EmbeddingsController } from './controllers/embeddings.controller';
import { ImagesController } from './controllers/images.controller';
import { ModelsController } from './controllers/models.controller';
import { BillingController } from './controllers/billing.controller';
import { HealthController } from './controllers/health.controller';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from '@ai-adaptar/database';

/**
 * API 网关主模块
 * 负责接收外部 HTTP 请求并转发到相应的微服务
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // 数据库模块
    DatabaseModule,

    // 认证模块
    AuthModule,

    // AI Core 服务客户端
    ClientsModule.register([
      {
        name: 'AI_CORE_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL || 'nats://localhost:4222'],
          queue: 'ai-core-queue',
        },
      },
    ]),
  ],
  controllers: [
    HealthController,
    ChatController,
    EmbeddingsController,
    ImagesController,
    ModelsController,
    BillingController,
  ],
  providers: [],
})
export class AppModule {}
