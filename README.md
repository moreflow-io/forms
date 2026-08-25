# `@moreflow/forms`

Headless browser helpers for custom Moreflow forms. The package contains no UI, React, styles, or rendering code.

## Script-tag platforms

For HTML, WordPress, Webflow, Wix, and other pages without a JavaScript bundler, load the browser build before the script that uses it:

```html
<script src="https://cdn.jsdelivr.net/npm/@moreflow/forms@0.2.1/dist/browser.js"></script>
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

`window.MoreflowForms` exposes the same runtime API as the ESM package, including `captureAcquisitionTracking`, `normalizePhoneNumber`, and `submitWithRetry`. The browser build is a classic, self-contained IIFE: it includes phone-number parsing and does not need import maps, a bundler, or a second script.

Use the exact versioned jsDelivr URL shown above. Response caching and headers are CDN-managed; Moreflow does not set cache headers for this npm-hosted file. Pin an exact published version and deliberately change the URL for every release, so a cached embed can never silently pick up new code. Do not use a bare package URL, a version range, or `@latest` for a production embed. The IIFE is the full phone-inclusive bundle (about 33 KB gzip). Optional phone parsing was evaluated but is intentionally not split: classic IIFEs cannot safely code-split without adding a loader/runtime dependency, and the full bundle is small enough for an embed.

The host page's Content Security Policy must allow the CDN, for example `script-src 'self' https://cdn.jsdelivr.net`. Requests to a cross-origin `baseUrl` also need the API's CORS policy to allow the page origin and the `Authorization` and `Idempotency-Key` request headers.

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

`captureAcquisitionTracking()` is re-exported from `@moreflow/tracking` for backwards compatibility. It needs no configuration in a browser: it reads the page URL, cookies, `document.referrer`, and `navigator.userAgent` automatically, and every value can still be overridden through its options. Captured tracking is persisted (default: `sessionStorage`) so signals from the landing page survive navigation to the form page.

`submitWithRetry` stores the idempotency key, a business-payload hash, and the exact serialized request body together in `sessionStorage`. Retries are byte-identical — within one call and across separate calls after a reload — because a pending attempt replays the stored body, including the acquisition-tracking snapshot frozen when the attempt was first created. The key rotates whenever the business payload changes (`data`, `fieldMatching`, `utmParams`, `consent`, `spam`, or `formEntryId`), and the record is cleared only after a successful response. Note this means the submitted form data sits in `sessionStorage` (tab-scoped, cleared on success) while an attempt is pending. HTTP 425, 429, network failures, and 5xx responses retry with the same serialized body and key; numeric `Retry-After` headers are honored up to a ceiling (`maxRetryDelayMs`, default 30 seconds). A 409 conflict is surfaced as `MoreflowFormError` so the caller can decide how to recover.

If storage is unavailable or throws — including a caller-provided `StorageLike` — every helper degrades to a shared in-memory fallback that lives for the browser session, so tracking capture and submission never fail because of storage.

Payload fingerprints use SHA-256 when `crypto.subtle` is available and a deterministic djb2 fallback on insecure HTTP pages. Idempotency keys still require `crypto.getRandomValues`, which browsers provide on those pages.

The helper posts to `{baseUrl}/api/v1/forms/{formId}/submissions` and sends both the `Idempotency-Key` header and JSON `idempotencyKey` field. `baseUrl` defaults to `''`, i.e. the page's own origin — the zero-config setup assumes a same-origin proxy in front of the Moreflow API; pass `baseUrl` explicitly to post cross-origin. For cross-origin submissions, pass `token` to send `Authorization: Bearer <token>` on every attempt, including a replay of a stored idempotent body. You can also pass `headers` for additional request headers; the helper always supplies the JSON content type and idempotency key. See the [API idempotency guide](https://api.moreflow.io/api/v1/operations/docs/guide#idempotency) for the server contract and recovery table.

`normalizePhoneNumber` parses with `DEFAULT_PHONE_COUNTRY` (`'DE'`) when the input has no international prefix; pass `{ defaultCountry }` to change it. The whole input must be a single phone number — numbers embedded inside prose are rejected as `invalid`.

## Phone verification

When a form's phone field has verification enabled (`verifyPhone` on the published component), verify the number before submitting:

```ts
import { checkPhoneVerification, sendPhoneVerification } from '@moreflow/forms';

const challenge = await sendPhoneVerification({
  formId: '00000000-0000-4000-8000-000000000001',
  phoneNumber: '0170 1234567', // normalized to +491701234567 before sending
  baseUrl: 'https://api.moreflow.io'
});

// The visitor receives an SMS code; collect it, then:
const { phoneNumber } = await checkPhoneVerification({
  formId: '00000000-0000-4000-8000-000000000001',
  phoneNumber: challenge.phoneNumber,
  code: enteredCode,
  challengeId: challenge.challengeId,
  baseUrl: 'https://api.moreflow.io'
});
// Submit with the verified E.164 `phoneNumber` in the form data.
```

The helpers call the public `PUT`/`POST /api/v1/forms/{formId}/phone-verification` endpoints (no token needed; the endpoints are rate limited). `baseUrl` defaults to `''` — the same same-origin-proxy assumption as `submitWithRetry` — and `token`, `headers`, `fetchImpl`, `signal`, and `defaultCountry` work the same way. Both helpers normalize the input to E.164 first and reject invalid numbers locally as `MoreflowFormError` with code `INVALID_PHONE_NUMBER`, without contacting the server.

Failures are `MoreflowFormError` with the server's navigational code: `INVALID_VERIFICATION_CODE` means let the visitor retype the code; `VERIFICATION_PROOF_EXPIRED` and `VERIFICATION_PROOF_REPLAYED` mean start a new challenge with `sendPhoneVerification`; a 429 sets `retryable` with the usual `Retry-After` semantics. Neither helper retries on its own — every send is a real SMS — so offer an explicit "resend code" action instead of resending automatically. A challenge expires after roughly ten minutes and can be used once.

Verification is enforced by the embed flow, not by the submission endpoint: run it before `submitWithRetry` and submit the verified number returned by `checkPhoneVerification`.

## Issues and contributing

Bug reports and feature requests are welcome in [this repository's issue tracker](https://github.com/moreflow-io/forms/issues). Development happens in the private Moreflow monorepo alongside the server contract this package mirrors; each released version is synced here, so the published source always matches the npm release.
