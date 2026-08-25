# Changelog

All notable changes to `@moreflow/forms` are documented in this file.

## 0.3.0

- Add `sendPhoneVerification` and `checkPhoneVerification` for forms whose phone field requires verification (`verifyPhone`). They drive the public `PUT`/`POST /api/v1/forms/{formId}/phone-verification` endpoints, normalize the input to E.164 before sending, and surface server failures as `MoreflowFormError` with the navigational code (`INVALID_VERIFICATION_CODE`, `VERIFICATION_PROOF_EXPIRED`, `VERIFICATION_PROOF_REPLAYED`, `INVALID_VERIFICATION_PROOF`, `PROVIDER_ERROR`).
- Neither helper retries by itself — every send is a real SMS — but errors carry `retryable` so callers can offer a resend.

## 0.2.1

- Extract acquisition tracking into `@moreflow/tracking` while preserving all existing forms tracking exports and the `PublicFormTracking` type alias.
- Keep the browser bundle self-contained while the ESM build resolves `@moreflow/tracking` as a package dependency.

## 0.2.0

- Add `token` and `headers` options to `submitWithRetry` for authenticated cross-origin form submissions.
- Send the configured authorization and custom headers on initial attempts, retries, and idempotent-body replays.
- Ship a self-contained `dist/browser.js` classic IIFE for script-tag embeds, exposed as `window.MoreflowForms`.
