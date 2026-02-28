import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@ai-adaptar/database';
import { ConfigService } from '@nestjs/config';

/**
 * 认证服务
 * 处理用户注册、登录、token 生成等功能
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 用户注册
   */
  async register(data: {
    username: string;
    email: string;
    password: string;
  }): Promise<{ user: User; accessToken: string }> {
    // 检查用户名是否已存在
    const existingUsername = await this.userRepository.findOne({
      where: { username: data.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    // 检查邮箱是否已存在
    const existingEmail = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 创建用户
    const user = this.userRepository.create({
      username: data.username,
      email: data.email,
      password: hashedPassword,
      status: 'active',
    });

    const savedUser = await this.userRepository.save(user);

    // 生成 API Key
    const apiKey = this.generateApiKey();
    savedUser.apiKey = apiKey;
    await this.userRepository.save(savedUser);

    // 生成 JWT token
    const accessToken = this.generateToken(savedUser);

    return {
      user: savedUser,
      accessToken,
    };
  }

  /**
   * 用户登录
   */
  async login(data: {
    username: string;
    password: string;
  }): Promise<{ user: User; accessToken: string }> {
    // 查找用户
    const user = await this.userRepository.findOne({
      where: { username: data.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 验证密码
    if (!user.password) {
      throw new UnauthorizedException('Password not set for user');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 检查用户状态
    if (user.status !== 'active') {
      throw new UnauthorizedException('User account is not active');
    }

    // 生成 JWT token
    const accessToken = this.generateToken(user);

    return {
      user,
      accessToken,
    };
  }

  /**
   * 验证用户
   */
  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User account is not active');
    }

    return user;
  }

  /**
   * 使用 API Key 验证
   */
  async validateApiKey(apiKey: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { apiKey },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User account is not active');
    }

    return user;
  }

  /**
   * 刷新 token
   */
  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = await this.validateUser(userId);
    const accessToken = this.generateToken(user);

    return { accessToken };
  }

  /**
   * 生成 JWT token
   */
  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '7d',
    });
  }

  /**
   * 生成 API Key
   */
  private generateApiKey(): string {
    const prefix = 'aiadaptar_';
    const randomBytes = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');
    return `${prefix}${randomBytes}`;
  }

  /**
   * 重新生成 API Key
   */
  async regenerateApiKey(userId: string): Promise<{ apiKey: string }> {
    const user = await this.validateUser(userId);
    const newApiKey = this.generateApiKey();

    user.apiKey = newApiKey;
    await this.userRepository.save(user);

    return { apiKey: newApiKey };
  }
}
