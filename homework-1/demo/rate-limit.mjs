import assert from 'node:assert/strict';

const base = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
console.log('This demo requires a freshly restarted server. It sends 101 requests from one IP.');
try {
  for (let count = 1; count <= 101; count++) {
    const path = count % 2 ? '/transactions' : '/accounts/ACC-12345/balance';
    const response = await fetch(`${base}${path}`);
    await response.text();
    assert.equal(response.status, count <= 100 ? 200 : 429, `Unexpected status at request ${count}; restart server first.`);
    if (count === 1 || count === 100 || count === 101) {
      console.log(`Request ${count}: HTTP ${response.status}; Retry-After: ${response.headers.get('retry-after') ?? 'n/a'}`);
    }
  }
  console.log('Rate-limit demo passed.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
