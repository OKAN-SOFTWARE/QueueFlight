# Validation record

Created and checked on 2026-10-24 using Linux and Node.js v24.22.1.

## Completed here

- Build completed with Node's built-in TypeScript stripping; the generated JavaScript passed syntax checking.
- 15 automated checks passed: core import/decode/limits, exact-body grouping and repeated IDs, timestamp/count validation, body-preserving fixtures, retry behavior, diff resource bounds, CLI round trips/no-overwrite/permissions, local HTTP boundaries, and built-interface interactions.
- The interface check executes the actual built bundle against a minimal DOM. It verifies demo startup, selection, comparison, retry response changes, a new pasted capture, invalid import preserving the existing capture, clear, and reload of the demo.
- Archive contents and local documentation targets were checked before packaging.

## Not completed here

There is no browser binary installed in this environment. The interface check is therefore not visual QA or proof of real-browser compatibility. The optional Playwright script has not run here. Native Tauri/Rust source has not compiled here because Rust and platform development tools are absent. Neither the Windows CI checks nor the manual desktop workflow have run on GitHub yet. No signed installer, penetration test, independent security audit, or live AWS integration is included.

## Real-browser check

After a build, install the optional development browser tools:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node scripts/browser-check.mjs
```

The script starts its own local server. It checks real imports/demo, comparison, retry changes, downloads, session clearing, responsive width, page errors and absence of external requests. A test-only Playwright dependency is not needed to run QueueFlight normally. Check the desktop source separately on the target platform as described in DESKTOP.md.
