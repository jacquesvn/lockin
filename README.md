# Lockin — your pocket CS2 coach

A free pocket coach for Counter-Strike 2. Answer a quick quiz and Lockin builds you a
personalised training plan plus a daily tracker to actually stick to it — because a good
plan and the discipline to run it shouldn't cost $50 an hour.

It's a single self-contained web app (one HTML file + a service worker for offline) and
installs as an app on any device. Your data stays on your device (`localStorage`); nothing
is uploaded.

## Run it
- **Single file:** open `docs/index.html` in any browser — no server needed.
- **Hosted / PWA:** use the hosted version and "Install app".
- **Desktop:** download the installer from the latest [release](../../releases). It's
  unsigned, so Windows SmartScreen may warn — click **More info → Run anyway**.
- **Docker:** `docker build -t lockin . && docker run -d -p 8080:80 lockin`

## Develop
`docs/index.html` is the single source of truth for the app (inline CSS + JS). The desktop
build (`src-tauri/`) bundles it via `frontendDist: ../docs`; the standalone
`D:/…/lockin.html` copy is generated from it, not hand-edited.

```
npm run verify   # syntax-checks the inline script + runs unit tests against the real code
npm run check    # syntax gate only
npm test         # unit tests only
```

## Release
Bump the version in **all** of: `package.json`, `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`, `VERSION` in `docs/index.html`, and the `CACHE` name in
`docs/service-worker.js` (kept equal to the version). Then tag `vX.Y.Z` and push — CI
(`.github/workflows/desktop.yml`) asserts every source agrees with the tag, runs the
frontend gate, and publishes the Windows installers.

## License
[MIT](LICENSE).
