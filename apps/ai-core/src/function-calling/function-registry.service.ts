import { Injectable, Logger } from '@nestjs/common';
import {
  FunctionRegistry as IFunctionRegistry,
  FunctionDefinition,
  FunctionHandler,
  FunctionContext,
} from '@ai-adaptar/interfaces';

/**
 * 函数注册表服务
 * 管理所有可调用的函数
 */
@Injectable()
export class FunctionRegistryService implements IFunctionRegistry {
  private readonly logger = new Logger(FunctionRegistryService.name);
  private readonly functions = new Map<string, { definition: FunctionDefinition; handler: FunctionHandler }>();

  /**
   * 注册函数
   */
  register(name: string, definition: FunctionDefinition, handler: FunctionHandler): void {
    if (this.functions.has(name)) {
      this.logger.warn(`Function ${name} is already registered, overwriting...`);
    }

    this.functions.set(name, { definition, handler });
    this.logger.log(`Registered function: ${name}`);
  }

  /**
   * 批量注册函数
   */
  registerBatch(functions: Record<string, { definition: FunctionDefinition; handler: FunctionHandler }>): void {
    for (const [name, { definition, handler }] of Object.entries(functions)) {
      this.register(name, definition, handler);
    }
  }

  /**
   * 获取函数定义
   */
  get(name: string): FunctionDefinition | undefined {
    return this.functions.get(name)?.definition;
  }

  /**
   * 获取所有函数定义
   */
  getAll(): Record<string, FunctionDefinition> {
    const result: Record<string, FunctionDefinition> = {};
    for (const [name, { definition }] of this.functions) {
      result[name] = definition;
    }
    return result;
  }

  /**
   * 执行函数
   */
  async execute(name: string, args: Record<string, any>, context?: FunctionContext): Promise<any> {
    const func = this.functions.get(name);

    if (!func) {
      throw new Error(`Function ${name} not found`);
    }

    this.logger.debug(`Executing function: ${name} with args:`, args);

    try {
      const result = await func.handler(args, context || {} as FunctionContext);
      this.logger.debug(`Function ${name} executed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error executing function ${name}:`, error);
      throw error;
    }
  }

  /**
   * 注销函数
   */
  unregister(name: string): boolean {
    const deleted = this.functions.delete(name);
    if (deleted) {
      this.logger.log(`Unregistered function: ${name}`);
    }
    return deleted;
  }

  /**
   * 检查函数是否存在
   */
  has(name: string): boolean {
    return this.functions.has(name);
  }

  /**
   * 获取已注册的函数名称列表
   */
  getFunctionNames(): string[] {
    return Array.from(this.functions.keys());
  }
}
