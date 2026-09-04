import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { doubleCsrf } from 'csrf-csrf';

// Custom imports
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 获取 ConfigService 实例
  const configService = app.get(ConfigService);
  // 获取环境变量
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', '/api');
  const corsOrigin = configService.get<string>('CORS_ORIGIN', '*');

  // 设置前缀
  app.setGlobalPrefix(apiPrefix);
  // 设置跨域
  app.enableCors({
    origin: corsOrigin,
  });

  // 设置Helmet
  app.use(helmet());

  // TODO: CSRF
  // https://docs.nestjs.com/security/csrf
  const { doubleCsrfProtection } = doubleCsrf({
    getSecret: (req) => '123456',
    getSessionIdentifier: (req) => '123456',
  });

  app.use(doubleCsrfProtection);

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
