import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Transaction, TransactionRepository } from '../src/transactions/transaction.repository';
import { createApp, expectValidation } from './helpers';

const A = 'ACC-12345';
const B = 'ACC-67890';
const C = 'ACC-00000';

// Valid persisted records; only timestamps/IDs bypass creation, to pin millisecond boundaries.
// Deliberately nonchronological insertion order protects the documented history order.
const fixtures: Transaction[] = [
  { id: 'end', fromAccount: A, toAccount: B, type: 'transfer', currency: 'USD', timestamp: '2024-02-29T23:59:59.999Z' },
  { id: 'before', fromAccount: A, toAccount: B, type: 'transfer', currency: 'GBP', timestamp: '2024-02-28T23:59:59.999Z' },
  { id: 'recipient', fromAccount: C, toAccount: A, type: 'transfer', currency: 'EUR', timestamp: '2024-02-29T00:00:00.000Z' },
  { id: 'unrelated', fromAccount: B, toAccount: C, type: 'transfer', currency: 'USD', timestamp: '2024-02-29T12:00:00.000Z' },
  { id: 'deposit', fromAccount: null, toAccount: A, type: 'deposit', currency: 'USD', timestamp: '2024-02-29T12:00:00.000Z' },
  { id: 'withdrawal', fromAccount: A, toAccount: null, type: 'withdrawal', currency: 'JPY', timestamp: '2024-02-29T12:00:00.000Z' },
  { id: 'after', fromAccount: A, toAccount: C, type: 'transfer', currency: 'EUR', timestamp: '2024-03-01T00:00:00.000Z' },
  { id: 'middle', fromAccount: A, toAccount: C, type: 'transfer', currency: 'GBP', timestamp: '2024-02-29T06:00:00.000Z' },
  { id: 'prior-day', fromAccount: null, toAccount: C, type: 'deposit', currency: 'USD', timestamp: '2024-02-28T00:00:00.000Z' },
].map(record => ({ ...record, amount: 1.25, status: 'completed' } as Transaction));

describe('Transaction history filters', () => {
  let app: INestApplication;
  beforeEach(async () => {
    app = await createApp();
    const repository = app.get(TransactionRepository);
    fixtures.forEach(record => repository.save(record));
  });
  afterEach(async () => { await app.close(); });

  it.each([
    ['', ['end', 'before', 'recipient', 'unrelated', 'deposit', 'withdrawal', 'after', 'middle', 'prior-day']],
    [`accountId=${A}`, ['end', 'before', 'recipient', 'deposit', 'withdrawal', 'after', 'middle']],
    [`accountId=${B}`, ['end', 'before', 'unrelated']],
    [`accountId=${C}`, ['recipient', 'unrelated', 'after', 'middle', 'prior-day']],
    ['type=deposit', ['deposit', 'prior-day']],
    ['type=withdrawal', ['withdrawal']],
    ['type=transfer', ['end', 'before', 'recipient', 'unrelated', 'after', 'middle']],
    ['from=2024-02-29&to=2024-02-29', ['end', 'recipient', 'unrelated', 'deposit', 'withdrawal', 'middle']],
    [`accountId=${A}&type=transfer&from=2024-02-29&to=2024-02-29`, ['end', 'recipient', 'middle']],
    ['from=2024-03-01', ['after']],
    ['to=2024-02-28', ['before', 'prior-day']],
    ['from=2024-02-29', ['end', 'recipient', 'unrelated', 'deposit', 'withdrawal', 'after', 'middle']],
    ['to=2024-02-29', ['end', 'before', 'recipient', 'unrelated', 'deposit', 'withdrawal', 'middle', 'prior-day']],
    ['accountId=ACC-99999', []],
    ['from=2024-03-02', []],
    [`accountId=${B}&type=withdrawal`, []],
  ])('returns exact records in insertion order for %s', async (query, ids) => {
    const response = await request(app.getHttpServer()).get(`/transactions?${query}`).expect(200);
    expect(response.body.map((record: Transaction) => record.id)).toEqual(ids);
    expect(response.body).toEqual(ids.map(id => fixtures.find(record => record.id === id)));
  });

  it.each([
    ['from=2024-02-30', 'from', /date|calendar/i],
    ['from=2023-02-29', 'from', /date|calendar/i],
    ['from=garbage', 'from', /match|date/i],
    ['to=2024-13-01', 'to', /date|calendar/i],
    ['from=2024-03-01&to=2024-02-29', 'to', /end|start|range/i],
    ['type=other', 'type', /allowed|deposit|withdrawal|transfer/i],
    ['accountId=no', 'accountId', /match|account/i],
    ['from=2024-02-28&from=2024-02-29', 'from', /string|match/i],
    ['to=2024-02-28&to=2024-02-29', 'to', /string|match/i],
    ['type=deposit&type=transfer', 'type', /allowed|deposit|transfer/i],
    [`accountId=${A}&accountId=${B}`, 'accountId', /string|match/i],
    ['unexpected=true', 'unexpected', /exist|allow|unknown/i],
  ])('rejects filter %s with useful %s details and preserves history', async (query, field, message) => {
    const response = await request(app.getHttpServer()).get(`/transactions?${query}`).expect(400);
    expectValidation(response.body, field, message as RegExp);
    expect((await request(app.getHttpServer()).get('/transactions').expect(200)).body).toEqual(fixtures);
  });
});
