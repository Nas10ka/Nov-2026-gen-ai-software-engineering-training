import { INestApplication } from '@nestjs/common';
import { HttpErrorFilter } from './common/http-error.filter';
import { validationPipe } from './common/validation';
import { IpRateLimiter } from './rate-limiting/rate-limiting.module';
import { NextFunction, Request, Response } from 'express';

export function configureApp(app: INestApplication) {
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.getHttpAdapter().getInstance().set('trust proxy', false);
  const limiter = app.get(IpRateLimiter);
  app.use((request: Request, response: Response, next: NextFunction) => {
    void limiter.use(request, response, next).catch(next);
  });
  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();
  return app;
}
