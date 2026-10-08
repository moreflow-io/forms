# `@moreflow/forms`

Headless browser helpers for custom Moreflow forms. The default API contains no UI,
React, styles, or form rendering: it loads the published definition in one canonical
shape, validates entered values with the same rules the hosted form uses, prepares
and submits payloads idempotently, and resolves Moreflow's default labels. The only
optional rendering helper is `mountTurnstile`, a deliberately narrow browser mount
for the public site key discovered from a Moreflow form definition.

## Script-tag platforms

For HTML, WordPress, Webflow, Wix, and other pages without a JavaScript bundler, load the browser build before the script that uses it:

```html
<script src="https://cdn.jsdelivr.net/npm/@moreflow/forms@0.6.0/dist/browser.js"></script>
<script>
  const forms = window.MoreflowForms;

  async function submitContactForm(formData) {
    const phone = forms.normalizePhoneNumber(formData.phone);
    if (phone.status === 'valid') formData.phone = phone.e164;

    return forms.submitWithRetry({
      formId: '00000000-0000-4000-8000-000000000001',
      input: { data: formData },
      tracking: forms.captureAcquisitionTracking(),
      baseUrl: 'https://api.moreflow.io',
      token: '{{MOREFLOW_API_TOKEN}}'
    });
  }
</script>
```

`window.MoreflowForms` exposes the same runtime API as the ESM package. The browser build is a classic, self-contained IIFE: it includes phone-number parsing and the default label catalogs and does not need import maps, a bundler, or a second script.

Use the exact versioned jsDelivr URL shown above. Response caching and headers are CDN-managed; Moreflow does not set cache headers for this npm-hosted file. Pin an exact published version and deliberately change the URL for every release, so a cached embed can never silently pick up new code. Do not use a bare package URL, a version range, or `@latest` for a production embed. The IIFE is the full bundle (about 44 KB gzip).

The host page's Content Security Policy must allow the CDN, for example `script-src 'self' https://cdn.jsdelivr.net`. Requests to a cross-origin `baseUrl` also need the API's CORS policy to allow the page origin and the `Authorization` and `Idempotency-Key` request headers.

## Loading the form definition

`getPublicForm` loads the published form (`GET /api/v1/forms/{formId}`) and returns one normalized `PublicFormDefinition`, regardless of which historical response shape the API produced. You never probe `record.data.config.current_version` vs `version`, `fieldMatching` vs `field_matching`, or `required` vs `isRequired` yourself — the helper resolves all of that:

```ts
import { getPublicForm, partitionFormPages, resolveFormMessage } from '@moreflow/forms';

const definition = await getPublicForm({
  formId: '00000000-0000-4000-8000-000000000001',
  baseUrl: 'https://api.moreflow.io'
});

const { steps, thankYou } = partitionFormPages(definition);
for (const page of steps) {
  for (const component of page.components) {
    // `label`/`placeholder` may be literal text or a forms.* message key:
    const label = resolveFormMessage(component.label, { language: 'de' });
  }
}
```

Every component carries `id`, `type`, a merged boolean `required`, normalized `options` (`{ value, label }` objects even when strings were persisted), `verifyPhone` for phone fields, and the original persisted object under `raw` for custom passthrough props. `definition.fieldMatching` is typed (`{ formFieldId, clientField }[]`) and should be passed unchanged as `input.fieldMatching` when submitting.

Image blocks (`type: 'image'`, on thank-you pages under `props`) carry a stable `src` that never expires. Render it directly — `<img src={item.props.src} alt={item.props.alt} />` — without refresh timers, expiry checks, or retry handlers: the API answers each request with a redirect to a freshly signed storage URL. The URL keeps working for as long as the image is part of the published form; after a republish that replaces it, load the definition again.

## Optional Turnstile mount

`definition.spamProtection.turnstile` is public discovery data for the form’s
Turnstile policy. It contains a site key only when Moreflow has a configured
widget/verifier for the current context. For customer embeds, call
`mountTurnstile` only after `getPublicForm` returns a non-empty site key; it
injects Cloudflare’s script once, explicitly renders an invisible managed widget,
and gives the integration `reset` and `destroy` controls. It does not render any
other UI or submit a form on your behalf.

```ts
import { getPublicForm, mountTurnstile } from '@moreflow/forms';

const definition = await getPublicForm({ formId, baseUrl, token });
const protection = definition.spamProtection.turnstile;
let turnstile: Awaited<ReturnType<typeof mountTurnstile>> | undefined;
let turnstileToken = '';

if (protection.siteKey) {
  turnstile = await mountTurnstile(document.getElementById('turnstile')!, {
    siteKey: protection.siteKey,
    onToken: (token) => {
      turnstileToken = token;
    },
    onExpired: () => {
      turnstileToken = '';
    }
  });
}

// Include `spam: { turnstileToken }` in input when you submit. Reset after an
// ANTI_SPAM_REQUIRED or ANTI_SPAM_INVALID response, then let the widget issue a
// fresh short-lived, single-use token. When siteKey is blank, submit normally:
// the Moreflow server fails open by quarantining the submission instead.
turnstile?.reset();
```

