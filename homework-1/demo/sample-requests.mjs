import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
let passed = 0;
let currentStep = 'Start demo';

async function call({ title, meaning, path, status = 200, body, expected, check }) {
  currentStep = title;
  console.log(`\n--- ${title} ---`);
  console.log(`Meaning: ${meaning}`);
  console.log(`Request: ${body ? 'POST' : 'GET'} ${base}${path}`);
  if (body) console.log('Request body:', JSON.stringify(body, null, 2));
  console.log(`Expected: HTTP ${status}. ${expected}`);
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  console.log(`Actual: HTTP ${response.status}`);
  let data;
  try { data = JSON.parse(text); }
  catch { console.log('Actual response body:', text); throw new Error('Expected a JSON response body'); }
  console.log('Actual response body:', JSON.stringify(data, null, 2));
  assert.equal(response.status, status, 'HTTP status must match the expected status');
  check(data);
  passed++;
  console.log(`PASS: ${title} — status and response checks passed.`);
  return data;
}

console.log(`Transaction demo against ${base}. Start with a fresh server.`);
console.log('Each step shows its meaning, expected result, actual response, and check result.');
console.log('Amounts are separated by currency; USD and EUR are never added together.');

try {
  await call({ title: 'Check empty history', meaning: 'Ensure earlier demo runs will not change the expected balances.',
    path: '/transactions', expected: 'An empty transaction array [].',
    check: data => assert.deepEqual(data, [], 'Restart the API before running the demo; it requires empty storage.') });
  const samples = JSON.parse(await readFile(new URL('./sample-data.json', import.meta.url), 'utf8'));
  const explanations = [
    'Deposit 100.50 USD into ACC-12345. Its USD balance becomes 100.50.',
    'Move 20.25 USD from ACC-12345 to ACC-67890. Their USD balances become 80.25 and 20.25.',
    'Withdraw 5.25 USD from ACC-67890. Its USD balance becomes 15.00.',
    'Deposit 50.00 EUR into ACC-12345. Its EUR balance becomes 50.00; USD stays 80.25.',
  ];
  const created = [];
  for (const [index, sample] of samples.entries()) {
    const transaction = await call({ title: `Transaction ${index + 1}: ${sample.type}`,
      meaning: explanations[index], path: '/transactions', status: 201, body: sample,
      expected: 'The submitted transaction with a unique generated ID, UTC timestamp, completed status, and null for an unused account.',
      check: data => {
        assert.deepEqual(data, { ...sample, fromAccount: sample.fromAccount ?? null, toAccount: sample.toAccount ?? null,
          id: data.id, timestamp: data.timestamp, status: 'completed' });
        assert.match(data.id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
        assert.equal(new Date(data.timestamp).toISOString(), data.timestamp);
        assert.ok(!created.some(existing => existing.id === data.id), 'Generated IDs must be unique');
      } });
    created.push(transaction);
  }
  await call({ title: 'Retrieve the first deposit', meaning: 'Look up a saved transaction by its generated ID.',
    path: `/transactions/${created[0].id}`, expected: 'Exactly the first deposit response.',
    check: data => assert.deepEqual(data, created[0]) });
  await call({ title: 'List full history', meaning: 'All four successful transactions remain available in creation order.',
    path: '/transactions', expected: 'The four created transactions, in order.',
    check: data => assert.deepEqual(data, created) });
  const firstDay = created[0].timestamp.slice(0, 10);
  const lastDay = created[created.length - 1].timestamp.slice(0, 10);
  await call({ title: 'Filter transfer history', meaning: 'Combine account, type, and inclusive UTC date filters.',
    path: `/transactions?accountId=ACC-12345&type=transfer&from=${firstDay}&to=${lastDay}`,
    expected: 'Only transaction 2: the 20.25 USD transfer. Deposits and the withdrawal are excluded.',
    check: data => assert.deepEqual(data, [created[1]]) });
  await call({ title: 'Check ACC-12345 balances', meaning: '100.50 USD deposited minus 20.25 USD transferred; separate 50.00 EUR deposit.',
    path: '/accounts/ACC-12345/balance', expected: 'accountId ACC-12345; balances USD 80.25 and EUR 50.',
    check: data => assert.deepEqual(data, { accountId: 'ACC-12345', balances: { USD: 80.25, EUR: 50 } }) });
  await call({ title: 'Check ACC-67890 balance', meaning: '20.25 USD received minus 5.25 USD withdrawn.',
    path: '/accounts/ACC-67890/balance', expected: 'accountId ACC-67890; balance USD 15.',
    check: data => assert.deepEqual(data, { accountId: 'ACC-67890', balances: { USD: 15 } }) });
  await call({ title: 'Reject a negative deposit', meaning: 'A negative amount is invalid. HTTP 400 is the expected success condition for this check.',
    path: '/transactions', status: 400, body: { ...samples[0], amount: -1 },
    expected: 'Validation failed, with an amount field and a useful positive-amount/minimum-value message.',
    check: data => {
      assert.equal(data.error, 'Validation failed');
      assert.ok(Array.isArray(data.details) && data.details.some(detail => detail.field === 'amount'
        && typeof detail.message === 'string' && /positive|0\.01|minimum|greater/i.test(detail.message)),
      'Validation details must explain why amount is invalid');
    } });
  await call({ title: 'Verify rejection preserved history', meaning: 'The rejected deposit must not create or change a transaction.',
    path: '/transactions', expected: 'Exactly the original four transactions.', check: data => assert.deepEqual(data, created) });
  await call({ title: 'Verify rejection preserved balances', meaning: 'The invalid deposit must not change either currency balance.',
    path: '/accounts/ACC-12345/balance', expected: 'USD 80.25 and EUR 50, unchanged.',
    check: data => assert.deepEqual(data, { accountId: 'ACC-12345', balances: { USD: 80.25, EUR: 50 } }) });
  await call({ title: 'Look up a missing transaction', meaning: 'An unknown ID should return a helpful error. HTTP 404 is expected.',
    path: '/transactions/missing', status: 404, expected: 'An error explaining that the transaction was not found.',
    check: data => assert.match(data.error, /not found/i) });
  console.log(`\nPASS: All ${passed} transaction demo checks passed.`);
} catch (error) {
  console.error(`\nFAIL: ${currentStep}: ${error.message}`);
  console.error(`Summary: ${passed} checks passed; demo stopped at the failed step.`);
  process.exitCode = 1;
}
