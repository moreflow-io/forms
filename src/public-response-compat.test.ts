import { describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/public-form-get-response.json';
import { getPublicForm, normalizePublicFormDefinition, type PublicFormDefinition } from './definition';
import { createMemoryStorage } from './index';
import { createFormSession } from './session';

/**
 * The public API answers GET /v1/forms/{formId} with every output key present
 * (null when absent, [] for an absent list). Embeds pinned to an earlier
 * release read the omitted-key shape; the null-filled response must behave
 * identically. The fixture is one real forms.public.get output before and
 * after the backend projection (guarded on the backend side).
 */
const FORM_ID = fixture.omitted.id;

/** Drop null-valued keys so pass-through maps (`raw`, `settings`) compare by content. */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== null).map(([key, entry]) => [key, withoutNulls(entry)])
    );
  }
  return value;
}

function typedFields(definition: PublicFormDefinition) {
  return {
    ...definition,
    settings: withoutNulls(definition.settings),
    pages: definition.pages.map((page) => ({
      ...page,
      raw: withoutNulls(page.raw),
      ...(page.type === 'regular'
        ? { components: page.components.map((component) => ({ ...component, raw: withoutNulls(component.raw) })) }
        : { content: page.content.map((item) => ({ ...item, raw: withoutNulls(item.raw) })) })
    }))
  };
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

async function runSession(response: unknown) {
  const requests: unknown[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).split('?')[0] ?? '';
    if ((init?.method ?? 'GET') === 'GET' && url.endsWith(`/v1/forms/${FORM_ID}`)) return json(response);
    if (init?.method === 'POST' && url.endsWith(`/v1/forms/${FORM_ID}/submissions`)) {
      requests.push(JSON.parse(String(init.body)));
      return json({ id: 'submission-1' });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const definition = await getPublicForm({ formId: FORM_ID, baseUrl: '', fetchImpl });
  const form = createFormSession(definition, { baseUrl: '', storage: createMemoryStorage(), fetchImpl });
  const initial = form.getSnapshot();
  const blocked = await form.next();
  const issues = form.getSnapshot().issues;
  form.setValue('email_field', 'erika@example.test');
  form.setValue('topic', 'MPU');
  form.setValue('choice', 'a');
  form.setValue('privacy', true);
  form.setHoneypot('');
  const submitted = await form.next();
  const final = form.getSnapshot();
  return {
    definition: typedFields(definition),
    labels: initial.labels,
    steps: initial.steps.map((step) => step.components.map((component) => component.id)),
    turnstile: initial.turnstile,
    honeypot: initial.honeypot,
    companyName: initial.companyName,
    language: initial.language,
    blocked,
    issues,
    submitted,
    status: final.status,
    thankYou: final.result?.thankYou?.content.map((item) => item.props),
    redirectUrl: final.result?.redirectUrl,
    requests: requests.map((request) => ({ ...(request as Record<string, unknown>), idempotencyKey: undefined }))
  };
}

describe('null-filled public form responses', () => {
  it('fills absent keys with null in the projected response', () => {
    expect(fixture.projected.version.pages[0]?.components[0]).toMatchObject({ placeholder: null, options: null, verifyPhone: null });
    expect(fixture.projected.version.settings).toMatchObject({ continueButtonText: null, thankYouPageUrl: null });
  });

  it('normalizes to the same definition as the omitted-key response', () => {
    const omitted = normalizePublicFormDefinition(fixture.omitted);
    const projected = normalizePublicFormDefinition(fixture.projected);
    expect(typedFields(projected)).toEqual(typedFields(omitted));
    expect(projected.settings.thankYouPageUrl).toBeUndefined();
    expect(projected.settings.continueButtonText).toBeUndefined();
  });

  it('drives a form session identically, from load through submission', async () => {
    const omitted = await runSession(fixture.omitted);
    const projected = await runSession(fixture.projected);
    expect(omitted.submitted).toBe(true);
    expect(projected).toEqual(omitted);
  });
});
