/*
 * VULNERABLE SERVER  —  cmdi-lab
 * -----------------------------------------------------------------------------
 * A deliberately insecure "network admin tool". It exposes a web form that
 * pings a host the user types in. It is INTENTIONALLY broken so we can study
 * OS command injection in a closed lab. DO NOT deploy this anywhere reachable.
 *
 * Every weakness is tagged with `// VULN:` so it can be found with grep:
 *     grep -n "VULN:" vulnerable/server.js
 */

const express = require('express');
const path = require('path');
const { exec } = require('child_process'); // VULN: exec() runs its argument through a shell (/bin/sh -c ...)

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false })); // parse HTML form posts
app.use(express.json());                           // parse JSON (for curl/scripts)

app.get('/', (req, res) => {
  res.render('index', { host: '', command: '', output: '', error: '' });
});

/*
 * POST /ping
 * Accepts a `host` field from the form (or JSON body) and pings it once.
 * This is the injection point.
 */
app.post('/ping', (req, res) => {
  const host = (req.body.host || '').toString();

  // VULN: user input is concatenated straight into a shell command string.
  //       Any shell metacharacter (; && | | ` $() etc.) the user supplies is
  //       interpreted by /bin/sh, not treated as part of the hostname.
  const command = 'ping -c 1 ' + host;

  // VULN: exec() spawns a shell (equivalent to spawn with {shell:true}), so the
  //       whole string above is handed to `/bin/sh -c "<command>"`.
  // VULN: no input validation / no allowlist — anything goes.
  // VULN: no timeout on the child process — a `; sleep 30` will hang the request.
  exec(command, (err, stdout, stderr) => {
    // VULN: raw stdout AND stderr are reflected back to the page verbatim, so
    //       the output of any injected command is shown to the attacker.
    res.render('index', {
      host,
      command,                                  // VULN: we even echo the exact command we ran
      output: stdout || '',
      error: (err ? (stderr || err.message) : stderr) || ''
    });
  });
});

app.listen(PORT, () => {
  console.log(`[VULNERABLE] admin tool listening on http://localhost:${PORT}`);
  console.log(`[VULNERABLE] endpoint: POST /ping   field: host`);
  console.log(`[VULNERABLE] WARNING: this server is intentionally exploitable.`);
});
