import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  const app = configureApp(await NestFactory.create(AppModule));
  await app.listen(port, '127.0.0.1');
  console.log(`Banking API running at http://127.0.0.1:${port}`);
}

bootstrap().catch(error => { console.error(error); process.exitCode = 1; });
