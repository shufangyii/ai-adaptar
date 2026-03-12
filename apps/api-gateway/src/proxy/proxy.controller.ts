import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../guards/auth.guard';
import { BalanceGuard } from '../guards/balance.guard';
import { DlpGuard } from '../guards/dlp.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { ProxyService } from './proxy.service';

@Controller('v1')
@UseGuards(AuthGuard, BalanceGuard, RateLimitGuard, DlpGuard)
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  /**
   * 代理转发标准 `/v1/chat/completions` API 调用
   */
  @Post('chat/completions')
  async chatCompletions(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forwardChatCompletions(req, res);
  }

  /**
   * 代理转发客户端查询可用模型的信息 `/v1/models`
   */
  @Get('models')
  async getModels(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forwardModels(req, res);
  }
}