The site key is intentionally public. Never put a Cloudflare Turnstile secret,
Cloudflare API token, or customer Cloudflare credential in an embed.

Failures throw `MoreflowFormError` with the server's navigational code: `FORM_NOT_FOUND` (stale or wrong id), `FORM_RETIRED` (archived), `FORM_UNPUBLISHED` (no active published version), or `INVALID_FORM_DEFINITION` when a proxy returned an unusable body. `baseUrl` defaults to `''` (a same-origin proxy), and `token`, `headers`, `fetchImpl`, and `signal` work like in `submitWithRetry`.

## Validating and preparing values

`validateFormValues` (whole form), `validateFormPage` (one wizard step), and `validateComponentValue` (one field) apply the same rules as the hosted Moreflow form: required fields, consent checkboxes, address completeness, the email format check, and full libphonenumber phone validation. Issues are structured — map the `code` to your own translated copy instead of showing the English `message` verbatim:

```ts
import { prepareSubmissionData, submitWithRetry, validateFormPage } from '@moreflow/forms';

const issues = validateFormPage(page, values); // [{ componentId, componentType, code, message }]
// codes: REQUIRED | INVALID_EMAIL | INVALID_PHONE_NUMBER | CONSENT_REQUIRED | INCOMPLETE_ADDRESS

if (issues.length === 0) {
  await submitWithRetry({
    formId: definition.formId,
    input: {
      data: prepareSubmissionData(definition, values), // phones → E.164, empties dropped
      fieldMatching: definition.fieldMatching
    },
    baseUrl: 'https://api.moreflow.io'
  });
}
```

Presentational components (`heading`, `separator`, `spacing`, `image`, `video`, `iframe`) are skipped automatically. Pass `{ defaultCountry }` to both helpers when the audience is not German (`'DE'` is the default).

## Default labels and translations

Published definitions store Moreflow's default labels as message keys (`forms.defaults.first_name.label`, `forms.privacy.iAgree`, `forms.settings.submitButton`, ...). `resolveFormMessage` turns them into the same German or English copy the hosted form renders; literal text a form author typed passes through unchanged, so it is safe to call on every label:

```ts
import { resolveFormMessage } from '@moreflow/forms';

resolveFormMessage('forms.defaults.first_name.label'); // 'Vorname'
resolveFormMessage('forms.defaults.first_name.label', { language: 'en' }); // 'First name'
resolveFormMessage('Firmenname'); // 'Firmenname' (literal text is untouched)
resolveFormMessage('forms.privacy.consentLabel', { params: { companyName: 'ACME GmbH' } });
```

The catalogs are exported as `formMessageCatalogs` if you want to merge your own overrides on top.

## Submitting

```ts
import { captureAcquisitionTracking, normalizePhoneNumber, submitWithRetry } from '@moreflow/forms';

const phone = normalizePhoneNumber('+49 (170) 1234567');
if (phone.status === 'valid') formData.phone = phone.e164;

const result = await submitWithRetry({
  formId: '00000000-0000-4000-8000-000000000001',
  input: { data: formData },
  tracking: captureAcquisitionTracking(),
  baseUrl: 'https://api.moreflow.io',
  token: '{{MOREFLOW_API_TOKEN}}'
});
```

`captureAcquisitionTracking()` is re-exported from `@moreflow/tracking` and is the sanctioned way to attach acquisition signals — do not hand-roll your own UTM/cookie capture. It needs no configuration in a browser: it reads the page URL, cookies, `document.referrer`, and `navigator.userAgent` automatically, and every value can still be overridden through its options. Captured tracking is persisted (default: `sessionStorage`) so signals from the landing page survive navigation to the form page.

A privacy/consent checkbox that exists as a form component (`privacy_policy`) is ordinary form data and belongs in `input.data` under its component id. Consent context that is _not_ a form field (for example a marketing opt-in your page adds around the form) belongs in `input.consent`; changing it rotates the idempotency key like any other business-payload change.

`submitWithRetry` stores the idempotency key, a business-payload hash, and the exact serialized request body together in `sessionStorage`. Retries are byte-identical — within one call and across separate calls after a reload — because a pending attempt replays the stored body, including the acquisition-tracking snapshot frozen when the attempt was first created. The key rotates whenever the business payload changes (`data`, `fieldMatching`, `utmParams`, `consent`, `spam`, or `formEntryId`), and the record is cleared only after a successful response. Note this means the submitted form data sits in `sessionStorage` (tab-scoped, cleared on success) while an attempt is pending. HTTP 425, 429, network failures, and 5xx responses retry with the same serialized body and key; numeric `Retry-After` headers are honored up to a ceiling (`maxRetryDelayMs`, default 30 seconds). A 409 conflict is surfaced as `MoreflowFormError` so the caller can decide how to recover.

If storage is unavailable or throws — including a caller-provided `StorageLike` — every helper degrades to a shared in-memory fallback that lives for the browser session, so tracking capture and submission never fail because of storage.

