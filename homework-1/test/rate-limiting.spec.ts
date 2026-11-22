import { INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import request from 'supertest';
import { AccountsController } from '../src/accounts/accounts.module';
import { IpThrottlerGuard } from '../src/rate-limiting/rate-limiting.module';
import { TransactionsController } from '../src/transactions/transactions.controller';
import { TransactionRepository } from '../src/transactions/transaction.repository';
import { createApp, expectValidation } from './helpers';

const deposit = { type: 'deposit', toAccount: 'ACC-12345', amount: 1, currency: 'USD' };

describe('Configured per-IP rate limiting', () => {
  let app: INestApplication;
  beforeEach(async () => { app = await createApp(); });
  afterEach(async () => { await app.close(); jest.useRealTimers(); });

  it('allows requests 1–100 across methods/routes, blocks POST 101, and ignores spoofed forwarded IPs', async () => {
    const created = [];
    for (let index = 0; index < 100; index++) {
      const forwarded = `192.0.2.${index + 1}`;
      if (index % 4 === 0) {
        const response = await request(app.getHttpServer()).post('/transactions')
          .set('X-Forwarded-For', forwarded).send(deposit).expect(201);
        created.push(response.body);
      } else {
        const paths = ['/transactions', '/accounts/ACC-12345/balance', `/transactions/${created[0].id}`];
        await request(app.getHttpServer()).get(paths[(index - 1) % 3])
          .set('X-Forwarded-For', forwarded).expect(200);
      }
    }
    const response = await request(app.getHttpServer()).post('/transactions')
      .set('X-Forwarded-For', '198.51.100.99').send({ ...deposit, amount: 99 }).expect(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    // Reads also throttle now; inspect persisted history without spending another request.
    expect(app.get(TransactionRepository).all()).toEqual(created);
  });

  it('counts validation failures toward the same quota and preserves seeded data', async () => {
    const seeded = (await request(app.getHttpServer()).post('/transactions').send(deposit).expect(201)).body;
    for (let index = 0; index < 99; index++) {
      const response = index % 2
        ? await request(app.getHttpServer()).get('/transactions?type=invalid').expect(400)
        : await request(app.getHttpServer()).post('/transactions').send({ ...deposit, amount: 0 }).expect(400);
      expectValidation(response.body, index % 2 ? 'type' : 'amount', /allowed|deposit|transfer|0\.01|number/i);
    }
    const response = await request(app.getHttpServer()).post('/transactions').send(deposit).expect(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(app.get(TransactionRepository).all()).toEqual([seeded]);
  });

  it.each(['unknown route', 'malformed JSON'])('limits more than 100 %s requests from one IP', async kind => {
    const send = () => kind === 'unknown route'
      ? request(app.getHttpServer()).get('/not-a-route')
      : request(app.getHttpServer()).post('/transactions').set('Content-Type', 'application/json').send('{');
    for (let index = 0; index < 100; index++) {
      await send().expect(kind === 'unknown route' ? 404 : 400);
    }
    const blocked = await send();
    expect(app.get(TransactionRepository).all()).toEqual([]);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    await request(app.getHttpServer()).get('/transactions').expect(429);
  });

  // Resolve the APP_GUARD instance Nest installed, including production options and storage.
  // Synthetic contexts vary trusted req.ip without changing proxy trust or mocking trackers.
  function configuredGuard() {
    const guards = [...app.get(ModulesContainer).values()]
      .flatMap(module => [...module.providers.values()])
      .map(provider => provider.instance)
      .filter((instance): instance is IpThrottlerGuard => instance instanceof IpThrottlerGuard);
    expect(guards).toHaveLength(1);
    return guards[0];
  }

  function activate(guard: IpThrottlerGuard, ip: string, index = 0) {
    const headers: Record<string, number> = {};
    const req = { ip, headers: { 'x-forwarded-for': `192.0.2.${index % 250}` } };
    const res = { header: (name: string, value: number) => { headers[name.toLowerCase()] = value; } };
    const context = index % 2
      ? new ExecutionContextHost([req, res], AccountsController, AccountsController.prototype.balance)
      : new ExecutionContextHost([req, res], TransactionsController, TransactionsController.prototype.create);
    return { result: guard.canActivate(context), headers };
  }

  it('gives independent IPs full quotas through the actual tracker and shared key generation', async () => {
    const guard = configuredGuard();
    for (let index = 0; index < 100; index++) {
      await expect(activate(guard, '198.51.100.1', index).result).resolves.toBe(true);
    }
    // IPv4-mapped IPv6 is the same tracker, not another independent quota.
    const blocked = activate(guard, '::ffff:198.51.100.1', 101);
    await expect(blocked.result).rejects.toMatchObject({ status: 429 });
    expect(blocked.headers['retry-after']).toBeGreaterThan(0);
    for (let index = 0; index < 100; index++) {
      await expect(activate(guard, '198.51.100.2', index).result).resolves.toBe(true);
    }
    await expect(activate(guard, '198.51.100.2', 101).result).rejects.toMatchObject({ status: 429 });
    await expect(activate(guard, '198.51.100.1', 102).result).rejects.toMatchObject({ status: 429 });
  });

  it('keeps the configured block for 60 seconds and restores the full quota with controlled time', async () => {
    jest.useFakeTimers({ now: new Date('2024-02-29T00:00:00Z') });
    const guard = configuredGuard();
    for (let index = 0; index < 100; index++) {
      await expect(activate(guard, '198.51.100.1', index).result).resolves.toBe(true);
    }
    const blocked = activate(guard, '198.51.100.1');
    await expect(blocked.result).rejects.toMatchObject({ status: 429 });
    expect(blocked.headers['retry-after']).toBe(60);
    await jest.advanceTimersByTimeAsync(59_999);
    const stillBlocked = activate(guard, '198.51.100.1');
    await expect(stillBlocked.result).rejects.toMatchObject({ status: 429 });
    expect(stillBlocked.headers['retry-after']).toBeGreaterThan(0);
    await jest.advanceTimersByTimeAsync(1);
    for (let index = 0; index < 100; index++) {
      await expect(activate(guard, '198.51.100.1', index).result).resolves.toBe(true);
    }
    await expect(activate(guard, '198.51.100.1').result).rejects.toMatchObject({ status: 429 });
  });
});
