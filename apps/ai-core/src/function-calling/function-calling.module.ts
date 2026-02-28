import { Module } from '@nestjs/common';
import { FunctionRegistryService } from './function-registry.service';
import { FunctionExecutorService } from './function-executor.service';
import { ProviderManager } from '../providers/provider-manager.service';
import { LoadBalancer } from '../load-balancer/load-balancer.service';
import { ExampleFunctions } from './example-functions';

/**
 * 函数调用模块
 */
@Module({
  providers: [
    FunctionRegistryService,
    FunctionExecutorService,
    ExampleFunctions,
  ],
  exports: [
    FunctionRegistryService,
    FunctionExecutorService,
  ],
})
export class FunctionCallingModule {}