Payload fingerprints use SHA-256 when `crypto.subtle` is available and a deterministic djb2 fallback on insecure HTTP pages. Idempotency keys still require `crypto.getRandomValues`, which browsers provide on those pages.

The helper posts to `{baseUrl}/api/v1/forms/{formId}/submissions` and sends both the `Idempotency-Key` header and JSON `idempotencyKey` field. `baseUrl` defaults to `''`, i.e. the page's own origin — the zero-config setup assumes a same-origin proxy in front of the Moreflow API; pass `baseUrl` explicitly to post cross-origin. For cross-origin submissions, pass `token` to send `Authorization: Bearer <token>` on every attempt, including a replay of a stored idempotent body. You can also pass `headers` for additional request headers; the helper always supplies the JSON content type and idempotency key. See the [API idempotency guide](https://api.moreflow.io/api/v1/operations/docs/guide#idempotency) for the server contract and recovery table.

## Error messages

Every helper throws `MoreflowFormError` carrying `status`, the server's navigational `code`, `retryable`, and the raw `responseBody`. The error `message` already prefers the server's human-readable message when one exists. For display, `formErrorMessage(error, fallback)` returns the best available text for any caught value without digging through response-body shapes:

```ts
import { formErrorMessage, MoreflowFormError } from '@moreflow/forms';

try {
  await submitWithRetry(/* ... */);
} catch (error) {
  if (error instanceof MoreflowFormError && error.code === 'CLIENT_NO_EMAIL') {
    // navigational recovery, e.g. focus the email field
  }
  showToast(formErrorMessage(error, 'Das Formular konnte nicht übermittelt werden.'));
}
```

## Split phone inputs

`normalizePhoneNumber` parses with `DEFAULT_PHONE_COUNTRY` (`'DE'`) when the input has no international prefix; pass `{ defaultCountry }` to change it. The whole input must be a single phone number — numbers embedded inside prose are rejected as `invalid`.

For a country-selector + number UI, use `describePhoneInput`/`composePhoneNumber` instead of hand-rolled dial-code tables — they handle `+`/`00` prefixes, trunk zeros, and country detection through libphonenumber:

```ts
import { composePhoneNumber, describePhoneInput } from '@moreflow/forms';

describePhoneInput('0031 6 12345678');
// { country: 'NL', callingCode: '31', nationalNumber: '612345678', e164: '+31612345678', isValid: true }

composePhoneNumber('DE', '0170 123-4567'); // '+491701234567'
```

## Phone verification

When a form's phone field has verification enabled, the definition says so — check `phoneVerificationRequired(definition)` (or the `verifyPhone` flag on the component). **Verification is enforced by the embed flow, not by the submission endpoint**: a custom embed that skips this silently submits unverified numbers. Verify before submitting:

```ts
import {
  checkPhoneVerification,
  getPublicForm,
  phoneVerificationRequired,
  sendPhoneVerification
} from '@moreflow/forms';

const definition = await getPublicForm({ formId, baseUrl: 'https://api.moreflow.io' });

if (phoneVerificationRequired(definition)) {
  const challenge = await sendPhoneVerification({
    formId,
    phoneNumber: '0170 1234567', // normalized to +491701234567 before sending
    baseUrl: 'https://api.moreflow.io'
  });

  // The visitor receives an SMS code; collect it, then:
  const { phoneNumber } = await checkPhoneVerification({
    formId,
    phoneNumber: challenge.phoneNumber,
    code: enteredCode,
    challengeId: challenge.challengeId,
    baseUrl: 'https://api.moreflow.io'
  });
  // Submit with the verified E.164 `phoneNumber` in the form data.
}
```

The helpers call the public `PUT`/`POST /api/v1/forms/{formId}/phone-verification` endpoints (no token needed; the endpoints are rate limited). `baseUrl` defaults to `''` — the same same-origin-proxy assumption as `submitWithRetry` — and `token`, `headers`, `fetchImpl`, `signal`, and `defaultCountry` work the same way. Both helpers normalize the input to E.164 first and reject invalid numbers locally as `MoreflowFormError` with code `INVALID_PHONE_NUMBER`, without contacting the server.

Failures are `MoreflowFormError` with the server's navigational code: `INVALID_VERIFICATION_CODE` means let the visitor retype the code; `VERIFICATION_PROOF_EXPIRED` and `VERIFICATION_PROOF_REPLAYED` mean start a new challenge with `sendPhoneVerification`; a 429 sets `retryable` with the usual `Retry-After` semantics. Neither helper retries on its own — every send is a real SMS — so offer an explicit "resend code" action instead of resending automatically. A challenge expires after roughly ten minutes and can be used once.

## Issues and contributing

Bug reports and feature requests are welcome in [this repository's issue tracker](https://github.com/moreflow-io/forms/issues). Development happens in the private Moreflow monorepo alongside the server contract this package mirrors; each released version is synced here, so the published source always matches the npm release.
