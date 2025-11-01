import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

interface RefreshToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private refreshTokens: Map<string, RefreshToken> = new Map();
  private readonly adminUsername: string;
  private readonly adminPasswordHash: string;

  constructor(private jwtService: JwtService) {
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

    const payload = { username, sub: username };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken(username);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: process.env.JWT_ACCESS_EXPIRATION || '15m',
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

    const payload = { username: this.adminUsername, sub: this.adminUsername };
    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      expires_in: process.env.JWT_ACCESS_EXPIRATION || '15m',
    };
  }

  private generateRefreshToken(username: string): string {
    const token = this.jwtService.sign(
      { username, sub: username, type: 'refresh' },
      { expiresIn: '7d' }
    );

    const expirationDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    this.refreshTokens.set(token, { token, expiresAt });

    return token;
  }

  async logout(refreshToken: string) {
    this.refreshTokens.delete(refreshToken);
    return { message: 'Logged out successfully' };
  }
}
