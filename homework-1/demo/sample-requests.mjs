import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
async function call(path, expectedStatus = 200, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  console.log(`${body ? 'POST' : 'GET'} ${path}: ${response.status}`, JSON.stringify(data, null, 2));
  assert.equal(response.status, expectedStatus);
  return data;
}

try {
  assert.deepEqual(await call('/transactions'), [], 'Restart the API before running the demo; it requires empty storage.');
  const samples = JSON.parse(await readFile(new URL('./sample-data.json', import.meta.url), 'utf8'));
  const created = [];
  for (const sample of samples) created.push(await call('/transactions', 201, sample));
  await call(`/transactions/${created[0].id}`);
  await call('/transactions');
  const day = created[0].timestamp.slice(0, 10);
  const history = await call(`/transactions?accountId=ACC-12345&type=transfer&from=${day}&to=${day}`);
  assert.equal(history.length, 1);
  assert.deepEqual((await call('/accounts/ACC-12345/balance')).balances, { USD: 80.25, EUR: 50 });
  assert.deepEqual((await call('/accounts/ACC-67890/balance')).balances, { USD: 15 });
  await call('/transactions', 400, { ...samples[0], amount: -1 });
  await call('/transactions/missing', 404);
  console.log('Sample requests passed.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
