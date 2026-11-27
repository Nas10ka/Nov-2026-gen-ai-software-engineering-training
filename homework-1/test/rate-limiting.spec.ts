import { INestApplication } from '@nestjs/common';
import { Request, Response } from 'express';
import request from 'supertest';
import { IpRateLimiter } from '../src/rate-limiting/rate-limiting.module';
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

  // Resolve the middleware Nest installed, including production options and storage.
  // Synthetic requests vary trusted req.ip without changing proxy trust or mocking trackers.
  async function activate(ip: string, index = 0) {
    const headers: Record<string, string> = {};
    const req = { ip, headers: { 'x-forwarded-for': `192.0.2.${index % 250}` } } as unknown as Request;
    let status = 200;
    let body: unknown;
    const res = {
      header: (name: string, value: string) => { headers[name.toLowerCase()] = value; },
      status: (value: number) => { status = value; return res; },
      json: (value: unknown) => { body = value; return res; },
    };
    const next = jest.fn();
    await app.get(IpRateLimiter).use(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
    return { status, headers, body };
  }

  it('gives independent IPs full quotas through the actual tracker and shared key generation', async () => {
    for (let index = 0; index < 100; index++) {
      await expect(activate('198.51.100.1', index)).resolves.toMatchObject({ status: 200 });
    }
    // IPv4-mapped IPv6 is the same tracker, not another independent quota.
    const blocked = await activate('::ffff:198.51.100.1', 101);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    for (let index = 0; index < 100; index++) {
      await expect(activate('198.51.100.2', index)).resolves.toMatchObject({ status: 200 });
    }
    await expect(activate('198.51.100.2', 101)).resolves.toMatchObject({ status: 429 });
    await expect(activate('198.51.100.1', 102)).resolves.toMatchObject({ status: 429 });
    for (let index = 0; index < 100; index++) {
      await expect(activate('2001:db8::1', index)).resolves.toMatchObject({ status: 200 });
    }
    await expect(activate('2001:0db8:0:0:0:0:0:1')).resolves.toMatchObject({ status: 429 });
    await expect(activate('2001:db8::2')).resolves.toMatchObject({ status: 200 });
  });

  it('keeps the configured block for 60 seconds and restores the full quota with controlled time', async () => {
    jest.useFakeTimers({ now: new Date('2024-02-29T00:00:00Z') });
    for (let index = 0; index < 100; index++) {
      await expect(activate('198.51.100.1', index)).resolves.toMatchObject({ status: 200 });
    }
    const blocked = await activate('198.51.100.1');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBe(60);
    await jest.advanceTimersByTimeAsync(59_999);
    const stillBlocked = await activate('198.51.100.1');
    expect(stillBlocked.status).toBe(429);
    expect(Number(stillBlocked.headers['retry-after'])).toBeGreaterThan(0);
    await jest.advanceTimersByTimeAsync(1);
    for (let index = 0; index < 100; index++) {
      await expect(activate('198.51.100.1', index)).resolves.toMatchObject({ status: 200 });
    }
    await expect(activate('198.51.100.1')).resolves.toMatchObject({ status: 429 });
  });
});
