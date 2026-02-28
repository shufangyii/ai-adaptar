import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { EmbeddingRequest, EmbeddingResponse } from '@ai-adaptar/interfaces';
import { LoadBalancer } from '../load-balancer/load-balancer.service';

@Controller()
export class EmbeddingsController {
  private readonly logger = new Logger(EmbeddingsController.name);

  constructor(
    private readonly loadBalancer: LoadBalancer,
  ) {}

  @EventPattern('embeddings.create')
  async createEmbeddings(
    @Payload() request: EmbeddingRequest,
    @Ctx() context: RmqContext,
  ): Promise<EmbeddingResponse> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Creating embeddings for model: ${request.model}`);

      const provider = await this.loadBalancer.selectProvider(request.model, request.provider);

      this.logger.debug(`[${correlationId}] Selected provider: ${provider.name}`);

      const response = await provider.createEmbeddings(request);

      this.logger.log(`[${correlationId}] Embeddings created successfully`);

      return response;
    } catch (error) {
      this.logger.error(`[${correlationId}] Error creating embeddings:`, error);
      throw error;
    }
  }

  private getCorrelationId(context: RmqContext): string {
    const message = context.getMessage();
    return message.properties?.correlationId || 'unknown';
  }
}
