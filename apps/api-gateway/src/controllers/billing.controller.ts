import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('billing')
@Controller('v1/billing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(
    @Inject('AI_CORE_SERVICE') private readonly aiCoreClient: ClientProxy,
  ) {}

  @Get('usage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get usage statistics',
    description: 'Retrieves usage statistics for the current period.'
  })
  @ApiResponse({
    status: 200,
    description: 'Usage statistics',
  })
  async getUsage(@Request() req: any): Promise<Observable<any>> {
    return this.aiCoreClient.send(
      { cmd: 'billing.usage' },
      { userId: req.user.id, period: 'month' },
    );
  }

  @Get('usage/:period')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get usage for specific period',
    description: 'Retrieves usage statistics for a specific time period.'
  })
  @ApiParam({ name: 'period', description: 'Time period (day, week, month, year)' })
  @ApiResponse({
    status: 200,
    description: 'Usage statistics for period',
  })
  async getUsageByPeriod(@Param('period') period: string, @Request() req: any): Promise<Observable<any>> {
    return this.aiCoreClient.send(
      { cmd: 'billing.usage.period' },
      { userId: req.user.id, period },
    );
  }

  @Post('quota/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check quota availability',
    description: 'Checks if the user has enough quota for a request.'
  })
  @ApiResponse({
    status: 200,
    description: 'Quota availability',
  })
  async checkQuota(
    @Body() body: { model: string; estimatedTokens?: number },
    @Request() req: any,
  ): Promise<Observable<any>> {
    return this.aiCoreClient.send(
      { cmd: 'billing.quota.check' },
      { userId: req.user.id, ...body },
    );
  }
}
