import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageEditRequest,
  ImageVariationRequest,
} from '@ai-adaptar/interfaces';

@ApiTags('images')
@Controller('v1/images')
export class ImagesController {
  constructor(
    @Inject('AI_CORE_SERVICE') private readonly aiCoreClient: ClientProxy,
  ) {}

  @Post('generations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate image',
    description: 'Creates an image given a prompt.'
  })
  @ApiResponse({
    status: 200,
    description: 'Generated image response',
  })
  async generateImage(
    @Body() request: ImageGenerationRequest,
  ): Promise<Observable<ImageGenerationResponse>> {
    return this.aiCoreClient.send(
      { cmd: 'image.generate' },
      request,
    );
  }

  @Post('edits')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Edit image',
    description: 'Creates an edited or extended image given an original image and a prompt.'
  })
  @ApiResponse({
    status: 200,
    description: 'Edited image response',
  })
  async editImage(
    @Body() request: ImageEditRequest,
  ): Promise<Observable<ImageGenerationResponse>> {
    return this.aiCoreClient.send(
      { cmd: 'image.edit' },
      request,
    );
  }

  @Post('variations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create image variation',
    description: 'Creates a variation of a given image.'
  })
  @ApiResponse({
    status: 200,
    description: 'Image variation response',
  })
  async createVariation(
    @Body() request: ImageVariationRequest,
  ): Promise<Observable<ImageGenerationResponse>> {
    return this.aiCoreClient.send(
      { cmd: 'image.variation' },
      request,
    );
  }

  // TODO: 添加图像理解/Vision API 接口
  // TODO: 添加图像修复 (Inpainting) 支持
}
