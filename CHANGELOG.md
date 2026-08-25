# Changelog

All notable changes to `@moreflow/forms` are documented in this file.

## 0.2.1

- Extract acquisition tracking into `@moreflow/tracking` while preserving all existing forms tracking exports and the `PublicFormTracking` type alias.
- Keep the browser bundle self-contained while the ESM build resolves `@moreflow/tracking` as a package dependency.

## 0.2.0

- Add `token` and `headers` options to `submitWithRetry` for authenticated cross-origin form submissions.
- Send the configured authorization and custom headers on initial attempts, retries, and idempotent-body replays.
- Ship a self-contained `dist/browser.js` classic IIFE for script-tag embeds, exposed as `window.MoreflowForms`.
