import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ResponseInterceptor } from './response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Refinery API Gateway')
    .setDescription('API Gateway endpoints and proxy routes')
    .setVersion('1.0.0')
    .addCookieAuth(
      process.env.AUTH_COOKIE_NAME?.trim() || 'rt',
      {
        type: 'apiKey',
        in: 'cookie',
      },
      'refresh-cookie',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });
  const port = Number(process.env.PORT || process.env.API_GATEWAY_PORT || 3000);

  await app.listen(port);
}
bootstrap();
