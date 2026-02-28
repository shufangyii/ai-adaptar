import { Injectable, Logger } from '@nestjs/common';
import { FunctionRegistryService } from './function-registry.service';

/**
 * 示例函数集合
 * 展示如何定义和注册可调用的函数
 */
@Injectable()
export class ExampleFunctions {
  private readonly logger = new Logger(ExampleFunctions.name);

  constructor(private readonly functionRegistry: FunctionRegistryService) {
    this.registerFunctions();
  }

  /**
   * 注册所有示例函数
   */
  private registerFunctions(): void {
    // 获取当前时间
    this.functionRegistry.register(
      'get_current_time',
      {
        name: 'get_current_time',
        description: 'Get the current time in a specific timezone',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'The timezone to get the time for (e.g., "UTC", "America/New_York")',
              default: 'UTC',
            },
          },
        },
      },
      async (args, context) => {
        this.logger.debug(`Getting current time for timezone: ${args.timezone}`);
        const now = new Date();
        return {
          timezone: args.timezone || 'UTC',
          datetime: now.toISOString(),
          unix_timestamp: Math.floor(now.getTime() / 1000),
        };
      },
    );

    // 获取天气信息
    this.functionRegistry.register(
      'get_weather',
      {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: 'The temperature unit to use',
            },
          },
          required: ['location'],
        },
      },
      async (args, context) => {
        this.logger.debug(`Getting weather for ${args.location}`);
        // TODO: 实际调用天气 API
        return {
          location: args.location,
          temperature: 22,
          unit: args.unit || 'celsius',
          condition: 'sunny',
          humidity: 65,
        };
      },
    );

    // 执行计算
    this.functionRegistry.register(
      'calculate',
      {
        name: 'calculate',
        description: 'Perform a mathematical calculation',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'The mathematical expression to evaluate (e.g., "2 + 2")',
            },
          },
          required: ['expression'],
        },
      },
      async (args, context) => {
        this.logger.debug(`Calculating: ${args.expression}`);
        try {
          // 注意：在实际生产环境中，应该使用更安全的方式计算表达式
          // 这里只是一个示例
          const result = Function('"use strict"; return (' + args.expression + ')')();
          return {
            expression: args.expression,
            result,
          };
        } catch (error) {
          throw new Error(`Invalid expression: ${args.expression}`);
        }
      },
    );

    // 搜索数据库
    this.functionRegistry.register(
      'search_database',
      {
        name: 'search_database',
        description: 'Search the database for information',
        parameters: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'The table to search',
            },
            query: {
              type: 'string',
              description: 'The search query',
            },
            limit: {
              type: 'number',
              description: 'The maximum number of results to return',
              default: 10,
            },
          },
          required: ['table', 'query'],
        },
      },
      async (args, context) => {
        this.logger.debug(`Searching database table ${args.table} for: ${args.query}`);
        // TODO: 实际查询数据库
        return {
          table: args.table,
          query: args.query,
          results: [],
          count: 0,
        };
      },
    );

    // 发送通知
    this.functionRegistry.register(
      'send_notification',
      {
        name: 'send_notification',
        description: 'Send a notification to a user',
        parameters: {
          type: 'object',
          properties: {
            recipient: {
              type: 'string',
              description: 'The recipient user ID or email',
            },
            message: {
              type: 'string',
              description: 'The notification message',
            },
            type: {
              type: 'string',
              enum: ['email', 'sms', 'push'],
              description: 'The notification type',
            },
          },
          required: ['recipient', 'message', 'type'],
        },
      },
      async (args, context) => {
        this.logger.debug(`Sending ${args.type} notification to ${args.recipient}`);
        // TODO: 实际发送通知
        return {
          recipient: args.recipient,
          type: args.type,
          message: args.message,
          status: 'sent',
          sent_at: new Date().toISOString(),
        };
      },
    );

    this.logger.log('Registered example functions');
  }
}
