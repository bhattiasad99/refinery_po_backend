import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ResponseInterceptor } from './response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.listen(process.env.API_GATEWAY_PORT ?? 3000);
}
bootstrap();
