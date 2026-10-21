# `@moreflow/forms`

Headless browser helpers for custom Moreflow forms. The default API contains no UI,
React, styles, or form rendering: it loads the published definition in one canonical
shape, validates entered values with the same rules the hosted form uses, prepares
and submits payloads idempotently, and resolves Moreflow's default labels.
`createFormSession` combines them into one store that runs a whole wizard, so a custom
form needs only presentation code, and the optional `@moreflow/forms/react` entry wraps
it in a `useMoreflowForm` hook. The only optional rendering helper is `mountTurnstile`,
a deliberately narrow browser mount for the public site key discovered from a Moreflow
form definition.

```bash
npm install @moreflow/forms
```

The other public SDKs, the agent plugins, and the HTTP API are listed in the
[Moreflow SDK overview](https://api.moreflow.io/v1/operations/docs/guide#sdks).

## Setup

1. Publish the form in Moreflow.
2. Open the form's **Embed** tab and add the domain that will show the form under
   **Websites** (for example `example.com`; this also covers subdomains such as
   `www.example.com`). Moreflow checks the browser's `Origin` against this list on every
   load and submission, and rejects every browser origin while the list is empty. Until
   your domain is on it, the first request fails with `ORIGIN_NOT_ALLOWED`. Agents can set
   the list with the `forms.allowedDomains.update` operation.
3. Load the definition and submit with the helpers below. Browser code needs no API
   token: the public form endpoints accept anonymous requests from allowed domains.

> **Never put an API token in page source.** Anyone can read a token that is in your
> HTML or JavaScript bundle and call the Moreflow API with it. The `token` option exists
> for server-side code that forwards submissions (for example a backend proxy), where
> the token stays on your server.

## Script-tag platforms

For HTML, WordPress, Webflow, Wix, and other pages without a JavaScript bundler, load the browser build before the script that uses it:

```html
<script src="https://cdn.jsdelivr.net/npm/@moreflow/forms@0.9.0/dist/browser.js"></script>
<script>
  const forms = window.MoreflowForms;

  async function submitContactForm(formData) {
    const phone = forms.normalizePhoneNumber(formData.phone);
    if (phone.status === 'valid') formData.phone = phone.e164;

    return forms.submitWithRetry({
      formId: '00000000-0000-4000-8000-000000000001',
      input: { data: formData },
      baseUrl: 'https://api.moreflow.io',
      // Attach UTM and ad click ids only after the visitor consented (see "Acquisition tracking and consent").
      acquisitionTracking: () => window.visitorConsentedToMarketing === true
    });
  }
</script>
```

`window.MoreflowForms` exposes the same runtime API as the ESM package. The browser build is a classic, self-contained IIFE: it includes phone-number parsing and the default label catalogs and does not need import maps, a bundler, or a second script.

Use the exact versioned jsDelivr URL shown above. Response caching and headers are CDN-managed; Moreflow does not set cache headers for this npm-hosted file. Pin an exact published version and deliberately change the URL for every release, so a cached embed can never silently pick up new code. Do not use a bare package URL, a version range, or `@latest` for a production embed. The IIFE is the full bundle (about 44 KB gzip).

The host page's Content Security Policy must allow the CDN and the API, for example `script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://api.moreflow.io`. Whether a browser origin may load or submit the form is decided by the form's allowed domains (see [Setup](#setup)). Submissions and phone verification send JSON, so the browser sends a CORS preflight first, and `https://api.moreflow.io` does not answer that preflight for other sites. Forward `/v1/forms/*` from your own server to `https://api.moreflow.io` and pass `baseUrl: ''`; loading the definition with `getPublicForm` works cross-origin.

## Configure a forms client once

`createFormsClient` is optional; the per-call helpers remain available. It binds
shared transport and session defaults for a site:

```ts
import { createFormsClient } from '@moreflow/forms';

const forms = createFormsClient({
  baseUrl: '', // Forward /v1/forms/* to Moreflow from your own server.
  acquisitionTracking: () => consentManager.hasMarketingConsent(),
  trackingCapture: { model: 'first-touch' },
  fetchImpl: fetch,
  formality: 'informal'
});
const definition = await forms.getPublicForm({ formId });
const session = forms.createFormSession(definition);
```

The client exposes `getPublicForm(options)`,
`createFormSession(definition, options?)`, `submitWithRetry(options)`,
`sendPhoneVerification(options)`, and `checkPhoneVerification(options)`.
Per-call options override client defaults. `baseUrl` defaults to
`https://api.moreflow.io`; pass a development origin or `''` for a same-origin
proxy. `fetchImpl` selects a custom transport consistently across the SDKs.

## Form sessions: a wizard with presentation code only

`createFormSession(definition, options)` runs a whole custom form for you: wizard
steps, values, localized validation, phone verification, honeypot, Turnstile,
submission and the thank-you result. It is a framework-agnostic store: render from
`session.getSnapshot()` and re-render when `session.subscribe(listener)` fires. Your
code is only presentation.

- **Language and company name** default to `definition.language` and
  `definition.companyName`, which Moreflow returns with the form, so the
  `marketing_consent` box shows the exact name Moreflow evidences the consent with
  and the submission's `locale` matches the language you render.
- **Steps**: `state.steps`, `state.step`, `stepIndex`, `isFirstStep`, `isLastStep`
  and `progress` (0 to 1). `next()` validates the current step and moves on, or
  submits on the last step; `back()` goes back.
- **Values and issues**: `setValue(id, value)` stores a value and clears its issue;
  `blur(id)` validates a field the visitor left once it holds a value.
  `state.issues[id].message` is already localized, and `state.focusComponentId`
  names the field to focus after a failed `next()` or `submit()`.
- **Submit**: `submit()` validates every step (jumping to the first invalid one),
  waits for a Turnstile token when the form's mode is `require`, runs phone
  verification when the form requires it, then submits idempotently with
  `fieldMatching`, `locale`, the honeypot value and the Turnstile token. Untouched
  optional consent boxes are submitted as an explicit `false`. A server
  `VALIDATION_ERROR` marks the fields it names; `ANTI_SPAM_INVALID` resets the
  Turnstile token. Form-level failures land in `state.error.message`, localized.
- **Phone verification**: when a phone field has `verifyPhone`, `submit()` texts
  the code and sets `status: 'verifying'`. `state.phoneVerification` holds
  `status`, `phoneNumber`, `code` and `error`; `session.phoneVerification` has
  `sendCode()`, `setCode(code)`, `verify(code?)` (which continues the submission),
  `resend()` and `changeNumber()`.
- **Spam protection**: render a hidden input named `state.honeypot.name` and report
  it with `setHoneypot(value)`; call `session.turnstile.mount(container)` when
  `state.turnstile.enabled` (or report your own widget with `turnstile.setToken`).
- **Result**: after `status: 'submitted'`, `state.result` holds the server's
  submission, the `thankYou` page and a validated `redirectUrl` from the form's
  thank-you page setting. Navigate there yourself.
- **Copy**: `language`, `formality: 'informal'` for German "du" (default "Sie") and
  `messages` (`forms`, `validation` and `errors` overrides) apply to every text the
  session produces. `session.message(label)` resolves labels and placeholders with
  the same overrides; `session.marketingConsentText()` returns the marketing box text.
- `acquisitionTracking`, `trackingCapture` (capture options or a consent-gated
  callback read at submit time),
  `utmParams`, `consent`, `defaultCountry`, `initialValues`, `baseUrl` and
  `fetchImpl` are passed through to the low-level helpers.

### React: `@moreflow/forms/react`

`useMoreflowForm(options)` loads the form (or takes a `definition` you loaded on the
server), creates the session and re-renders on every change through
`useSyncExternalStore`. React is an optional peer dependency and never part of the
core `@moreflow/forms` bundle. A complete wizard in the style of a quiz funnel, with
a tap-to-advance first step, "du" copy, SMS verification and a thank-you page:

```tsx
'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import type { PublicFormComponent, PublicFormThankYouItem } from '@moreflow/forms';
import { type FormSession, type FormSessionSnapshot, useMoreflowForm } from '@moreflow/forms/react';

type Props = { session: FormSession; state: FormSessionSnapshot };

// Only the copy that differs from the package defaults.
const messages = {
  forms: {
    'forms.defaults.first_name.placeholder': 'Dein Vorname',
    'forms.settings.submitButton': 'Kostenlos anfragen'
  },
  validation: { CONSENT_REQUIRED: 'Bitte stimme den Datenschutzbestimmungen zu.' }
};
const CHECKBOXES = new Set(['privacy_policy', 'privacy_checkbox', 'tracking_consent', 'marketing_consent']);

export function LeadForm({ formId }: { formId: string }) {
  const form = useMoreflowForm({ formId, formality: 'informal', messages });
  const focusId = form.state?.focusComponentId;
  useEffect(() => {
    if (focusId) document.getElementById(focusId)?.focus();
  }, [focusId]);

  if (form.status === 'loading') return <p aria-busy="true">Formular wird geladen …</p>;
  if (form.status === 'error') return <p role="alert">{form.error.message}</p>;
  const { session, state } = form;
  if (state.status === 'submitted') return <ThankYou state={state} session={session} />;
  if (state.status === 'verifying') return <VerifyPhone state={state} session={session} />;

  return (
    <form noValidate onSubmit={(event) => { event.preventDefault(); void session.next(); }}>
      <progress max={1} value={state.progress} />
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
        <input name={state.honeypot.name} tabIndex={-1} autoComplete="off" value={state.honeypot.value}
          onChange={(event) => session.setHoneypot(event.target.value)} />
      </div>
      {state.step?.components.map((component) => (
        <Field key={component.id} component={component} state={state} session={session} />
      ))}
      {state.isLastStep && state.turnstile.enabled && <Turnstile session={session} />}
      {state.error && <p role="alert">{state.error.message}</p>}
      {!state.isFirstStep && <button type="button" onClick={() => session.back()}>Zurück</button>}
      <button type="submit" disabled={state.status === 'submitting'}>
        {state.isLastStep ? state.labels.submit : state.labels.continue}
      </button>
    </form>
  );
}

function Field({ component: c, session, state }: Props & { component: PublicFormComponent }) {
  const value = state.values[c.id];
  const issue = state.issues[c.id];
  const label = session.message(c.label);
  const field = {
    id: c.id,
    'aria-invalid': Boolean(issue),
    'aria-describedby': issue ? `${c.id}-issue` : undefined,
    onBlur: () => session.blur(c.id)
  };
  let input: ReactNode;
  if (c.type === 'heading') return <h3>{label}</h3>;
  if (c.type === 'dropdown') {
    // Tap an answer to store it and advance (or submit on the last step).
    input = c.options?.map((option) => (
      <button key={option.value} type="button" aria-pressed={value === option.value}
        onClick={() => { session.setValue(c.id, option.value); void session.next(); }}>
        {option.label}
      </button>
    ));
  } else if (CHECKBOXES.has(c.type)) {
    const text = c.type === 'marketing_consent'
      ? session.marketingConsentText()
      : session.message(c.checkboxText ?? c.label);
    input = (
      <label>
        <input type="checkbox" {...field} checked={value === true}
          onChange={(event) => session.setValue(c.id, event.target.checked)} /> {text}
      </label>
    );
  } else {
    input = (
      <input {...field} value={typeof value === 'string' ? value : ''}
        type={c.type === 'email' ? 'email' : c.type.startsWith('phone') ? 'tel' : 'text'}
        placeholder={session.message(c.placeholder)}
        onChange={(event) => session.setValue(c.id, event.target.value)} />
    );
  }
  return (
    <div>
      {!CHECKBOXES.has(c.type) && c.showLabel !== false && <label htmlFor={c.id}>{label}</label>}
      {input}
      {issue && <p id={`${c.id}-issue`} role="alert">{issue.message}</p>}
    </div>
  );
}

function VerifyPhone({ session, state }: Props) {
  const verification = state.phoneVerification;
  if (!verification) return null;
  return (
    <form onSubmit={(event) => { event.preventDefault(); void session.phoneVerification.verify(); }}>
      <p>Wir haben dir einen Code an {verification.phoneNumber ?? 'deine Nummer'} gesendet.</p>
      <input autoComplete="one-time-code" inputMode="numeric" value={verification.code}
        onChange={(event) => session.phoneVerification.setCode(event.target.value)} />
      {verification.error && <p role="alert">{verification.error.message}</p>}
      <button type="submit" disabled={verification.status !== 'code_sent'}>Bestätigen</button>
      <button type="button" onClick={() => void session.phoneVerification.resend()}>Code erneut senden</button>
      <button type="button" onClick={() => session.phoneVerification.changeNumber()}>Nummer ändern</button>
    </form>
  );
}

function Turnstile({ session }: { session: FormSession }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let cleanup = () => {};
    if (container.current) {
      void session.turnstile.mount(container.current).then((remove) => {
        if (active) cleanup = remove;
        else remove();
      });
    }
    return () => { active = false; cleanup(); };
  }, [session]);
  return <div ref={container} />;
}

function ThankYou({ state }: Props) {
  const redirectUrl = state.result?.redirectUrl;
  useEffect(() => {
    if (redirectUrl) window.location.assign(redirectUrl);
  }, [redirectUrl]);
  return <div role="status">{state.result?.thankYou?.content.map((item) => <Block key={item.id} item={item} />)}</div>;
}

function Block({ item }: { item: PublicFormThankYouItem }) {
  const content = typeof item.props?.content === 'string' ? item.props.content : '';
  return item.type === 'heading' ? <h2>{content}</h2> : <p>{content}</p>;
}
```

Pass `acquisitionTracking: () => consentGiven` for attribution. To provide your
own values, add `trackingCapture: getMyTrackingData` (a function read at submit
time only after consent). The session is created
once per definition; remount the component (for example with a `key`) to change
its `language`.

Without React, the same store drives any UI:

```ts
import { createFormSession, getPublicForm } from '@moreflow/forms';

const definition = await getPublicForm({ formId });
const session = createFormSession(definition, { formality: 'informal' });
session.subscribe(() => render(session.getSnapshot()));
render(session.getSnapshot());
```

## End-to-end example (plain DOM)

This example loads a form, renders every visible field, validates, submits, and
shows the thank-you page. It uses the ESM package; on a script-tag page, replace
the import with `const { getPublicForm, ... } = window.MoreflowForms;`. Browser
submissions need no token: add the page's domain to the form's allowed domains
in Moreflow.

```html
<div id="moreflow-form"></div>
<script type="module">
  import {
    formErrorMessage,
    formInputComponents,
    getPublicForm,
    marketingConsentText,
    mountTurnstile,
    MoreflowFormError,
    partitionFormPages,
    phoneVerificationRequired,
    prepareSubmissionData,
    resolveFormMessage,
    submitWithRetry,
    validateFormValues,
    validationMessage
  } from '@moreflow/forms';

  const formId = '00000000-0000-4000-8000-000000000001';
  const baseUrl = 'https://api.moreflow.io';
  const language = 'de';
  const companyName = 'ACME GmbH'; // your company profile name in Moreflow
  const options = { companyName }; // add defaultCountry: 'AT' for a non-German audience

  const root = document.getElementById('moreflow-form');
  const definition = await getPublicForm({ formId, baseUrl });
  if (phoneVerificationRequired(definition)) {
    // Run sendPhoneVerification/checkPhoneVerification before submitting (see "Phone verification").
  }

  // 1. Render. This renders all steps on one page; use partitionFormPages for a wizard.
  const form = document.createElement('form');
  form.noValidate = true;
  for (const component of formInputComponents(definition, options)) {
    form.append(renderField(component));
  }

  // Honeypot: a text input people never see. Bots fill it; a filled value rejects the submission.
  const honeypot = document.createElement('input');
  honeypot.name = definition.honeypotField;
  honeypot.tabIndex = -1;
  honeypot.autocomplete = 'off';
  honeypot.setAttribute('aria-hidden', 'true');
  honeypot.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden';
  form.append(honeypot);

  // Turnstile, only when the form asks for it and Moreflow has a site key.
  let turnstileToken = '';
  const protection = definition.spamProtection.turnstile;
  const turnstileBox = document.createElement('div');
  form.append(turnstileBox);
  const turnstile =
    protection.mode !== 'off' && protection.siteKey
      ? await mountTurnstile(turnstileBox, {
          siteKey: protection.siteKey,
          onToken: (token) => (turnstileToken = token),
          onExpired: () => (turnstileToken = '')
        })
      : undefined;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = resolveFormMessage('forms.settings.submitButton', { language });
  form.append(submit);
  root.append(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readValues();

    // 2. Validate with the hosted form's rules.
    form.querySelectorAll('[role="alert"]').forEach((node) => node.remove());
    const issues = validateFormValues(definition, values, options);
    for (const issue of issues) {
      const field = form.querySelector(`[data-component-id="${issue.componentId}"]`);
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = validationMessage(issue, { language });
      field?.append(message);
    }
    if (issues.length > 0) return;

    // 3. Submit. Retries reuse the same idempotency key, so a double click never creates two leads.
    submit.disabled = true;
    try {
      await submitWithRetry({
        formId: definition.formId,
        baseUrl,
        // Your consent banner's answer; see "Acquisition tracking and consent".
        acquisitionTracking: () => hasMarketingConsent(),
        input: {
          data: prepareSubmissionData(definition, values, options),
          fieldMatching: definition.fieldMatching,
          locale: language,
          spam: { honeypot: honeypot.value, turnstileToken }
        }
      });
      showThankYou();
    } catch (error) {
      if (error instanceof MoreflowFormError && error.code.startsWith('ANTI_SPAM_')) {
        turnstile?.reset(); // ANTI_SPAM_REQUIRED or ANTI_SPAM_INVALID: get a fresh token
      }
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = formErrorMessage(error, 'Das Formular konnte nicht gesendet werden.');
      form.append(message);
    } finally {
      submit.disabled = false;
    }
  });

  // 4. Thank you: redirect when the form has a thank-you URL, else render its page.
  function showThankYou() {
    const redirect = definition.settings.thankYouPageUrl ?? definition.settings.thank_you_page_url;
    if (typeof redirect === 'string' && redirect) return window.location.assign(redirect);
    const { thankYou } = partitionFormPages(definition, options);
    const page = document.createElement('section');
    page.setAttribute('aria-live', 'polite');
    for (const item of thankYou?.content ?? []) {
      if (item.type === 'image' && typeof item.props?.src === 'string') {
        const image = document.createElement('img');
        image.src = item.props.src;
        image.alt = typeof item.props.alt === 'string' ? item.props.alt : '';
        page.append(image);
      } else if (typeof item.props?.content === 'string') {
        const block = document.createElement(item.type === 'heading' ? 'h2' : 'p');
        block.textContent = item.props.content;
        page.append(block);
      }
    }
    form.replaceWith(page);
  }

  function renderField(component) {
    const field = document.createElement('div');
    field.dataset.componentId = component.id;
    const label = document.createElement('label');
    const text = resolveFormMessage(component.label, { language });
    const placeholder = resolveFormMessage(component.placeholder, { language });

    if (['privacy_policy', 'privacy_checkbox', 'tracking_consent', 'marketing_consent'].includes(component.type)) {
      const box = document.createElement('input');
      box.type = 'checkbox'; // marketing_consent must start unticked
      box.name = component.id;
      label.append(
        box,
        component.type === 'marketing_consent'
          ? marketingConsentText({ companyName, language })
          : resolveFormMessage(component.checkboxText ?? component.label, {
              language,
              params: { companyName }
            })
      );
      field.append(label);
      return field;
    }

    label.textContent = text + (component.required ? ' *' : '');
    field.append(label);

    if (component.type === 'address') {
      for (const part of ['street', 'postal', 'city', 'state', 'country']) {
        const input = document.createElement('input');
        input.name = `${component.id}.${part}`;
        input.placeholder = part;
        field.append(input);
      }
      return field;
    }
    if (component.type === 'dropdown') {
      const select = document.createElement('select');
      select.name = component.id;
      select.append(new Option(placeholder, ''));
      for (const option of component.options ?? []) {
        select.append(new Option(resolveFormMessage(option.label, { language }), option.value));
      }
      field.append(select);
      return field;
    }
    const input = document.createElement(component.type === 'textarea' ? 'textarea' : 'input');
    input.name = component.id;
    input.placeholder = placeholder;
    if (input instanceof HTMLInputElement) {
      input.type =
        { email: 'email', phone: 'tel', phone_number: 'tel', number: 'number', date: 'date' }[
          component.type
        ] ?? 'text';
    }
    field.append(input);
    return field;
  }

  // Read values in the shapes listed under "Field value shapes".
  function readValues() {
    const values = {};
    for (const component of formInputComponents(definition, options)) {
      const named = (name) => form.elements.namedItem(name);
      if (component.type === 'address') {
        values[component.id] = Object.fromEntries(
          ['street', 'postal', 'city', 'state', 'country'].map((part) => [
            part,
            named(`${component.id}.${part}`)?.value.trim() ?? ''
          ])
        );
      } else if (named(component.id)?.type === 'checkbox') {
        values[component.id] = named(component.id).checked;
      } else if (component.type === 'number') {
        const raw = named(component.id)?.value ?? '';
        values[component.id] = raw === '' ? undefined : Number(raw);
      } else {
        values[component.id] = named(component.id)?.value ?? '';
      }
    }
    return values;
  }
</script>
```

Multiple-choice and checkbox-group components (`multiple_choice`, `checkbox`)
render like `dropdown` with radio buttons or checkboxes; see the value shapes
below.

## React and server rendering

`getPublicForm`, the validation helpers, and `resolveFormMessage` are plain
functions and run anywhere, including a server component or loader.
`mountTurnstile`, `captureAcquisitionTracking`, and `submitWithRetry` use
`window`, `document`, cookies, and `sessionStorage`, so call them only in the
browser: in an effect or an event handler, never during render. `mountTurnstile`
rejects outside a browser. In the Next.js App Router, put the form in a
`'use client'` component and pass the definition in from the server.

```tsx
'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  formErrorMessage,
  formInputComponents,
  mountTurnstile,
  prepareSubmissionData,
  submitWithRetry,
  validateFormValues,
  type FormValidationIssue,
  type JsonValue,
  type MountedTurnstile,
  type PublicFormDefinition
} from '@moreflow/forms';

const baseUrl = 'https://api.moreflow.io';
const companyName = 'ACME GmbH';
const language = 'de';

export function MoreflowForm({ definition }: { definition: PublicFormDefinition }) {
  const [values, setValues] = useState<Record<string, JsonValue | undefined>>({});
  const [issues, setIssues] = useState<FormValidationIssue[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const honeypot = useRef<HTMLInputElement>(null);
  const turnstileBox = useRef<HTMLDivElement>(null);
  const turnstileToken = useRef('');
  const turnstile = useRef<MountedTurnstile | undefined>(undefined);

  // Browser only: effects never run during server rendering.
  useEffect(() => {
    const { siteKey, mode } = definition.spamProtection.turnstile;
    if (mode === 'off' || !siteKey || !turnstileBox.current) return;
    let cancelled = false;
    void mountTurnstile(turnstileBox.current, {
      siteKey,
      onToken: (token) => (turnstileToken.current = token),
      onExpired: () => (turnstileToken.current = '')
    }).then((mounted) => {
      if (cancelled) mounted.destroy();
      else turnstile.current = mounted;
    });
    return () => {
      cancelled = true;
      turnstile.current?.destroy();
    };
  }, [definition]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateFormValues(definition, values, { companyName });
    setIssues(found);
    if (found.length > 0) return;
    setStatus('sending');
    try {
      await submitWithRetry({
        formId: definition.formId,
        baseUrl,
        // Your consent banner's answer; see "Acquisition tracking and consent".
        acquisitionTracking: () => hasMarketingConsent(),
        input: {
          data: prepareSubmissionData(definition, values, { companyName }),
          fieldMatching: definition.fieldMatching,
          locale: language,
          spam: {
            honeypot: honeypot.current?.value ?? '',
            turnstileToken: turnstileToken.current
          }
        }
      });
      setStatus('sent');
    } catch (caught) {
      turnstile.current?.reset();
      setError(formErrorMessage(caught, 'Das Formular konnte nicht gesendet werden.'));
      setStatus('error');
    }
  }

  if (status === 'sent') return <p role="status">Danke!</p>; // or render the thank-you page

  return (
    <form noValidate onSubmit={onSubmit}>
      {formInputComponents(definition, { companyName }).map((component) => (
        <Field
          key={component.id}
          component={component}
          value={values[component.id]}
          issue={issues.find((issue) => issue.componentId === component.id)}
          onChange={(value) => setValues((current) => ({ ...current, [component.id]: value }))}
        />
      ))}
      <input
        ref={honeypot}
        name={definition.honeypotField}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}
      />
      <div ref={turnstileBox} />
      {status === 'error' ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={status === 'sending'}>
        Absenden
      </button>
    </form>
  );
}
```

`Field` is your own component: render the input for `component.type` exactly as
in the plain DOM example and call `onChange` with a value in the shape below.

## Field value shapes

`input.data` is keyed by component id. Moreflow stores each value as sent and
maps the linked client fields from it, so send these shapes:

| Component `type` | Value | Example |
| --- | --- | --- |
| `text`, `textarea`, `first_name`, `last_name`, `company`, `email` | string | `'Ada'` |
| `phone`, `phone_number` | string; `prepareSubmissionData` converts it to E.164 | `'+491701234567'` |
| `number` | number (a numeric string is stored as text) | `42` |
| `date` | ISO calendar date string `YYYY-MM-DD`; a date-of-birth client field is filled from it | `'1990-04-17'` |
| `dropdown`, single-select `multiple_choice` | the chosen option's `value` (not its label) | `'option-2'` |
| `checkbox`, multi-select `multiple_choice` | array of chosen option `value`s | `['news', 'events']` |
| `address` | object with `street`, `postal`, `city`, optional `state` and `country` | `{ street: 'Hauptstr. 1', postal: '10115', city: 'Berlin', country: 'DE' }` |
| `privacy_policy`, `privacy_checkbox`, `tracking_consent`, `marketing_consent` | boolean | `true` |

A required `address` needs non-blank `street`, `postal`, and `city`
(`INCOMPLETE_ADDRESS` otherwise); `state` and `country` are optional free text.
Option `value`s come from `component.options[].value`. Leave a field out (or
`undefined`) when the visitor did not fill it in.

## Loading the form definition

`getPublicForm` loads the published form (`GET /v1/forms/{formId}`) and returns one normalized `PublicFormDefinition`. It reads the clean v1 resource (`id`, `name`, `accountId`, `version` with `fieldMatching`) and still accepts the legacy production shape (`record.data.config.current_version`, snake_case `field_matching`) as a fallback. You never probe `required` vs `isRequired` or either response shape yourself — the helper resolves all of that:

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

The definition also carries `companyName`, the tenant brand's display name (the company profile name in Moreflow) that consent copy names, and `language`, the account's default form language (`'de'` or `'en'`). Both are undefined when the server predates them. `settings.submitButtonText`, `settings.continueButtonText` and `settings.thankYouPageUrl` are typed strings when set.

Every component carries `id`, `type`, a merged boolean `required`, normalized `options` (`{ value, label }` objects even when strings were persisted), `verifyPhone` for phone fields, and the original persisted object under `raw` for custom passthrough props. `definition.fieldMatching` is typed (`{ formFieldId, clientField }[]`) and should be passed unchanged as `input.fieldMatching` when submitting.

Image blocks (`type: 'image'`, on thank-you pages under `props`) carry a stable `src` that never expires. Render it directly — `<img src={item.props.src} alt={item.props.alt} />` — without refresh timers, expiry checks, or retry handlers: the API answers each request with a redirect to a freshly signed storage URL. The URL keeps working for as long as the image is part of the published form; after a republish that replaces it, load the definition again.

## Spam protection: honeypot and Turnstile

Every public form has two independent spam checks.

**Honeypot.** `definition.honeypotField` (default `website`) names a text input
that people never see and bots tend to fill. Render it off-screen (not
`type="hidden"` and not `display: none`, which bots skip), with `tabIndex={-1}`,
`autocomplete="off"`, and `aria-hidden="true"`, and send its value as
`input.spam.honeypot`. Any non-blank value rejects the submission with
`SPAM_REJECTED`; show the visitor a neutral error.

**Turnstile mode.** `definition.spamProtection.turnstile.mode` is the form's
Cloudflare Turnstile policy:

| `mode` | Without a valid token | Use in your embed |
| --- | --- | --- |
| `off` | Accepted. | Do not mount Turnstile. |
| `flag` | Accepted, but stored as suspected spam: the entry skips the CRM and automations until someone reviews it. | Mount Turnstile so real visitors are not flagged. |
| `require` | Rejected with `ANTI_SPAM_REQUIRED` (no token) or `ANTI_SPAM_INVALID` (bad or reused token). | Mount Turnstile and block submit until `onToken` fired. |

When `siteKey` is blank, Moreflow has no verifier for the current context and
fails open in both `flag` and `require`: the submission is accepted and stored
as suspected spam. Submit normally in that case.

### Optional Turnstile mount

`definition.spamProtection.turnstile` is public discovery data for the form’s
Turnstile policy. It contains a site key only when Moreflow has a configured
widget/verifier for the current context. For customer embeds, call
`mountTurnstile` only after `getPublicForm` returns a non-empty site key; it
injects Cloudflare’s script once, explicitly renders an invisible managed widget,
and gives the integration `reset` and `destroy` controls. It does not render any
other UI or submit a form on your behalf.

```ts
import { getPublicForm, mountTurnstile } from '@moreflow/forms';

const definition = await getPublicForm({ formId, baseUrl });
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

Failures throw `MoreflowFormError` with the server's navigational code: `FORM_NOT_FOUND` (stale or wrong id), `FORM_RETIRED` (archived), `FORM_UNPUBLISHED` (no active published version), or `INVALID_FORM_DEFINITION` when a proxy returned an unusable body. `baseUrl` defaults to `https://api.moreflow.io`, and `token`, `headers`, `fetchImpl`, and `signal` work like in `submitWithRetry`.

## Validating and preparing values

`validateFormValues` (whole form), `validateFormPage` (one wizard step), and `validateComponentValue` (one field) apply the same rules as the hosted Moreflow form: required fields, consent checkboxes, address completeness, the email format check, and full libphonenumber phone validation. Issues are structured; `validationMessage(issue, { language })` returns the German or English text to show next to the field (the issue's own `message` is always English):

```ts
import {
  prepareSubmissionData,
  submitWithRetry,
  validateFormPage,
  validationMessage
} from '@moreflow/forms';

const issues = validateFormPage(page, values); // [{ componentId, componentType, code, message }]
// codes: REQUIRED | INVALID_EMAIL | INVALID_PHONE_NUMBER | CONSENT_REQUIRED | INCOMPLETE_ADDRESS
const errors = Object.fromEntries(
  issues.map((issue) => [issue.componentId, validationMessage(issue, { language: 'de' })])
);

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

Presentational components (`heading`, `separator`, `spacing`, `image`, `video`, `iframe`) are skipped automatically.

### Tracking consent (`tracking_consent`)

A `tracking_consent` component is a checkbox that records the visitor's consent to email tracking. It is optional unless the account marks it required; a required box left unticked is reported as `CONSENT_REQUIRED` and blocks submission. Its consent text is written by the account in the component's `checkboxText`; Moreflow supplies no wording. While that text is empty or whitespace the component is hidden: `partitionFormPages` and `formInputComponents` leave it out, and `prepareSubmissionData` drops any value for it. Use `isComponentVisibleToVisitors(component)` to apply the same rule yourself. A checked box submits `true` under the component id, and the submission records an email tracking consent grant for the linked client.

### Privacy notice and marketing consent (`privacy_policy`, `marketing_consent`)

The `privacy_policy` checkbox acknowledges the privacy notice (`forms.privacy.consentLabel`) and may be required; it records no consent. A `marketing_consent` component is the only form field that records marketing email consent. Render it as an **unticked** checkbox without a separate label, whose text is `marketingConsentText({ companyName, language })`: Moreflow's marketing wording naming your company. It is optional unless the account marks it required; a required box left unticked is reported as `CONSENT_REQUIRED` and blocks submission. A box hidden for want of a company name never blocks.

Its text names the company, so the box is hidden without a company name. The helpers that take a definition default `companyName` to `definition.companyName`, the name Moreflow returns with the form and evidences the consent with, so you normally pass nothing. Otherwise pass the `companyName` your page shows (your company profile name in Moreflow, exactly as the hosted form shows it) to `partitionFormPages`, `formInputComponents`, `validateFormValues`, `validateFormPage`, `validateComponentValue`, and `prepareSubmissionData`. Without it they leave the box out and drop any value for it; `isComponentVisibleToVisitors(component, { companyName })` applies the same rule. A ticked box submits `true` under the component id. Send the `language` you rendered with as `input.locale`: Moreflow rebuilds the marketing text in that locale with your company profile name and records a hash of it with the grant, so the evidence matches the exact text the visitor saw.

```ts
import { marketingConsentText, partitionFormPages, prepareSubmissionData } from '@moreflow/forms';

const language = 'de';
const companyName = 'ACME GmbH'; // your company profile name in Moreflow
const { steps } = partitionFormPages(definition, { companyName });
const text = marketingConsentText({ companyName, language });
// 'Ich möchte Neuigkeiten und Angebote von ACME GmbH per E-Mail erhalten. …'

await submitWithRetry({
  formId: definition.formId,
  input: {
    data: prepareSubmissionData(definition, values, { companyName }),
    fieldMatching: definition.fieldMatching,
    locale: language
  },
  baseUrl: 'https://api.moreflow.io'
});
```

The validation helpers and `prepareSubmissionData` parse phone numbers without
an international prefix as German. Pass `{ defaultCountry }` (for example
`{ companyName, defaultCountry: 'AT' }`) to both when your audience is
elsewhere; `'DE'` is the default.

## Default labels and translations

Published definitions store Moreflow's default labels as message keys (`forms.defaults.first_name.label`, `forms.privacy.iAgree`, `forms.settings.submitButton`, ...). `resolveFormMessage` turns them into the same German or English copy the hosted form renders; literal text a form author typed passes through unchanged, so it is safe to call on every label:

```ts
import { resolveFormMessage } from '@moreflow/forms';

resolveFormMessage('forms.defaults.first_name.label'); // 'Vorname'
resolveFormMessage('forms.defaults.first_name.label', { language: 'en' }); // 'First name'
resolveFormMessage('Firmenname'); // 'Firmenname' (literal text is untouched)
resolveFormMessage('forms.privacy.consentLabel', { params: { companyName: 'ACME GmbH' } });
```

Pass `messages` to replace copy for the language you render in. The same map works for `resolveFormMessage` (`messages.forms`, keyed by the dotted key or its message id), `validationMessage` (`messages.validation`, by code), `formErrorMessage` (`messages.errors`, by code) and `createFormSession`. `formality: 'informal'` switches the German validation and error copy from "Sie" to "du":

```ts
const messages = {
  forms: { 'forms.settings.submitButton': 'Kostenlos anfragen' },
  validation: { CONSENT_REQUIRED: 'Bitte stimme den Datenschutzbestimmungen zu.' },
  errors: { FORM_NOT_FOUND: 'Dieses Angebot gibt es nicht mehr.' }
};
resolveFormMessage('forms.settings.submitButton', { messages }); // 'Kostenlos anfragen'
validationMessage({ code: 'INVALID_EMAIL' }, { formality: 'informal' }); // 'Bitte gib eine gültige E-Mail-Adresse ein.'
```

The catalogs are exported as `formMessageCatalogs` if you want to merge your own overrides on top.

## Submitting

```ts
import { normalizePhoneNumber, submitWithRetry } from '@moreflow/forms';

const phone = normalizePhoneNumber('+49 (170) 1234567');
if (phone.status === 'valid') formData.phone = phone.e164;

const result = await submitWithRetry({
  formId: '00000000-0000-4000-8000-000000000001',
  input: { data: formData },
  baseUrl: 'https://api.moreflow.io',
  acquisitionTracking: () => consentManager.hasMarketingConsent()
});
```

### Acquisition tracking and consent

`submitWithRetry` attaches no acquisition tracking unless you allow it. `acquisitionTracking: true`, or a function that returns `true`, makes it call `captureAcquisitionTracking()` (re-exported from `@moreflow/tracking`) when `input.tracking` is absent. The capture reads the UTM parameters and ad click ids from the page URL, Meta's `_fbp`/`_fbc` cookies, `document.referrer`, and `navigator.userAgent`, and keeps them in `sessionStorage` under `moreflow:acquisition:v1`, so a landing page and a form page in the same tab and on the same origin share them. Reading those cookies and writing that storage needs the visitor's consent in the EU (§ 25 TDDDG in Germany), so tie the option to your consent banner. A function is asked on every call, so a visitor who consents after the page loaded is tracked from the next submission on.

The same `acquisitionTracking` option exists on `@moreflow/chatbots` and `@moreflow/meetings`. Explicit payload `input.tracking` values are always sent as given, independently of the capture gate. To remove captured values after a visitor withdraws consent, call `clearAcquisitionTracking()`.

One `configureAcquisitionTracking({ persistence, model, ttlDays })` call at startup (re-exported from `@moreflow/tracking`) applies to these captures and to the ones your own page makes, so a site that captures on every route change and enables `acquisitionTracking: true` here sends the same landing values without a wrapper. Pass `trackingCapture: { model: 'last-touch', persistence: 'local' }` to override capture options, or `trackingCapture: () => myTrackingData` to supply values at submit time. Both forms run only while `acquisitionTracking` permits capture. The form's `storage` option is used only for the idempotency record. See the [`@moreflow/tracking` README](https://github.com/moreflow-io/tracking#readme) for the first-touch and last-touch models.

### Stored data

| Key | Storage | Lifetime | Purpose |
| --- | --- | --- | --- |
| `moreflow:idempotency:<formId>` | `sessionStorage` | Until the submission succeeds or the tab is closed | The pending attempt's idempotency key, payload hash, and request body, so a retry or reload replays the same submission instead of creating a duplicate. It contains the submitted form data. |
| `moreflow:acquisition:v1` | `sessionStorage` (`localStorage` with `persistence: 'local'`) | Until the tab is closed (or `ttlDays`, with `localStorage`) | Acquisition values captured with `acquisitionTracking` enabled (see above). Not written otherwise. |

When `sessionStorage` is blocked, both live in memory for the page instead. Pass `storage` to use your own `StorageLike`. The package sets no cookies.

A privacy/consent checkbox that exists as a form component (`privacy_policy`) is ordinary form data and belongs in `input.data` under its component id. `tracking_consent` and `marketing_consent` checkboxes work the same way: a checked box submits `true` under its component id, and an unchecked one submits `false`. Consent context that is _not_ a form field belongs in `input.consent` (for example ad and analytics cookie consent); it grants no marketing or tracking consent to the client, and changing it rotates the idempotency key like any other business-payload change. Use the form's `marketing_consent` field for a marketing opt-in.

`input.locale` (`'de'` or `'en'`, default `'de'`) is the language the visitor saw the form in; pass the same `language` you gave `resolveFormMessage` and `marketingConsentText`.

`submitWithRetry` stores the idempotency key, a business-payload hash, and the exact serialized request body together in `sessionStorage`. Retries are byte-identical — within one call and across separate calls after a reload — because a pending attempt replays the stored body, including the acquisition-tracking snapshot frozen when the attempt was first created. The key rotates whenever the business payload changes (`data`, `fieldMatching`, `utmParams`, `consent`, `locale`, `spam`, or `formEntryId`), and the record is cleared only after a successful response. Note this means the submitted form data sits in `sessionStorage` (tab-scoped, cleared on success) while an attempt is pending. HTTP 408, 425, 429, network failures, and 5xx responses retry with the same serialized body and key; numeric `Retry-After` headers are honored up to a ceiling (`maxRetryDelayMs`, default 30 seconds). A 409 conflict is surfaced as `MoreflowFormError` so the caller can decide how to recover.

If storage is unavailable or throws — including a caller-provided `StorageLike` — every helper degrades to a shared in-memory fallback that lives for the browser session, so tracking capture and submission never fail because of storage.

Payload fingerprints use SHA-256 when `crypto.subtle` is available and a deterministic djb2 fallback on insecure HTTP pages. Idempotency keys still require `crypto.getRandomValues`, which browsers provide on those pages.

The helper posts to `{baseUrl}/v1/forms/{formId}/submissions` and sends both the `Idempotency-Key` header and JSON `idempotencyKey` field. `baseUrl` defaults to `https://api.moreflow.io`, which a browser on an allowed domain calls without a token (see [Setup](#setup)); pass `baseUrl: ''` to post to your page's own origin behind a same-origin proxy. Server-side code that forwards submissions can pass `token` to send `Authorization: Bearer <token>` on every attempt, including a replay of a stored idempotent body; never pass a token from browser code. You can also pass `headers` for additional request headers; the helper always supplies the JSON content type and idempotency key. See the [API idempotency guide](https://api.moreflow.io/v1/operations/docs/guide#idempotency) for the server contract and recovery table.

## Error messages

Every helper throws `MoreflowFormError`. Its `FormErrorCode` includes `VALIDATION_ERROR`, `FORM_NOT_FOUND`, `ANTI_SPAM_INVALID` or `RATE_LIMIT` and the SDK's own codes (`NETWORK_ERROR`, `ABORTED`, `VALIDATION_ERROR`, `INVALID_RESPONSE`, `FETCH_UNAVAILABLE`, `REQUEST_FAILED`). A newer server may send a code not in the union.

`isMoreflowError(error)`, exported by this package, recognizes the shared `Symbol.for('moreflow.error')` brand across separately bundled `@moreflow/forms`, `@moreflow/chatbots`, `@moreflow/meetings` and `@moreflow/api`. Use it to narrow an unknown caught value to this common error shape:

| Field | Type | Meaning |
| --- | --- | --- |
| `code` | `string` | Stable failure code; branch on this, including newer server codes. |
| `message` | `string` | Developer explanation, using the server's message when available. |
| `status` | `number \| undefined` | HTTP status; `undefined` when no response arrived. |
| `retryable` | `boolean` | Whether the same request may succeed later: HTTP 408, 425, 429, 5xx, network failures or a server-declared retryable failure. Caller cancellation (`ABORTED`) is not retryable. |
| `recovery` | `{ operation, args?, requiredFields? } \| undefined` | The operation that resolves the failure, its known arguments and input still needed. |
| `details` | `Record<string, unknown>` | Structured server context; `{}` when absent. Operation `context` is merged into it. |
| `requestId` | `string \| undefined` | Server request id to quote when contacting support. |
| `responseBody` | `unknown` | Raw response body, unchanged. |

A `VALIDATION_ERROR` submission lists missing required fields in `details.missingFieldIds`; `missingFieldIdsFromError(error)` reads them.

`formErrorMessage(error, { language, formality, messages })` returns visitor-facing copy for the error's code in German ("Sie" by default, "du" with `formality: 'informal'`) or English, never the server's English developer message: every `FormErrorCode` has copy, `messages.errors` overrides it, and unknown codes fall back to a rate-limit, connection or generic text (or your `fallback`). Called with a string or nothing as the second argument, it keeps returning the raw server text, as before:

```ts
import {
  formErrorMessage,
  missingFieldIdsFromError,
  MoreflowFormError,
  validationMessage
} from '@moreflow/forms';

try {
  await submitWithRetry(/* ... */);
} catch (error) {
  const missing = missingFieldIdsFromError(error);
  if (missing.length > 0) {
    // The server rejected required fields the page did not validate: mark them.
    for (const id of missing) showFieldError(id, validationMessage({ code: 'REQUIRED' }, { language: 'de' }));
  } else if (error instanceof MoreflowFormError && error.code === 'ANTI_SPAM_INVALID') {
    turnstile.reset();
  } else {
    showToast(formErrorMessage(error, { language: 'de' }));
  }
}
```

### Server error codes

`getPublicForm` and `submitWithRetry` can receive these codes from the public form endpoints:

| `code` | Returned by | What it means | What to do |
| --- | --- | --- | --- |
| `ORIGIN_NOT_ALLOWED` | load, submit | The page's domain is not in the form's allowed domains. | Add the page's domain under **Embed → Websites** for the form (see [Setup](#setup)), then reload. |
| `FORM_NOT_FOUND` | load, submit | The form id is wrong, deleted, or belongs to another account. | Check the form id in the embed code. |
| `FORM_UNPUBLISHED` | load | The form has no published version. | Publish the form. |
| `FORM_RETIRED` | load | The account archived the form. | Remove the embed or point it to another form. |
| `INVALID_STATE` | load, submit | The form or its active version is not published. | Publish the form, then load the definition again. |
| `INVALID_SUBMISSION` | submit | The request body is not JSON or has no `data` object. | Send `input.data` as an object keyed by component id. |
| `VALIDATION_ERROR` | load, submit | An input failed the server's checks (for example a missing form id). | Fix the field named in `details`; run the validation helpers before submitting. |
| `ANTI_SPAM_REQUIRED` | submit | The form requires a Turnstile token and none was sent. | Mount Turnstile and send `spam.turnstileToken`. |
| `ANTI_SPAM_INVALID` | submit | Turnstile rejected the token (expired, replayed, or wrong site). | Call `turnstile.reset()` and submit again with the new token. |
| `SPAM_REJECTED` | submit | The honeypot field was filled. | Keep the honeypot field hidden and empty. |
| `IDEMPOTENCY_CONFLICT` | submit | The idempotency key was already used for a different payload. | Let `submitWithRetry` manage keys; don't reuse `formEntryId` or a custom key for changed data. |
| `RATE_LIMIT` | load, submit | Too many requests from this visitor or for this form. | `submitWithRetry` waits for `Retry-After` and retries; show a "try again later" message if it still fails. |

`retryable` is `true` for HTTP 408, 425, 429, 5xx, network failures, and failures the server marks retryable; every other code needs a change before sending again.

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

The helpers call the public `PUT`/`POST /v1/forms/{formId}/phone-verification` endpoints (no token needed; the endpoints are rate limited). `baseUrl` defaults to `https://api.moreflow.io` as in `submitWithRetry`, and `token`, `headers`, `fetchImpl`, `signal`, and `defaultCountry` work the same way. Both helpers normalize the input to E.164 first and reject invalid numbers locally as `MoreflowFormError` with code `INVALID_PHONE_NUMBER`, without contacting the server.

Failures are `MoreflowFormError` with the server's navigational code: `INVALID_VERIFICATION_CODE` means let the visitor retype the code; `VERIFICATION_PROOF_EXPIRED` and `VERIFICATION_PROOF_REPLAYED` mean start a new challenge with `sendPhoneVerification`; a 429 sets `retryable` with the usual `Retry-After` semantics. Neither helper retries on its own — every send is a real SMS — so offer an explicit "resend code" action instead of resending automatically. A challenge expires after roughly ten minutes and can be used once.

## Issues and contributing

Bug reports and feature requests are welcome in [this repository's issue tracker](https://github.com/moreflow-io/forms/issues). Development happens in the private Moreflow monorepo alongside the server contract this package mirrors; each released version is synced here, so the published source always matches the npm release.
