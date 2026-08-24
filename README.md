# `@moreflow/forms`

Headless browser helpers for custom Moreflow forms. The package contains no UI, React, styles, or rendering code.

```ts
import {
  captureAcquisitionTracking,
  normalizePhoneNumber,
  submitWithRetry
} from '@moreflow/forms';

const phone = normalizePhoneNumber('+49 (170) 1234567');
if (phone.status === 'valid') formData.phone = phone.e164;

const result = await submitWithRetry({
  formId: '00000000-0000-4000-8000-000000000001',
  input: { data: formData },
  tracking: captureAcquisitionTracking()
});
```

`submitWithRetry` stores a key and business-payload hash together in `sessionStorage`. It reuses the key for an identical network retry, rotates it when `data` or `fieldMatching` changes, freezes acquisition tracking for the attempt, and clears the record only after a successful response. HTTP 425, 429, network failures, and 5xx responses retry with the same serialized body and key. A 409 conflict is surfaced as `MoreflowFormError` so the caller can decide how to recover.

Payload fingerprints use SHA-256 when `crypto.subtle` is available and a deterministic djb2 fallback on insecure HTTP pages. Idempotency keys still require `crypto.getRandomValues`, which browsers provide on those pages.

The helper posts to `/api/v1/forms/{formId}/submissions` and sends both the `Idempotency-Key` header and JSON `idempotencyKey` field. See the [API idempotency guide](https://api.moreflow.io/api/v1/operations/docs/guide#idempotency) for the server contract and recovery table.

## Issues and contributing

Bug reports and feature requests are welcome in [this repository's issue tracker](https://github.com/moreflow-io/forms/issues). Development happens in the private Moreflow monorepo alongside the server contract this package mirrors; each released version is synced here, so the published source always matches the npm release.
