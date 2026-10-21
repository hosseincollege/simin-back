import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service.js';

type User = { name: string; username: string; passwordHash: string; role: 'admin' | 'user' };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(input: { name?: string; username?: string; password?: string }) {
    const name = input.name?.trim();
    const username = input.username?.trim().toLowerCase();
    const password = input.password;
    if (!name || !username || !password || password.length < 8) {
      throw new BadRequestException('نام، نام کاربری و رمز عبور حداقل ۸ حرفی لازم است.');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      return await this.prisma.user.create({
        data: { name, username, passwordHash },
      });
    } catch (error) {
      if (['P2002', '23505', 2601, 2627].includes((error as { code?: string | number }).code ?? '')) {
        throw new ConflictException('این نام کاربری قبلاً ثبت شده است.');
      }
      throw error;
    }
  }

  async login(input: { username?: string; password?: string }) {
    if (!input.username || !input.password) {
      throw new BadRequestException('نام کاربری و رمز عبور را وارد کنید.');
    }
    const username = input.username.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('نام کاربری یا رمز عبور درست نیست.');
    }
    return {
      token: await this.jwt.signAsync({ sub: user.id, name: user.name, username: user.username, role: user.role }),
      user: { name: user.name, username: user.username, role: user.role },
    };
  }
}
