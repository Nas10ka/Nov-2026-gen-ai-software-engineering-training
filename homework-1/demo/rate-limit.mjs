import assert from 'node:assert/strict';

const base = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const windowMs =  60_000;
console.log(`Rate-limit demo against ${base}. Restart the server first; do not send other requests during this demo.`);
console.log('Meaning: One IP shares a quota across transaction history and account balance routes. These GET requests do not create transactions.');
console.log('Expected: Requests 1–100 return HTTP 200; request 101 returns HTTP 429 with a positive Retry-After delay in seconds.');
console.log('Timing check: All 101 requests must finish in less than 60,000 ms, measured with a monotonic clock.');
let passed = 0;
let currentRequest = 0;
let startedAt;
let elapsedMs = 0;
try {
  for (let count = 1; count <= 101; count++) {
    currentRequest = count;
    const path = count % 2 ? '/transactions' : '/accounts/ACC-12345/balance';
    const expectedStatus = count <= 100 ? 200 : 429;
    console.log(`\nRequest ${count}: GET ${base}${path}`);
    console.log(`Expected: HTTP ${expectedStatus}. ${count <= 100 ? 'Within the shared per-IP quota; return the requested data.' : 'Quota exceeded; reject the request and report when to retry.'}`);
    if (count === 1) startedAt = performance.now();
    const response = await fetch(`${base}${path}`);
    const text = await response.text();
    elapsedMs = performance.now() - startedAt;
    console.log(`Actual: HTTP ${response.status}; Retry-After: ${response.headers.get('retry-after') ?? 'not present'}; elapsed: ${elapsedMs.toFixed(2)} ms`);
    let data;
    try { data = JSON.parse(text); }
    catch { console.log('Actual response body:', text); throw new Error('Expected a JSON response body'); }
    console.log('Actual response body:', JSON.stringify(data, null, 2));
    assert.ok(elapsedMs < windowMs,
      `The one-minute quota check is not confirmed: ${elapsedMs.toFixed(2)} ms elapsed (must be less than ${windowMs} ms). Restart the server and rerun the demo.`);
    assert.equal(response.status, expectedStatus, `Unexpected status at request ${count}; restart server first.`);
    if (count <= 100) {
      if (count % 2) assert.ok(Array.isArray(data), 'Transaction history must be an array');
      else {
        assert.equal(data.accountId, 'ACC-12345');
        assert.ok(data.balances && typeof data.balances === 'object' && !Array.isArray(data.balances),
          'Account response must contain balances');
      }
    } else {
      assert.ok(Number(response.headers.get('retry-after')) > 0, 'Retry-After must be positive');
      assert.match(data.error, /too many|throttl|rate.*limit/i);
    }
    passed++;
    console.log(`PASS: Request ${count} — status and response checks passed.`);
  }
  console.log(`PASS: All 101 requests completed within one minute (${elapsedMs.toFixed(2)} ms < ${windowMs} ms).`);
  console.log(`\nPASS: All ${passed} rate-limit demo checks passed. Restart the server or wait for Retry-After before more requests.`);
} catch (error) {
  console.error(`\nFAIL: Request ${currentRequest}: ${error.message}`);
  console.error(`Summary: ${passed} checks passed; demo stopped at the failed request.`);
  process.exitCode = 1;
}
