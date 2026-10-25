/*
 * SECURE SERVER  —  cmdi-lab
 * -----------------------------------------------------------------------------
 * Same "ping a host" feature as vulnerable/server.js, re-implemented so that
 * every Phase 2 attack fails. Each defence is tagged with `// FIX:` and notes
 * which attack it defeats. Find them with:
 *     grep -n "FIX:" secure/server.js
 *
 * Runs on a DIFFERENT port so both servers can run side by side.
 */

const express = require('express');
const path = require('path');
const { execFile } = require('child_process'); // FIX: execFile does NOT spawn a shell — no shell = no metacharacter parsing

const app = express();
const PORT = process.env.PORT || 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/*
 * FIX (defeats ALL attacks — defence in depth, layer 1): strict allowlist.
 * Accept only what a real hostname or IPv4 address can contain: letters,
 * digits, dots and hyphens, with sane length limits. Everything a shell would
 * treat as special (; & | ` $ ( ) < > spaces quotes newlines) is OUTSIDE this
 * set, so an injection payload never passes validation in the first place.
 *
 * This is an ALLOWLIST (accept known-good) — not a blocklist. We never try to
 * enumerate "bad" characters; we define the small set of good ones and reject
 * everything else.
 */
const HOST_RE = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})*$/;

function isValidHost(host) {
  if (typeof host !== 'string') return false;
  if (host.length === 0 || host.length > 253) return false;
  return HOST_RE.test(host);
}

app.get('/', (req, res) => {
  res.render('index', { host: '', output: '', error: '' });
});

app.post('/ping', (req, res) => {
  const host = (req.body.host || '').toString().trim();

  // FIX (defeats command chaining, substitution, blind, exfil): reject anything
  //      that is not a clean hostname/IP BEFORE we go anywhere near the OS.
  if (!isValidHost(host)) {
    return res.status(400).render('index', {
      host,
      output: '',
      error: 'invalid host: only letters, digits, dots and hyphens are allowed'
    });
  }

  // FIX (defeats command chaining & substitution): argument-array form. `host`
  //      is passed as a single, literal argv entry to ping(1). There is no
  //      shell to interpret ; && | ` $() — even if validation were bypassed,
  //      the string would be a (bogus) hostname argument, never a command.
  // FIX (defeats blind/time-based DoS): hard timeout kills a hung child.
  const args = ['-c', '1', '-w', '5', host];
  execFile('ping', args, { timeout: 6000 }, (err, stdout, stderr) => {
    // FIX (least disclosure): on failure we do NOT reflect raw shell/system
    //      errors. We return a generic message so the tool cannot be used as an
    //      oracle. Successful pings still show their normal output.
    if (err) {
      return res.render('index', {
        host,
        output: stdout || '',
        error: 'host could not be reached (lookup failed or timed out)'
      });
    }
    res.render('index', { host, output: stdout || '', error: '' });
  });
});

app.listen(PORT, () => {
  console.log(`[SECURE] admin tool listening on http://localhost:${PORT}`);
  console.log(`[SECURE] endpoint: POST /ping   field: host`);
  console.log(`[SECURE] defences: allowlist regex + execFile (no shell) + timeout`);
});
