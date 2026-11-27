import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app';

export async function createApp(): Promise<INestApplication> {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(module.createNestApplication());
  await app.init();
  return app;
}

export function expectValidation(body: unknown, field: string, message: RegExp) {
  expect(body).toMatchObject({
    error: 'Validation failed',
    details: expect.arrayContaining([expect.objectContaining({ field, message: expect.stringMatching(message) })]),
  });
}

export async function snapshot(app: INestApplication, accounts: string[]) {
  const history = (await request(app.getHttpServer()).get('/transactions').expect(200)).body;
  const balances = [];
  for (const account of accounts) {
    balances.push((await request(app.getHttpServer()).get(`/accounts/${account}/balance`).expect(200)).body);
  }
  return { history, balances };
}
