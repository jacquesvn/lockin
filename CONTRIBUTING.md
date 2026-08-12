# Contributing

Bug reports and ideas are welcome — [open an issue](https://github.com/jacquesvn/lockin/issues/new/choose).
Security reports go [privately](SECURITY.md), not into a public issue.

For code, the [Develop](README.md#develop) section of the README is the real reference. Three
things are worth saying up front, because they are unusual and they are not negotiable.

## `docs/index.html` is one file, and that is deliberate

Inline CSS and JS, no build step, no dependencies, no CDN. It means the app can be downloaded
and double-clicked, self-hosted from any static folder, and read end to end without tooling.
A PR that introduces a bundler, a framework or an npm runtime dependency is a PR that changes
what Lockin *is*, so raise it as an issue first.

The desktop build bundles the same file via `frontendDist: ../docs`. There is no second copy
to keep in sync — anything that lands in `docs/` ships inside the installer, which is why the
screenshots live in `screenshots/` instead.

## Run the gates, and make new guards fail first

```bash
npm run verify        # syntax gate + all three suites, against the real shipped file
```

493 tests across `test/lockin.test.js`, `test/journey.test.js` and `test/a11y.test.js`. They
run the actual `<script>` out of `docs/index.html`, so they test what ships rather than a
copy of it.

If you add a guard, **break the thing it watches and confirm it goes red before you trust
it.** This codebase has shipped several tests that could only ever pass — one satisfied by
the function's own declaration, one that skipped the first rule inside every media query, one
that checked for CSS classes which had been renamed away. A guard that stays green when you
reintroduce its bug is worse than no guard, because it is also a claim that the bug cannot
happen.

## Claims need sources

Lockin ships coaching advice only where there is evidence, and it deliberately leaves out
several things that sound obviously true — interleaved practice, quiet-eye drills, aim-trainer
transfer — because the evidence does not support them. Some tests are content guards that
fail the build if the copy starts claiming a rifle needs a dead stop, or that anything makes
you *faster*.

So a PR that changes coaching copy should say where the claim comes from. "It is what
everyone does" is not a source, and neither is a confident paragraph from a model.

## Small things

- Match the surrounding style. It is idiosyncratic on purpose and consistent with itself.
- Comments explain *why*, especially where the obvious implementation was wrong. Several of
  the long comments in the codebase are load-bearing history — read them before changing the
  line above them.
- `D(...)` builds drills positionally across 52 call sites. **Add fields at the end, never in
  the middle** — inserting one shifts every argument after it, which once silently collapsed
  the coach protocol to zero minutes.
- Don't hand-edit `CHANGELOG.md`; run `node scripts/make-changelog.js`.
