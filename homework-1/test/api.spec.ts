import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app';
import { expectValidation, snapshot } from './helpers';

const deposit = { toAccount: 'ACC-12345', amount: 100.50, currency: 'USD', type: 'deposit' };
const transfer = { fromAccount: 'ACC-12345', toAccount: 'ACC-67890', amount: 20.25, currency: 'USD', type: 'transfer' };

describe('Banking API', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(module.createNestApplication());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  it('creates, lists, retrieves and generates read-only fields', async () => {
    const { body } = await request(app.getHttpServer()).post('/transactions').send(deposit).expect(201);
    expect(body).toMatchObject({ ...deposit, fromAccount: null, status: 'completed' });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    const found = await request(app.getHttpServer()).get(`/transactions/${body.id}`).expect(200);
    expect(found.body).toEqual(body);
    expect((await request(app.getHttpServer()).get('/transactions').expect(200)).body).toEqual([body]);
    await request(app.getHttpServer()).get('/transactions/missing').expect(404);
    await request(app.getHttpServer()).get('/missing').expect(404);
  });

  it('handles deposits, withdrawals, transfers, currencies, decimal precision and negative balances', async () => {
    for (const data of [deposit, transfer,
      { ...deposit, amount: 0.1, currency: 'EUR' },
      { ...deposit, amount: 0.2, currency: 'EUR' },
      { fromAccount: 'ACC-67890', amount: 30, currency: 'USD', type: 'withdrawal' }]) {
      await request(app.getHttpServer()).post('/transactions').send(data).expect(201);
    }
    expect((await request(app.getHttpServer()).get('/accounts/ACC-12345/balance')).body)
      .toEqual({ accountId: 'ACC-12345', balances: { USD: 80.25, EUR: 0.3 } });
    expect((await request(app.getHttpServer()).get('/accounts/ACC-67890/balance')).body.balances).toEqual({ USD: -9.75 });
    expect((await request(app.getHttpServer()).get('/accounts/ACC-00000/balance').expect(200)).body.balances).toEqual({});
    await request(app.getHttpServer()).get('/accounts/invalid/balance').expect(400);
  });

  it.each([
    { amount: 0 }, { amount: -1 }, { amount: 1.001 }, { amount: '10' }, { amount: null },
    { amount: 1e20 }, { currency: 'ZZZ' }, { currency: 'usd' }, { currency: null },
    { toAccount: null },
    { type: 'unknown' }, { id: 'client-id' }, { status: 'pending' }, { timestamp: '2024-01-01' },
  ])('rejects invalid data without changing balances: %j', async patch => {
    const seeded = (await request(app.getHttpServer()).post('/transactions').send(deposit).expect(201)).body;
    const result = await request(app.getHttpServer()).post('/transactions').send({ ...deposit, ...patch }).expect(400);
    const messages: Record<string, RegExp> = {
      amount: /number|positive|decimal|0\.01|precision/i,
      currency: /currency|ISO|match|string/i, toAccount: /match|string/i,
      type: /deposit|withdrawal|transfer/i,
      id: /not exist|not allowed|generated/i, status: /not exist|not allowed|generated/i,
      timestamp: /not exist|not allowed|generated/i,
    };
    const field = Object.keys(patch)[0];
    expectValidation(result.body, field, messages[field]);
    expect((await request(app.getHttpServer()).get('/transactions')).body).toEqual([seeded]);
    expect((await request(app.getHttpServer()).get('/accounts/ACC-12345/balance')).body.balances).toEqual({ USD: 100.5 });
  });

  it('rejects malformed JSON and non-object payloads without changing seeded state', async () => {
    await request(app.getHttpServer()).post('/transactions').send(deposit).expect(201);
    const before = await snapshot(app, ['ACC-12345']);
    await request(app.getHttpServer()).post('/transactions').set('Content-Type', 'application/json').send('{').expect(400);
    await request(app.getHttpServer()).post('/transactions').send([]).expect(400);
    await request(app.getHttpServer()).post('/transactions').send({}).expect(400);
    expect(await snapshot(app, ['ACC-12345'])).toEqual(before);
  });

  it('rejects unsafe resulting balances atomically', async () => {
    await request(app.getHttpServer()).post('/transactions').send({ ...deposit, amount: 90_000_000_000_000 }).expect(201);
    const before = await snapshot(app, ['ACC-12345']);
    const response = await request(app.getHttpServer()).post('/transactions')
      .send({ ...deposit, amount: 1_000_000_000_000 }).expect(400);
    expectValidation(response.body, 'amount', /balance.*safe|safe.*precision/i);
    expect(await snapshot(app, ['ACC-12345'])).toEqual(before);
  });

});
