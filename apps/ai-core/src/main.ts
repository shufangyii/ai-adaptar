import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { Logger } from '@ai-adaptar/common';
import { AiCoreModule } from './ai-core.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AiCoreModule,
    {
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        queue: 'ai-core-queue',
        // TODO: 添加 JWT 认证
        // TODO: 添加 TLS 支持
      },
    },
  );

  app.useLogger(new Logger());

  await app.listen();
  console.log('🚀 AI Core Service is running (NATS)');
}

bootstrap();
