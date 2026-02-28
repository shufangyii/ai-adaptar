import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Public } from '@ai-adaptar/common';

/**
 * 认证控制器
 */
@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功' })
  @ApiResponse({ status: 409, description: '用户名或邮箱已存在' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'john_doe' },
        email: { type: 'string', example: 'john@example.com' },
        password: { type: 'string', example: 'securepassword123' },
      },
      required: ['username', 'email', 'password'],
    },
  })
  async register(
    @Body() body: { username: string; email: string; password: string },
  ) {
    const result = await this.authService.register(body);
    return {
      user: {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        apiKey: result.user.apiKey,
      },
      accessToken: result.accessToken,
    };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'john_doe' },
        password: { type: 'string', example: 'securepassword123' },
      },
      required: ['username', 'password'],
    },
  })
  async login(@Body() body: { username: string; password: string }) {
    const result = await this.authService.login(body);
    return {
      user: {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        apiKey: result.user.apiKey,
      },
      accessToken: result.accessToken,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async getCurrentUser(@Request() req: any) {
    return {
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        apiKey: req.user.apiKey,
      },
    };
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新访问令牌' })
  @ApiResponse({ status: 200, description: '刷新成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async refreshToken(@Request() req: any) {
    const result = await this.authService.refreshToken(req.user.id);
    return {
      accessToken: result.accessToken,
    };
  }

  @Post('api-key/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重新生成 API Key' })
  @ApiResponse({ status: 200, description: '重新生成成功' })
  @ApiResponse({ status: 401, description: '未授权' })
  async regenerateApiKey(@Request() req: any) {
    const result = await this.authService.regenerateApiKey(req.user.id);
    return {
      apiKey: result.apiKey,
    };
  }
}
