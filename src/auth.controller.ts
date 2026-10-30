import { Body, CanActivate, Controller, ExecutionContext, Get, HttpCode, HttpStatus, Injectable, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { PrismaService } from './prisma.service.js';

type AuthTokenPayload = { sub: number; name: string; username: string; role: string };
type AuthenticatedRequest = { headers: { authorization?: string }; user?: AuthTokenPayload };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly database: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<AuthTokenPayload>(token);
      const currentUser = await this.database.user.findById(payload.sub);
      if (!currentUser) throw new UnauthorizedException();
      request.user = { sub: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: { name?: string; username?: string; password?: string }) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: { username?: string; password?: string }) {
    return this.authService.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    const { sub, name, username, role } = request.user!;
    return { id: sub, user: { name, username, role } };
  }
}
