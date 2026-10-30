import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './auth.controller.js';
import { PrismaService } from './prisma.service.js';
import { AdminGuard, ReviewGuard, WorkshopsController } from './workshops.controller.js';
import { WorkshopsService } from './workshops.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env['JWT_SECRET'];
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET must be configured with at least 32 characters.');
        }
        return { secret, signOptions: { expiresIn: '8h' } };
      },
    }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'back',
    }),
  ],
  controllers: [AppController, AuthController, WorkshopsController, DocumentsController],
  providers: [AppService, AuthService, PrismaService, JwtAuthGuard, AdminGuard, ReviewGuard, WorkshopsService, DocumentsService],
})
export class AppModule {}
