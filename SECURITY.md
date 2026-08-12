# Security

## Reporting a vulnerability

Use GitHub's **private vulnerability reporting** on this repository:
[Report a vulnerability](https://github.com/jacquesvn/lockin/security/advisories/new).

If that isn't available to you, open a normal issue saying only that you have a security
report and how to reach you — **no details in the public issue** — and you'll get a private
channel back.

Expect a first reply within a week. This is a one-person project, so that is a realistic
number rather than an ambitious one.

## What is supported

The latest release only. The desktop app updates itself, and the web build is served from
`docs/` on the current `main`, so there is no supported older line to backport to.

## What the threat model actually is

Lockin has **no server, no account and no telemetry**, so most of the usual surface does not
exist — there is no session to steal, no database to read, and nothing of yours is anywhere
to be breached. What is left is small and specific, and these are the parts worth your
attention:

| Surface | What it is | What is already done about it |
|---|---|---|
| **GSI listener** *(desktop)* | A loopback HTTP listener on port 3121 that CS2 posts match state to | Binds loopback only, and drops any payload whose token doesn't match the one this install minted. Body size is capped. |
| **The CS2 config writer** *(desktop)* | Writes `gamestate_integration_lockin.cfg` into your CS2 install | The token goes in verbatim between two quotes, so its shape is a security property. Rust rejects anything that isn't exactly 32 lowercase hex before writing — a token carrying a quote and a newline could otherwise close our block and open a second one pointing anywhere. |
| **Backup import** | Arbitrary JSON from a file you choose | Shape-validated before it is applied. The GSI token is stripped from exports and never taken from an import — the local one is kept. |
| **The updater** *(desktop)* | Downloads and installs a new build | Signed with a minisign keypair; Tauri refuses to install an update it cannot verify against the public key baked into `tauri.conf.json`. Note this is update signing, **not** Authenticode — the installer is unsigned and SmartScreen will say so. |
| **Steam / workshop scan** *(desktop)* | Reads Steam's registry key and library folders to show which maps you have | Read-only, no admin, and UNC paths are rejected before they are stat'd so a crafted library entry cannot coerce an outbound SMB handshake. |
| **Leetify read** *(optional)* | The one outbound request, and only when you paste a profile link | Held in memory, dropped once the plan is built, never stored. The service worker passes it through rather than caching it. |
| **Lineup pictures** | Images you paste, stored in IndexedDB | Local only. They ride along in an explicit backup and are stripped back out to IndexedDB on restore. |

## Things that are deliberately not vulnerabilities

- **The installer is unsigned.** Code-signing certificates cost money this project doesn't
  have. SmartScreen warns on first run; updates after that are signature-checked.
- **Your data is in `localStorage` and IndexedDB in plain form.** It is a training log on
  your own machine, not a secret store. Anything with access to your user account can read
  it, which is true of your CS2 config too.
- **The GSI token is not a credential.** It exists so the listener ignores anything that
  isn't CS2 on the same machine. It grants nothing anywhere else.

## If you are reporting

Please say which build (web, desktop, or the single-file `index.html`), the version from
Setup, and what an attacker would actually get. **Do not attach your backup file** — it is
your whole training history, and it is almost never needed to reproduce anything.
