import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageEditRequest,
  ImageVariationRequest,
} from '@ai-adaptar/interfaces';
import { LoadBalancer } from '../load-balancer/load-balancer.service';

@Controller()
export class ImagesController {
  private readonly logger = new Logger(ImagesController.name);

  constructor(
    private readonly loadBalancer: LoadBalancer,
  ) {}

  @EventPattern('image.generate')
  async generateImage(
    @Payload() request: ImageGenerationRequest,
    @Ctx() context: RmqContext,
  ): Promise<ImageGenerationResponse> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Generating image with model: ${request.model}`);

      const provider = await this.loadBalancer.selectProvider(request.model, request.provider);

      this.logger.debug(`[${correlationId}] Selected provider: ${provider.name}`);

      const response = await provider.generateImage(request);

      this.logger.log(`[${correlationId}] Image generated successfully`);

      return response;
    } catch (error) {
      this.logger.error(`[${correlationId}] Error generating image:`, error);
      throw error;
    }
  }

  @EventPattern('image.edit')
  async editImage(
    @Payload() request: ImageEditRequest,
    @Ctx() context: RmqContext,
  ): Promise<ImageGenerationResponse> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Editing image with model: ${request.model}`);

      const provider = await this.loadBalancer.selectProvider(request.model, request.provider);

      const response = await provider.editImage(request);

      this.logger.log(`[${correlationId}] Image edited successfully`);

      return response;
    } catch (error) {
      this.logger.error(`[${correlationId}] Error editing image:`, error);
      throw error;
    }
  }

  @EventPattern('image.variation')
  async createVariation(
    @Payload() request: ImageVariationRequest,
    @Ctx() context: RmqContext,
  ): Promise<ImageGenerationResponse> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Creating image variation with model: ${request.model}`);

      const provider = await this.loadBalancer.selectProvider(request.model, request.provider);

      const response = await provider.createImageVariation(request);

      this.logger.log(`[${correlationId}] Image variation created successfully`);

      return response;
    } catch (error) {
      this.logger.error(`[${correlationId}] Error creating image variation:`, error);
      throw error;
    }
  }

  private getCorrelationId(context: RmqContext): string {
    const message = context.getMessage();
    return message.properties?.correlationId || 'unknown';
  }
}
