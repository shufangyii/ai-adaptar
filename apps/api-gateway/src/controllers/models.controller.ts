import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Observable } from 'rxjs';

@ApiTags('models')
@Controller('v1/models')
export class ModelsController {
  constructor(
    @Inject('AI_CORE_SERVICE') private readonly aiCoreClient: ClientProxy,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List models',
    description: 'Lists the currently available models.'
  })
  @ApiResponse({
    status: 200,
    description: 'List of available models',
  })
  async listModels(): Promise<Observable<any>> {
    return this.aiCoreClient.send(
      { cmd: 'models.list' },
      {},
    );
  }

  @Get(':model')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve model',
    description: 'Retrieves a model instance, providing basic information about the model.'
  })
  @ApiParam({ name: 'model', description: 'The model ID' })
  @ApiResponse({
    status: 200,
    description: 'Model details',
  })
  async getModel(@Param('model') modelId: string): Promise<Observable<any>> {
    return this.aiCoreClient.send(
      { cmd: 'models.get' },
      { model: modelId },
    );
  }

  // TODO: 添加模型能力查询接口 (支持哪些功能)
  // TODO: 添加模型对比接口
}
