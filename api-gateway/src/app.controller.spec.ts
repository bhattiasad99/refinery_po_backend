import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GatewayAuthGuard } from './gateway-auth.guard';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, GatewayAuthGuard],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return gateway status', () => {
      expect(appController.getHealth()).toEqual({
        body: {
          status: 'ok',
          service: 'api-gateway',
        },
        message: 'Gateway healthy',
      });
    });
  });
});
