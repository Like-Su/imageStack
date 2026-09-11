import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import type { Server } from 'node:http';

// Custom imports
import { AppModule } from './app.module';
import { CsrfService } from './common/csrf/csrf.service';
import { UPLOAD_VIDEO_READ_TIMEOUT_MS } from './modules/uploads/upload.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpServer = app.getHttpServer() as Server;
  httpServer.requestTimeout = UPLOAD_VIDEO_READ_TIMEOUT_MS + 60_000;

  // 获取 ConfigService 实例
  const configService = app.get(ConfigService);
  // 获取环境变量
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', '/api');
  const corsOrigin = configService.get<string>('CORS_ORIGIN', '*');
  const allowedOrigins =
    corsOrigin.trim() === '*'
      ? '*'
      : corsOrigin
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

  // 设置前缀
  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      {
        path: 'system/health',
        method: RequestMethod.GET,
      },
    ],
  });
  // 设置跨域
  app.enableCors({
    origin: allowedOrigins,
    credentials: allowedOrigins !== '*',
    exposedHeaders: [
      'Retry-After',
      'Accept-Ranges',
      'Content-Range',
      'Content-Disposition',
      'ETag',
    ],
  });

  // 设置Helmet
  app.use(helmet());

  app.use(app.get(CsrfService).protect);

  // 管道校验
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动去除 DTO 中未定义的属性
      forbidNonWhitelisted: true, // 如果请求中包含未定义的属性，则抛出异常
      transform: true, // 自动转换 payload 为 DTO 实例
      transformOptions: {
        enableImplicitConversion: true, // 启用隐式类型转换
      },
    }),
  );

  // 关闭应用时的钩子
  app.enableShutdownHooks();

  // 获取 Logger 实例
  const logger = new Logger('Bootstrap');

  await app.listen(port, () => {
    const allowEnvs = ['development', 'test'];
    const curEnv = configService.get('NODE_ENV', 'development');
    if (allowEnvs.includes(curEnv)) {
      logger.log(`Server is running on http://localhost:${port}${apiPrefix}`);
    }
  });
}
bootstrap();
