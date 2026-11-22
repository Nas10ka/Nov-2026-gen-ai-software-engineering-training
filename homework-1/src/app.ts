import { INestApplication } from '@nestjs/common';
import { HttpErrorFilter } from './common/http-error.filter';
import { validationPipe } from './common/validation';

export function configureApp(app: INestApplication) {
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.getHttpAdapter().getInstance().set('trust proxy', false);
  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();
  return app;
}
