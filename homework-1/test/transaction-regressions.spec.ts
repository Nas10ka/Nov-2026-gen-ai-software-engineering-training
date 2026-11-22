import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Transaction, TransactionRepository } from '../src/transactions/transaction.repository';
import { createApp, expectValidation, snapshot } from './helpers';

const A = 'ACC-12345';
const B = 'ACC-67890';
const C = 'ACC-00000';
const deposit = { type: 'deposit', toAccount: A, currency: 'USD', amount: 12.34 };

describe('Transaction precision, account identity, and atomicity', () => {
  let app: INestApplication;
  beforeEach(async () => { app = await createApp(); });
  afterEach(async () => { jest.restoreAllMocks(); await app.close(); });

  const post = (body: object) => request(app.getHttpServer()).post('/transactions').send(body);
  const balance = async (account: string) =>
    (await request(app.getHttpServer()).get(`/accounts/${account}/balance`).expect(200)).body;
  const seed = async () => {
    await post(deposit).expect(201);
    await post({ ...deposit, toAccount: B, amount: 3.21 }).expect(201);
    await post({ ...deposit, toAccount: C, currency: 'EUR', amount: 7.89 }).expect(201);
  };

  it.each([1e-7, 1e-8, 0.001, 0.011, 1.234, 12.3456])(
    'rejects amount %s with useful field details and preserves seeded state', async amount => {
      await seed();
      const before = await snapshot(app, [A, B, C]);
      const response = await post({ ...deposit, amount });
      // Check state even when the response exposes a server-error regression.
      expect(await snapshot(app, [A, B, C])).toEqual(before);
      expect(response.status).toBe(400);
      expectValidation(response.body, 'amount', /positive|decimal|number|0\.01/i);
    },
  );

  it.each([0.01, 0.1, 1.2, 42.5])('accepts valid amount %s unchanged', async amount => {
    const response = await post({ ...deposit, amount }).expect(201);
    expect(response.body.amount).toBe(amount);
    expect((await balance(A)).balances).toEqual({ USD: amount });
  });

  it('retains 0.90 after subtracting large exact monetary values', async () => {
    await post({ ...deposit, amount: 90071992547409.9 }).expect(201);
    await post({ type: 'withdrawal', fromAccount: A, currency: 'USD', amount: 90071992547409 }).expect(201);
    expect((await balance(A)).balances).toEqual({ USD: 0.90 });
  });

  it.each(['ACC-abcde', 'ACC-aB1cD'].flatMap(account => [
    { type: 'deposit', toAccount: account, amount: 1, currency: 'USD' },
    { type: 'withdrawal', fromAccount: account, amount: 1, currency: 'USD' },
    { type: 'transfer', fromAccount: account, toAccount: B, amount: 1, currency: 'USD' },
    { type: 'transfer', fromAccount: B, toAccount: account, amount: 1, currency: 'USD' },
  ]))('preserves alphanumeric account identity on creation: %j', async body => {
    expect((await post(body).expect(201)).body).toMatchObject(body);
  });

  // Independent persisted fixtures isolate reads from POST's account-validation regression.
  function caseFixtures(account: string) {
    const records: Transaction[] = [
      { ...deposit, id: 'lower-deposit', fromAccount: null, toAccount: account, type: 'deposit' },
      { id: 'lower-sender', fromAccount: account, toAccount: B, type: 'transfer', amount: 2.34, currency: 'USD' },
      { id: 'lower-recipient', fromAccount: B, toAccount: account, type: 'transfer', amount: 1, currency: 'USD' },
      { ...deposit, id: 'upper-deposit', fromAccount: null, toAccount: account.toUpperCase(), amount: 9, type: 'deposit' },
    ].map(record => ({ ...record, timestamp: '2024-02-29T12:00:00.000Z', status: 'completed' } as Transaction));
    records.forEach(record => app.get(TransactionRepository).save(record));
    return records;
  }

  it.each(['ACC-abcde', 'ACC-aB1cD'])('filters %s exactly, matching sender and recipient without normalization', async accountId => {
    const records = caseFixtures(accountId);
    expect((await request(app.getHttpServer()).get('/transactions').query({ accountId }).expect(200)).body)
      .toEqual(records.slice(0, 3));
    expect((await request(app.getHttpServer()).get('/transactions')
      .query({ accountId: accountId.toUpperCase() }).expect(200)).body).toEqual([records[3]]);
  });

  it.each(['ACC-abcde', 'ACC-aB1cD'])('looks up balance for %s without merging uppercase identity', async accountId => {
    caseFixtures(accountId);
    expect(await balance(accountId)).toEqual({ accountId, balances: { USD: 11 } });
    expect(await balance(accountId.toUpperCase())).toEqual({ accountId: accountId.toUpperCase(), balances: { USD: 9 } });
  });

  it.each(['BAD-12345', 'acc-12345', 'ACC-1234', 'ACC-123456', 'ACC-12_45', 'ACC-12!45'])(
    'rejects malformed account %s on writes, filters, and balances', async account => {
      await seed();
      const before = await snapshot(app, [A, B, C]);
      for (const [body, field] of [
        [{ ...deposit, toAccount: account }, 'toAccount'],
        [{ type: 'withdrawal', fromAccount: account, currency: 'USD', amount: 1 }, 'fromAccount'],
        [{ type: 'transfer', fromAccount: account, toAccount: B, currency: 'USD', amount: 1 }, 'fromAccount'],
        [{ type: 'transfer', fromAccount: A, toAccount: account, currency: 'USD', amount: 1 }, 'toAccount'],
      ] as const) {
        const response = await post(body).expect(400);
        expectValidation(response.body, field, /match|account|alphanumeric/i);
      }
      const history = await request(app.getHttpServer()).get('/transactions').query({ accountId: account }).expect(400);
      expectValidation(history.body, 'accountId', /match|account|alphanumeric/i);
      const result = await request(app.getHttpServer()).get(`/accounts/${encodeURIComponent(account)}/balance`).expect(400);
      expectValidation(result.body, 'accountId', /match|account|alphanumeric/i);
      expect(await snapshot(app, [A, B, C])).toEqual(before);
    },
  );

  it.each([
    ['deposit', {}, 'toAccount'],
    ['withdrawal', {}, 'fromAccount'],
    ['transfer', { toAccount: B }, 'fromAccount'],
    ['transfer', { fromAccount: A }, 'toAccount'],
    ['deposit', { toAccount: A, fromAccount: B }, 'fromAccount'],
    ['withdrawal', { fromAccount: A, toAccount: B }, 'toAccount'],
    ['transfer', { fromAccount: A, toAccount: A }, 'toAccount'],
  ] as const)('rejects invalid %s accounts %j and identifies %s', async (type, accounts, field) => {
    await seed();
    const before = await snapshot(app, [A, B, C]);
    const response = await post({ type, ...accounts, currency: 'USD', amount: 1 }).expect(400);
    expectValidation(response.body, field, /string|match|only|different/i);
    expect(await snapshot(app, [A, B, C])).toEqual(before);
  });

  it.each(['sender', 'recipient'] as const)('rejects transfer exceeding safe %s balance atomically', async side => {
    await seed();
    const amount = 90_000_000_000_000;
    if (side === 'sender') {
      await post({ type: 'withdrawal', fromAccount: A, currency: 'USD', amount }).expect(201);
    } else {
      await post({ ...deposit, toAccount: B, amount }).expect(201);
    }
    const before = await snapshot(app, [A, B, C]);
    const response = await post({ type: 'transfer', fromAccount: A, toAccount: B,
      currency: 'USD', amount: 1_000_000_000_000 }).expect(400);
    expectValidation(response.body, 'amount', /balance.*safe|safe.*precision/i);
    expect(await snapshot(app, [A, B, C])).toEqual(before);
  });

  it('cancels repeated decimals exactly and isolates currency and unrelated accounts', async () => {
    await post({ ...deposit, toAccount: C, amount: 7.89 }).expect(201);
    await post({ ...deposit, currency: 'EUR', amount: 2.34 }).expect(201);
    for (let index = 0; index < 10; index++) {
      await post({ ...deposit, amount: 0.1 }).expect(201);
    }
    expect((await balance(A)).balances).toEqual({ USD: 1, EUR: 2.34 });
    for (let index = 0; index < 10; index++) {
      await post({ type: 'transfer', fromAccount: A, toAccount: B, currency: 'USD', amount: 0.1 }).expect(201);
    }
    expect((await balance(A)).balances).toEqual({ USD: 0, EUR: 2.34 });
    expect((await balance(B)).balances).toEqual({ USD: 1 });
    await post({ type: 'withdrawal', fromAccount: B, currency: 'USD', amount: 1 }).expect(201);
    expect((await balance(B)).balances).toEqual({ USD: 0 });
    expect((await balance(C)).balances).toEqual({ USD: 7.89 });
  });

  it('generates unique IDs, controlled timestamps, and complete response contracts for each type', async () => {
    const now = new Date('2024-02-29T12:34:56.789Z');
    // Mock only Date: HTTP and throttler scheduling continue normally.
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'setImmediate', 'clearImmediate', 'nextTick', 'performance', 'hrtime', 'queueMicrotask'] });
    try {
      jest.setSystemTime(now);
      const bodies = [deposit,
        { type: 'withdrawal', fromAccount: A, amount: 0.34, currency: 'USD' },
        { type: 'transfer', fromAccount: A, toAccount: B, amount: 2, currency: 'USD' }];
      const created = [];
      for (const [index, body] of bodies.entries()) {
        jest.setSystemTime(now.getTime() + index * 1_000);
        const response = await post(body).expect(201);
        expect(response.body).toEqual({ ...body, fromAccount: 'fromAccount' in body ? body.fromAccount : null,
          toAccount: 'toAccount' in body ? body.toAccount : null,
          id: expect.stringMatching(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/),
          timestamp: new Date(now.getTime() + index * 1_000).toISOString(), status: 'completed' });
        expect((await request(app.getHttpServer()).get(`/transactions/${response.body.id}`).expect(200)).body)
          .toEqual(response.body);
        created.push(response.body);
      }
      expect(new Set(created.map(transaction => transaction.id)).size).toBe(3);
      expect((await request(app.getHttpServer()).get('/transactions').expect(200)).body).toEqual(created);
    } finally { jest.useRealTimers(); }
  });
});
