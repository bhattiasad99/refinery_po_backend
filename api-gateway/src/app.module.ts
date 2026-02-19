import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GatewayAuthGuard } from './gateway-auth.guard';
import { ProxyController } from './proxy.controller';

@Module({
  imports: [AuthModule],
  controllers: [AppController, ProxyController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: GatewayAuthGuard,
    },
  ],
})
export class AppModule {}
