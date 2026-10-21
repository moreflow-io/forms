# Changelog

All notable changes to `@moreflow/forms` are documented in this file.

## Unreleased

## 0.8.0

- **Breaking — requires the next minor release:** replace `trackingOptions` with `trackingCapture` for capture options. Replace session/submission option `tracking: values` with `trackingCapture: () => values`, or `tracking: callback` with `trackingCapture: callback`, and enable `acquisitionTracking`. Capture overrides now always obey the consent gate; explicit payload `input.tracking` remains independent. No old option aliases remain.
- Add optional `createFormsClient({ baseUrl, acquisitionTracking, trackingCapture, fetchImpl, ...sessionDefaults })` to bind shared defaults for loading definitions, creating sessions, submitting, and phone verification. Per-call helpers remain available.

- Export `isMoreflowError(error)` using the shared `Symbol.for('moreflow.error')` brand. Migrate catch handlers that need common fields across separately bundled public SDKs from package-specific `instanceof` checks to this guard. Package-specific error classes remain available; document the common error table, now also used by `@moreflow/api`.

- Breaking: the `acquisitionTracking` capture no longer uses the `storage` option, which now holds only the idempotency record. Use `trackingCapture` for the capture; unset fields follow `configureAcquisitionTracking()` from `@moreflow/tracking`, so the form submits the same landing values the page captured. Re-export `configureAcquisitionTracking`, `clearAcquisitionTracking` and the `AcquisitionTrackingConfig` type.
- Captured landing values stay stable across route changes, and server-side calls no longer share stored values between requests (fixed in `@moreflow/tracking`, which the browser build bundles).
- Add `createFormSession(definition, options)`, a framework-agnostic store (`getSnapshot`/`subscribe`) that runs a whole custom form: wizard steps with `next`/`back`, values, localized validation issues with a focus target, `submit` with idempotent retries, honeypot and Turnstile wiring (`turnstile.mount`, `turnstile.setToken`), the thank-you page or a validated redirect URL, and `reset`. When a phone field requires verification, `submit` texts the code itself; `phoneVerification.sendCode`, `setCode`, `verify` (which continues the submission), `resend` and `changeNumber` drive the code step. Untouched optional consent boxes submit an explicit `false`, a server `VALIDATION_ERROR` marks the fields it names, and `ANTI_SPAM_INVALID` resets the Turnstile token.
- Add the optional `@moreflow/forms/react` entry with `useMoreflowForm`, which loads the form (or takes a definition), creates the session and re-renders through `useSyncExternalStore`. React is an optional peer dependency (`>=18`) and is not part of the core `@moreflow/forms` bundle or the browser build; the ESM build now shares code between both entries through `dist/chunks/`.
- `normalizePublicFormDefinition` and `getPublicForm` expose `definition.companyName` (the tenant brand display name Moreflow evidences marketing consent with) and `definition.language` (the account's default form language), which `GET /v1/forms/{formId}` now returns. `partitionFormPages`, `formInputComponents`, `phoneVerificationComponents`, `validateFormValues` and `prepareSubmissionData` default their `companyName` to `definition.companyName`, so a `marketing_consent` box shows without passing the name yourself; an explicit `companyName` still wins.
- `definition.settings` is typed as `PublicFormSettings`: `submitButtonText`, `continueButtonText` and `thankYouPageUrl` (also read from the legacy `thank_you_page_url`) are strings when set; non-string values of those keys are dropped. Other settings pass through unchanged.
- `formErrorMessage(error, { language, formality, messages, fallback })` returns visitor-facing German or English copy for every `FormErrorCode` instead of the server's English developer text. `formErrorMessage(error)` and `formErrorMessage(error, fallback)` keep their previous behavior.
- Add `formality` (`'formal'` "Sie", the default, or `'informal'` "du") and a `messages` override map (`forms`, `validation`, `errors`) shared by `resolveFormMessage`, `validationMessage`, `formErrorMessage` and `createFormSession`. Export the `FormCopyOptions`, `FormFormality`, `FormMessageOverrides`, `FormErrorMessageOptions`, `PublicFormSettings` and `FormSession*` types.
- **Breaking:** a `marketing_consent` box is hidden without a non-blank company name. Helpers that take a definition use `definition.companyName` automatically; standalone component and page helpers need `{ companyName }`. Without a name, the helpers leave the box out and drop any value for it. The `privacy_policy` checkbox no longer stands for marketing consent either: its default text lost the offers sentence and it records no consent.
  Upgrade steps:
  1. Use the `companyName` returned with the form definition (your company profile name in Moreflow, exactly as the hosted form shows it). `createFormSession` and helpers that take a definition use it automatically. Pass `{ companyName }` explicitly to `validateFormPage`, `validateComponentValue` and `isComponentVisibleToVisitors`, or when using a definition from an older server that does not return the name.
  2. Render `marketing_consent` as an optional, unticked checkbox with the text from `marketingConsentText({ companyName, language })`.
  3. Send the `language` you rendered with as `input.locale` in `submitWithRetry`.
  4. If you treated a ticked `privacy_policy` box as a newsletter opt-in, stop: only `marketing_consent` records marketing email consent.
- Drop the "further offers" sentence from the default `forms.privacy.consentLabel` copy (de/en). The required `privacy_policy` checkbox acknowledges the privacy notice and no longer implies marketing consent.
- Add the `marketing_consent` component type: the only form field that records marketing email consent. It is always optional and unticked, never yields `CONSENT_REQUIRED` even when a definition marks it required, and normalizes to `required: false`. Its text is Moreflow's marketing wording naming the company, returned by the new `marketingConsentText({ companyName, language })` helper (`public_marketing_consent_label`, de/en).
- `isComponentVisibleToVisitors`, `partitionFormPages`, `formInputComponents`, the validation helpers and `prepareSubmissionData` take an optional `companyName`; without a non-blank company name a `marketing_consent` box is hidden and any value for it is dropped.
- Add `input.locale` (`'de'` or `'en'`) to `submitWithRetry`, defaulting to `'de'` like `resolveFormMessage`. Moreflow rebuilds the shown marketing text in this locale to evidence the consent, so pass the language you rendered with. The locale is part of the idempotency fingerprint.
- Export `OPTIONAL_CONSENT_COMPONENT_TYPES`, `VisitorVisibilityOptions` and `MarketingConsentTextOptions`, and add the default labels for the tracking and marketing consent fields to `formMessageCatalogs`.
- **Breaking:** `baseUrl` now defaults to `https://api.moreflow.io` in `submitWithRetry`, `getPublicForm`, `sendPhoneVerification` and `checkPhoneVerification`. Previously it defaulted to `''` (the page's own origin). Pass `baseUrl: ''` to keep posting through a same-origin proxy.
- **Breaking:** an aborted request throws `MoreflowFormError` with code `ABORTED` (not retryable) instead of rethrowing the fetch `AbortError`.
- `MoreflowFormError` has the same shape as the `@moreflow/chatbots` and `@moreflow/meetings` errors: `code` (now always set, `REQUEST_FAILED` when the server sent none), `message`, `retryable`, typed `recovery: { operation, args }`, `details` (the server's context, `{}` when none), `status`, `requestId` and `responseBody`. A `VALIDATION_ERROR` submission exposes the missing required fields in `details.missingFieldIds`; `missingFieldIdsFromError(error)` reads them.
- `FormErrorCode` lists the codes the SDK and the public form endpoints return. Network failures carry `NETWORK_ERROR`.
- `submitWithRetry` retries HTTP 408 like the other SDKs, and failures the server marks retryable are `retryable`.
- Missing arguments, a missing `fetch` and Turnstile load failures throw `MoreflowFormError` (`VALIDATION_ERROR`, `FETCH_UNAVAILABLE`, `TURNSTILE_UNAVAILABLE`) instead of a plain `Error`. `createIdempotencyKey` no longer throws without Web Crypto; it falls back to a non-cryptographic id.
- Add `validationMessage(issue, { language })`, the German or English text for a validation issue. `FormValidationIssue.message` stays English.
- The README error example no longer checks `CLIENT_NO_EMAIL`, a code forms never returns.
- Breaking: `submitWithRetry` no longer captures acquisition tracking on its own. Pass `acquisitionTracking: true`, or a function that returns `true` once the visitor consented, to capture UTM parameters, ad click ids and Meta's `_fbp`/`_fbc` cookies when no `tracking` is given. Reading those cookies and writing `sessionStorage` needs consent in the EU. Explicit `tracking` values are still sent as given, and a submission without tracking omits the `tracking` field. Export the `AcquisitionTrackingSetting` type. The same option exists on `@moreflow/chatbots` and `@moreflow/meetings`.
- README: browser examples no longer pass an API token (the public form endpoints accept anonymous requests from allowed domains) and warn against tokens in page source; add a setup step for the form's allowed domains, a table of server error codes, and a stored-data table.

## 0.7.0

- **Breaking:** the public form API no longer emits the legacy `isRequired` component flag, only `required`. Code that read `isRequired` from the raw `GET /v1/forms/{formId}` response or from `component.raw` now sees `undefined` and treats every field as optional.
  Upgrade steps:
  1. Read the normalized `component.required` from `getPublicForm` or `normalizePublicFormDefinition`; it still falls back to `isRequired` for definitions in the legacy shape.
  2. Remove reads of `raw.isRequired` and of `isRequired` in hand-written response parsing.
- Read the clean v1 public form resource in `getPublicForm` and `normalizePublicFormDefinition`: the form `id`, `name`, `accountId`, `honeypotField`, `spamProtection` at the root, and the published `version` with camelCase `fieldMatching`. The v1 field is preferred whenever both shapes are present.
- Keep reading the legacy production shape as a fallback until every embed is upgraded: `record.data.config.current_version`, `record.id`, `record.accountId`, `record.data.name`, and the snake_case `field_matching` alias still normalize to the same `PublicFormDefinition`.
- Read the v1 form field flag `required` first and fall back to the legacy `isRequired` key, so both persisted component shapes normalize to `required: boolean`. The public API now emits only `required`; `raw` still carries the original component object.
- Add the `tracking_consent` component type for email tracking consent. It is always optional and never yields `CONSENT_REQUIRED`, even when a definition marks it required. While its account-authored `checkboxText` is empty it is hidden from visitors (`isComponentVisibleToVisitors`), and `partitionFormPages`, `formInputComponents`, validation and `prepareSubmissionData` skip it.
- Remove the unused dialog-button message from the default form catalogs.
  Customer-owned forms continue to use the public API; the legacy iframe SDK
  has been retired in Moreflow.

## 0.6.0

- Document stable form-scoped image URLs returned by the public API for custom embeds.
- Export PublicFormAccountId and use it for PublicFormDefinition.accountId so account IDs retain their semantic type in TypeScript consumers.
- Rebuild the browser, ESM, and declaration bundles with the current package tooling.

## 0.5.0

- Add optional `mountTurnstile` browser mounting with reset and destroy controls, and expose public Turnstile configuration in form definitions.
- Expose the form honeypot field and retain spam inputs in idempotent submission payloads.

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
