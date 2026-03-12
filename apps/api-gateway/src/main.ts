/**
 * API Gateway 应用入口 (main.ts)
 * 初始化 NestJS 应用、配置全局中间件、启用 OpenTelemetry 链路追踪
 */
// 1. 在所有其他导入之前初始化 OpenTelemetry 链路追踪
// 这确保在整个请求生命周期中都能记录 trace
import './tracing';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * 应用启动入口函数
 * 初始化 NestJS 容器并配置全局中间件
 */
async function bootstrap() {
  // 2. 创建 NestJS 应用实例，配置日志级别
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // 3. 获取配置服务
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX')!;

  // 4. 启用 API 版本控制 (通过 URL 路径: /v1/xxx)
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // 5. 启用 CORS (跨域资源共享)
  // 允许所有来源的跨域请求，适用于前后端分离架构
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 6. 配置全局验证管道
  // - whitelist: 自动过滤请求体中不在 DTO 中的属性
  // - forbidNonWhitelisted: 如果存在不在 DTO 中的属性，抛出 400 错误
  // - transform: 自动将请求体转换为 DTO 类型
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true, // 启用隐式类型转换
      },
    }),
  );

  // 7. 设置全局 API 前缀
  app.setGlobalPrefix(apiPrefix);

  // 8. 启动应用并监听端口
  await app.listen(port);
  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
}

// 执行启动函数
void bootstrap();
