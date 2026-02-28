import { Controller, Post, Body, HttpCode, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
} from '@ai-adaptar/interfaces';

@ApiTags('chat')
@Controller('v1/chat')
export class ChatController {
  constructor(
    @Inject('AI_CORE_SERVICE') private readonly aiCoreClient: ClientProxy,
  ) {}

  @Post('completions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create chat completion',
    description: 'Creates a model response for the given chat conversation.'
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    type: Object
  })
  @ApiBody({ type: Object })
  async createChatCompletion(
    @Body() request: ChatCompletionRequest,
  ): Promise<Observable<ChatCompletionResponse>> {
    return this.aiCoreClient.send(
      { cmd: 'chat.completion' },
      request,
    );
  }

  @Post('completions/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create streaming chat completion',
    description: 'Creates a streaming model response for the given chat conversation.'
  })
  @ApiResponse({
    status: 200,
    description: 'Streaming response',
    type: Object
  })
  async createStreamChatCompletion(
    @Body() request: ChatCompletionRequest,
  ): Promise<Observable<StreamChunk>> {
    return this.aiCoreClient.send(
      { cmd: 'chat.completion.stream' },
      { ...request, stream: true },
    );
  }

  // TODO: 添加批量对话完成接口
  // TODO: 添加函数调用 (Function Calling) 支持
  // TODO: 添加 JSON 模式输出支持
}
