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

  describe('events', () => {
    it('should accept a valid event payload', () => {
      expect(
        appController.handleEvent({
          id: 'evt_1',
          name: 'purchase-order.created',
          body: { id: 'po_1' },
          source: 'purchase-orders',
          url: 'http://purchase-orders:8003/purchase-orders/po_1',
          timestamp: '2026-02-18T00:00:00.000Z',
        }),
      ).toEqual({
        body: {
          accepted: true,
          eventName: 'purchase-order.created',
        },
        message: 'Event received',
      });
    });
  });
});
