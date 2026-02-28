import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import {
  EmbeddingRequest,
  EmbeddingResponse,
} from '@ai-adaptar/interfaces';

@ApiTags('embeddings')
@Controller('v1/embeddings')
export class EmbeddingsController {
  constructor(
    @Inject('AI_CORE_SERVICE') private readonly aiCoreClient: ClientProxy,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create embeddings',
    description: 'Creates an embedding vector representing the input text.'
  })
  @ApiResponse({
    status: 200,
    description: 'Embedding vector response',
  })
  async createEmbeddings(
    @Body() request: EmbeddingRequest,
  ): Promise<Observable<EmbeddingResponse>> {
    return this.aiCoreClient.send(
      { cmd: 'embeddings.create' },
      request,
    );
  }

  // TODO: 添加批量嵌入生成接口
  // TODO: 添加嵌入向量相似度搜索接口
}
