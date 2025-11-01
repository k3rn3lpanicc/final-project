import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../database/user.entity';

interface RefreshToken {
  token: string;
  expiresAt: Date;
  userId: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  private refreshTokens: Map<string, RefreshToken> = new Map();
  private readonly adminUsername: string;
  private readonly adminPasswordHash: string;

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    this.adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    this.adminPasswordHash = bcrypt.hashSync(adminPassword, 10);
  }

  async validateUser(username: string, password: string): Promise<boolean> {
    if (username !== this.adminUsername) {
      return false;
    }
    return bcrypt.compareSync(password, this.adminPasswordHash);
  }

  async login(username: string, password: string) {
    const isValid = await this.validateUser(username, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { username, sub: username, role: 'admin' };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken(username, 'admin', UserRole.ADMIN);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: process.env.JWT_ACCESS_EXPIRATION || '15m',
      role: 'admin',
    };
  }

  async userRegister(email: string, password: string) {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate password length
    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long');
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      passwordHash,
      role: UserRole.USER,
    });

    await this.userRepository.save(user);

    // Auto-login after registration
    return this.userLogin(email, password);
  }

  async userLogin(email: string, password: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Don't allow admin users to login via user endpoint
    if (user.role === UserRole.ADMIN) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken(user.id, user.email, user.role);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: process.env.JWT_ACCESS_EXPIRATION || '15m',
      role: user.role,
    };
  }

  async refresh(refreshToken: string) {
    const storedToken = this.refreshTokens.get(refreshToken);
    
    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > storedToken.expiresAt) {
      this.refreshTokens.delete(refreshToken);
      throw new UnauthorizedException('Refresh token expired');
    }

    let payload: any;
    if (storedToken.role === UserRole.ADMIN) {
      payload = { username: this.adminUsername, sub: this.adminUsername, role: 'admin' };
    } else {
      const user = await this.userRepository.findOne({ where: { id: storedToken.userId } });
      if (!user) {
        this.refreshTokens.delete(refreshToken);
        throw new UnauthorizedException('User not found');
      }
      payload = { email: user.email, sub: user.id, role: user.role };
    }

    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      expires_in: process.env.JWT_ACCESS_EXPIRATION || '15m',
    };
  }

  private generateRefreshToken(userId: string, identifier: string, role: UserRole): string {
    const token = this.jwtService.sign(
      { identifier, sub: userId, type: 'refresh', role },
      { expiresIn: '7d' }
    );

    const expirationDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    this.refreshTokens.set(token, { token, expiresAt, userId, role });

    return token;
  }

  async logout(refreshToken: string) {
    this.refreshTokens.delete(refreshToken);
    return { message: 'Logged out successfully' };
  }
}

