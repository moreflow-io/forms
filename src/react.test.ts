// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from './index';
import { useMoreflowForm } from './react';

const formBody = {
  id: 'form-1',
  honeypotField: 'website',
  spamProtection: { turnstile: { siteKey: '', mode: 'off' } },
  companyName: 'MPU West',
  language: 'de',
  version: {
    id: 'version-1',
    formId: 'form-1',
    settings: {},
    pages: [
      { id: 'step-1', type: 'regular', components: [{ id: 'email', type: 'email', required: true }] }
    ]
  }
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('useMoreflowForm', () => {
  it('loads the form, exposes the session state and re-renders on changes', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'POST' ? json({ id: 'submission-1' }) : json(formBody)
    );
    const { result } = renderHook(() =>
      useMoreflowForm({ formId: 'form-1', baseUrl: '', fetchImpl, storage: createMemoryStorage() })
    );
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') throw new Error('Expected a ready form.');
    expect(result.current.state).toMatchObject({ language: 'de', companyName: 'MPU West' });
    expect(fetchImpl).toHaveBeenCalledWith('/v1/forms/form-1', expect.objectContaining({ method: 'GET' }));

    const session = result.current.session;
    act(() => session.setValue('email', 'erika@example.test'));
    expect(result.current.state?.values.email).toBe('erika@example.test');

    await act(async () => {
      await session.next();
    });
    expect(result.current.state?.status).toBe('submitted');
  });

  it('reports a localized load error', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ error: { code: 'FORM_NOT_FOUND', message: 'Public form was not found.' } }, 404)
    );
    const { result } = renderHook(() =>
      useMoreflowForm({ formId: 'form-1', baseUrl: '', fetchImpl, language: 'en' })
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatchObject({
      code: 'FORM_NOT_FOUND',
      message: 'This form was not found.'
    });
  });
});
