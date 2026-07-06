# Contributing

## Set up

```sh
bun install
bunx playwright install chromium firefox webkit
```

## Check a change

```sh
bun run check
```

`check` formats/lints, type-checks, runs the matcher suite in Playwright
Chromium, runs it through the WebdriverIO provider, then runs the same suite in
Chromium, Firefox, and WebKit.

A comparison change needs two browser tests:

1. a known-identical pair that passes;
2. a known-broken pair that fails for the intended reason.

Keep browser-provider code out of `src/`. The matcher consumes Vitest's
Locator/Element interface; provider setup belongs in test configuration.
