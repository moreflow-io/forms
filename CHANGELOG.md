# Changelog

All notable changes to `@moreflow/forms` are documented in this file.

## 0.4.0

- Add `getPublicForm` and `normalizePublicFormDefinition`: load a published form (`GET /api/v1/forms/{formId}`) as one canonical, typed `PublicFormDefinition`. The normalizer absorbs every historical response shape — the top-level `version`, the legacy `record.data.config.current_version` copy, snake_case `field_matching`, string options, the `required`/`isRequired` duality — and prefers the candidate whose thank-you page still carries its content props. Load failures throw `MoreflowFormError` with the server's navigational code (`FORM_NOT_FOUND`, `FORM_RETIRED`, `FORM_UNPUBLISHED`, `INVALID_FORM_DEFINITION`).
- Add definition helpers: `partitionFormPages`, `formInputComponents`, `phoneVerificationComponents`, and `phoneVerificationRequired`, so custom embeds can detect `verifyPhone` fields instead of silently skipping verification.
- Add `validateComponentValue`, `validateFormPage`, and `validateFormValues` with structured issue codes (`REQUIRED`, `INVALID_EMAIL`, `INVALID_PHONE_NUMBER`, `CONSENT_REQUIRED`, `INCOMPLETE_ADDRESS`) matching the hosted renderer's rules, with full libphonenumber phone validation.
- Add `prepareSubmissionData`: normalizes phone fields to E.164, drops empty phones and `undefined` entries before `submitWithRetry`.
- Add `resolveFormMessage`, `isFormMessageKey`, `formMessageId`, and the `formMessageCatalogs` (de/en) so embeds can render Moreflow's default `forms.*` label keys without private translation tables.
- Add `describePhoneInput`, `composePhoneNumber`, and `countryCallingCode` for split country-selector + number inputs without hand-rolled dial-code tables.
- Add `formErrorMessage`, `serverErrorCode`, and `serverErrorMessage`; `submitWithRetry` errors now prefer the server's human-readable message and also read route-level `{ code, message }` bodies, matching the phone-verification helpers.

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
