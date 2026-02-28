import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { ProviderManager } from '../providers/provider-manager.service';
import { ModelMappingService } from '../model-mapping/model-mapping.service';

@Controller()
export class ModelsController {
  private readonly logger = new Logger(ModelsController.name);

  constructor(
    private readonly providerManager: ProviderManager,
    private readonly modelMapping: ModelMappingService,
  ) {}

  @EventPattern('models.list')
  async listModels(@Ctx() context: RmqContext): Promise<any> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Listing models`);

      const providers = await this.providerManager.getAllProviders();
      const models = [];

      for (const provider of providers) {
        const providerModels = provider.getSupportedModels();
        for (const modelId of providerModels) {
          const modelInfo = await this.modelMapping.getModelInfo(modelId);
          if (modelInfo) {
            models.push(modelInfo);
          }
        }
      }

      return {
        object: 'list',
        data: models,
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error listing models:`, error);
      throw error;
    }
  }

  @EventPattern('models.get')
  async getModel(@Payload() data: { model: string }, @Ctx() context: RmqContext): Promise<any> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Getting model: ${data.model}`);

      const modelInfo = await this.modelMapping.getModelInfo(data.model);

      if (!modelInfo) {
        throw new Error(`Model not found: ${data.model}`);
      }

      return {
        object: 'model',
        id: data.model,
        info: modelInfo,
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting model:`, error);
      throw error;
    }
  }

  private getCorrelationId(context: RmqContext): string {
    const message = context.getMessage();
    return message.properties?.correlationId || 'unknown';
  }
}
