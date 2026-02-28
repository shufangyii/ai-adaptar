import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from './entities/user.entity';
import { UsageRecord } from './entities/usage-record.entity';
import { Quota } from './entities/quota.entity';

/**
 * 数据库模块
 * 使用 @Global() 装饰器使其在整个应用中可用
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL || 'postgresql://aiadaptar:aiadaptar123@localhost:5432/aiadaptar',
        entities: [User, UsageRecord, Quota],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development',
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
    }),
    TypeOrmModule.forFeature([User, UsageRecord, Quota]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
