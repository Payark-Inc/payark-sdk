// ---------------------------------------------------------------------------
// PayArk SDK – HTTP Transport Unit Tests
// ---------------------------------------------------------------------------
// Tests the internal HTTP client including:
//   - Authentication headers
//   - Request construction (URL, body, query params)
//   - Retry logic with exponential back-off
//   - Idempotency key generation for POST
//   - Timeout handling
//   - Error parsing and classification
//   - Edge cases (empty bodies, non-JSON errors, 204 responses)
// ---------------------------------------------------------------------------

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { HttpClient } from '../../src/http';
import { PayArkError } from '../../src/errors';

// ── Helpers ────────────────────────────────────────────────────────────────

function mockResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

function emptyResponse(status: number): Response {
    return new Response(null, { status, statusText: 'No Content' });
}

function textResponse(text: string, status: number): Response {
    return new Response(text, {
        status,
        headers: { 'Content-Type': 'text/plain' },
    });
}

function createClient(
    overrides: Partial<{ apiKey: string; baseUrl: string; timeout: number; maxRetries: number }> = {},
): HttpClient {
    return new HttpClient({
        apiKey: overrides.apiKey ?? 'sk_test_key_12345',
        baseUrl: overrides.baseUrl ?? 'https://mock.payark.test',
        timeout: overrides.timeout ?? 5000,
        maxRetries: overrides.maxRetries ?? 0,
    });
}

/**
 * Safely assign a mock to `globalThis.fetch` without Bun's `preconnect` type error.
 * Bun extends the Fetch API with a non-standard `preconnect` method which causes
 * type mismatches with `mock()`. This helper avoids sprinkling `as any` everywhere.
 */
function setFetch(fn: (...args: any[]) => any): void {
    (globalThis as any).fetch = fn;
}

/** Read recorded mock calls from the mock fetch. */
function fetchMock(): { mock: { calls: any[][] } } {
    return globalThis.fetch as any;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('HttpClient', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    // ── Constructor ──────────────────────────────────────────────────────

    describe('constructor validation', () => {
        test('should throw PayArkError for empty string apiKey', () => {
            expect(() => createClient({ apiKey: '' })).toThrow(PayArkError);
        });

        test('should throw PayArkError for whitespace-only apiKey', () => {
            expect(() => createClient({ apiKey: '   ' })).toThrow(PayArkError);
        });

        test('should throw with authentication_error code', () => {
            try {
                createClient({ apiKey: '' });
            } catch (err) {
                expect((err as PayArkError).code).toBe('authentication_error');
            }
        });

        test('should accept valid apiKey', () => {
            const client = createClient({ apiKey: 'sk_test_valid' });
            expect(client).toBeDefined();
        });

        test('should trim whitespace from apiKey', async () => {
            const client = createClient({ apiKey: '  sk_test_spaced  ' });
            setFetch(mock(() => Promise.resolve(mockResponse({ ok: true }))));

            await client.request('GET', '/test');

            const [, opts] = fetchMock().mock.calls[0];
            expect(opts.headers.Authorization).toBe('Bearer sk_test_spaced');
        });

        test('should strip trailing slashes from baseUrl', async () => {
            const client = createClient({ baseUrl: 'https://api.test.com///' });
            setFetch(mock(() => Promise.resolve(mockResponse({ ok: true }))));

            await client.request('GET', '/v1/test');

            const url = fetchMock().mock.calls[0][0].toString();
            expect(url).toBe('https://api.test.com/v1/test');
        });

        test('should use default baseUrl when not provided', async () => {
            const client = new HttpClient({ apiKey: 'sk_test' });
            setFetch(mock(() => Promise.resolve(mockResponse({ ok: true }))));

            await client.request('GET', '/v1/test');

            const url = fetchMock().mock.calls[0][0].toString();
            expect(url).toStartWith('https://api.payark.com');
        });
    });

    // ── Request Construction ─────────────────────────────────────────────

    describe('request construction', () => {
        test('should send correct HTTP method', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('POST', '/v1/checkout', { body: {} });

            const [, opts] = fetchMock().mock.calls[0];
            expect(opts.method).toBe('POST');
        });

        test('should send Authorization header with Bearer token', async () => {
            const client = createClient({ apiKey: 'sk_live_secret_key' });
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/test');

            const headers = fetchMock().mock.calls[0][1].headers;
            expect(headers.Authorization).toBe('Bearer sk_live_secret_key');
        });

        test('should send Content-Type and Accept headers', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/test');

            const headers = fetchMock().mock.calls[0][1].headers;
            expect(headers['Content-Type']).toBe('application/json');
            expect(headers['Accept']).toBe('application/json');
        });

        test('should send User-Agent header with SDK version', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/test');

            const headers = fetchMock().mock.calls[0][1].headers;
            expect(headers['User-Agent']).toMatch(/^payark-sdk-node\//);
        });

        test('should merge custom headers', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/test', {
                headers: { 'X-Custom-Header': 'custom-value' },
            });

            const headers = fetchMock().mock.calls[0][1].headers;
            expect(headers['X-Custom-Header']).toBe('custom-value');
            expect(headers.Authorization).toBeDefined();
        });

        test('should allow custom headers to override defaults', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/test', {
                headers: { 'Content-Type': 'text/plain' },
            });

            const headers = fetchMock().mock.calls[0][1].headers;
            expect(headers['Content-Type']).toBe('text/plain');
        });
    });

    // ── URL & Query Params ───────────────────────────────────────────────

    describe('URL construction', () => {
        test('should construct correct URL from base + path', async () => {
            const client = createClient({ baseUrl: 'https://api.payark.com' });
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/payments');

            const url = fetchMock().mock.calls[0][0].toString();
            expect(url).toBe('https://api.payark.com/v1/payments');
        });

        test('should append query parameters to URL', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/payments', {
                query: { limit: 25, offset: 50 },
            });

            const url = new URL(fetchMock().mock.calls[0][0]);
            expect(url.searchParams.get('limit')).toBe('25');
            expect(url.searchParams.get('offset')).toBe('50');
        });

        test('should filter out undefined query params', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/payments', {
                query: { limit: 10, offset: undefined },
            });

            const url = new URL(fetchMock().mock.calls[0][0]);
            expect(url.searchParams.get('limit')).toBe('10');
            expect(url.searchParams.has('offset')).toBe(false);
        });

        test('should handle empty query params object', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/payments', { query: {} });

            const url = new URL(fetchMock().mock.calls[0][0]);
            expect(url.search).toBe('');
        });

        test('should convert number query params to strings', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/payments', {
                query: { limit: 100 },
            });

            const url = new URL(fetchMock().mock.calls[0][0]);
            expect(url.searchParams.get('limit')).toBe('100');
        });
    });

    // ── Request Body ─────────────────────────────────────────────────────

    describe('request body', () => {
        test('should JSON stringify the body for POST requests', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            const body = { amount: 500, provider: 'esewa' };
            await client.request('POST', '/v1/checkout', { body });

            const sentBody = JSON.parse(fetchMock().mock.calls[0][1].body);
            expect(sentBody.amount).toBe(500);
            expect(sentBody.provider).toBe('esewa');
        });

        test('should NOT include body for GET requests even if provided', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/payments', { body: { foo: 'bar' } });

            const sentBody = fetchMock().mock.calls[0][1].body;
            expect(sentBody).toBeUndefined();
        });

        test('should handle undefined body without crashing', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('POST', '/v1/checkout');

            const sentBody = fetchMock().mock.calls[0][1].body;
            expect(sentBody).toBeUndefined();
        });
    });

    // ── Idempotency Keys ────────────────────────────────────────────────

    describe('idempotency', () => {
        test('should include Idempotency-Key header for POST requests', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('POST', '/v1/checkout', { body: {} });

            const headers = fetchMock().mock.calls[0][1].headers;
            expect(headers['Idempotency-Key']).toBeDefined();
            expect(headers['Idempotency-Key'].length).toBeGreaterThan(0);
        });

        test('should include Idempotency-Key header for PUT requests', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('PUT', '/v1/test', { body: {} });

            const headers = fetchMock().mock.calls[0][1].headers;
            expect(headers['Idempotency-Key']).toBeDefined();
        });

        test('should include Idempotency-Key header for PATCH requests', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('PATCH', '/v1/test', { body: {} });

            const headers = fetchMock().mock.calls[0][1].headers;
            expect(headers['Idempotency-Key']).toBeDefined();
        });

        test('should NOT include Idempotency-Key for GET requests', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('GET', '/v1/payments');

            const headers = fetchMock().mock.calls[0][1].headers;
            expect(headers['Idempotency-Key']).toBeUndefined();
        });

        test('should NOT include Idempotency-Key for DELETE requests', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            await client.request('DELETE', '/v1/test');

            const headers = fetchMock().mock.calls[0][1].headers;
            expect(headers['Idempotency-Key']).toBeUndefined();
        });

        test('should generate unique Idempotency-Keys for different requests', async () => {
            const client = createClient();
            const keys: string[] = [];

            setFetch(
                mock((_: any, opts: any) => {
                    keys.push(opts.headers['Idempotency-Key']);
                    return Promise.resolve(mockResponse({}));
                }),
            );

            await client.request('POST', '/v1/checkout', { body: {} });
            await client.request('POST', '/v1/checkout', { body: {} });

            expect(keys[0]).not.toBe(keys[1]);
        });
    });

    // ── Response Parsing ─────────────────────────────────────────────────

    describe('response parsing', () => {
        test('should parse JSON response body', async () => {
            const client = createClient();
            const responseData = { id: 'pay_123', status: 'success' };
            setFetch(mock(() => Promise.resolve(mockResponse(responseData))));

            const result = await client.request<typeof responseData>('GET', '/test');

            expect(result.id).toBe('pay_123');
            expect(result.status).toBe('success');
        });

        test('should return empty object for 204 No Content', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(emptyResponse(204))));

            const result = await client.request('DELETE', '/test');

            expect(result).toEqual({});
        });

        test('should handle 200 with nested objects', async () => {
            const client = createClient();
            const responseData = {
                data: [{ id: 'pay_1' }, { id: 'pay_2' }],
                meta: { total: 2, limit: 10, offset: 0 },
            };
            setFetch(mock(() => Promise.resolve(mockResponse(responseData))));

            const result = await client.request<typeof responseData>('GET', '/test');

            expect(result.data).toHaveLength(2);
            expect(result.meta.total).toBe(2);
        });
    });

    // ── Error Handling ───────────────────────────────────────────────────

    describe('error handling', () => {
        test('should throw PayArkError with authentication_error on 401', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Unauthorized: Invalid API Key' }, 401))));

            try {
                await client.request('GET', '/test');
                expect(true).toBe(false);
            } catch (err) {
                expect(err).toBeInstanceOf(PayArkError);
                expect((err as PayArkError).code).toBe('authentication_error');
                expect((err as PayArkError).statusCode).toBe(401);
            }
        });

        test('should throw PayArkError with forbidden_error on 403', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Forbidden' }, 403))));

            try {
                await client.request('GET', '/test');
                expect(true).toBe(false);
            } catch (err) {
                expect((err as PayArkError).code).toBe('forbidden_error');
                expect((err as PayArkError).statusCode).toBe(403);
            }
        });

        test('should throw PayArkError with invalid_request_error on 400', async () => {
            const client = createClient();
            const errorBody = { error: 'Validation Error', details: { amount: 'Required' } };
            setFetch(mock(() => Promise.resolve(mockResponse(errorBody, 400))));

            try {
                await client.request('POST', '/test', { body: {} });
                expect(true).toBe(false);
            } catch (err) {
                expect((err as PayArkError).code).toBe('invalid_request_error');
                expect((err as PayArkError).raw?.details).toEqual({ amount: 'Required' });
            }
        });

        test('should throw PayArkError with invalid_request_error on 422', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Unprocessable Entity' }, 422))));

            try {
                await client.request('POST', '/test', { body: {} });
                expect(true).toBe(false);
            } catch (err) {
                expect((err as PayArkError).code).toBe('invalid_request_error');
                expect((err as PayArkError).statusCode).toBe(422);
            }
        });

        test('should throw PayArkError with not_found_error on 404', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Payment not found' }, 404))));

            try {
                await client.request('GET', '/test');
                expect(true).toBe(false);
            } catch (err) {
                expect((err as PayArkError).code).toBe('not_found_error');
            }
        });

        test('should throw PayArkError with rate_limit_error on 429', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Too many requests' }, 429))));

            try {
                await client.request('GET', '/test');
                expect(true).toBe(false);
            } catch (err) {
                expect((err as PayArkError).code).toBe('rate_limit_error');
                expect((err as PayArkError).statusCode).toBe(429);
            }
        });

        test('should handle non-JSON error response body gracefully', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.resolve(textResponse('Internal Server Error', 500))));

            try {
                await client.request('GET', '/test');
                expect(true).toBe(false);
            } catch (err) {
                expect(err).toBeInstanceOf(PayArkError);
                expect((err as PayArkError).code).toBe('api_error');
                expect((err as PayArkError).message).toContain('500');
            }
        });

        test('should throw network_error on DNS/connection failure', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.reject(new Error('ECONNREFUSED'))));

            try {
                await client.request('GET', '/test');
                expect(true).toBe(false);
            } catch (err) {
                expect((err as PayArkError).code).toBe('network_error');
                expect((err as PayArkError).statusCode).toBe(0);
                expect((err as PayArkError).message).toContain('ECONNREFUSED');
            }
        });

        test('should throw network_error on TypeError (fetch not available)', async () => {
            const client = createClient();
            setFetch(mock(() => Promise.reject(new TypeError('fetch is not a function'))));

            try {
                await client.request('GET', '/test');
                expect(true).toBe(false);
            } catch (err) {
                expect((err as PayArkError).code).toBe('network_error');
            }
        });

        test('should preserve raw error body for programmatic access', async () => {
            const client = createClient();
            const rawBody = {
                error: 'Validation Error',
                details: {
                    amount: { _errors: ['Amount must be positive'] },
                    provider: { _errors: ['Invalid provider'] },
                },
            };
            setFetch(mock(() => Promise.resolve(mockResponse(rawBody, 400))));

            try {
                await client.request('POST', '/test', { body: {} });
            } catch (err) {
                expect((err as PayArkError).raw).toEqual(rawBody);
                expect((err as PayArkError).raw?.error).toBe('Validation Error');
            }
        });
    });

    // ── Retry Logic ──────────────────────────────────────────────────────

    describe('retry behaviour', () => {
        test('should NOT retry on 4xx client errors', async () => {
            const client = createClient({ maxRetries: 3 });
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Bad Request' }, 400))));

            try {
                await client.request('GET', '/test');
            } catch {
                // Expected
            }

            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        test('should NOT retry on 401', async () => {
            const client = createClient({ maxRetries: 3 });
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Unauthorized' }, 401))));

            try {
                await client.request('GET', '/test');
            } catch {
                // Expected
            }

            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        test('should NOT retry on 404', async () => {
            const client = createClient({ maxRetries: 2 });
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Not Found' }, 404))));

            try {
                await client.request('GET', '/test');
            } catch {
                // Expected
            }

            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        test('should retry on 429 Too Many Requests', async () => {
            const client = createClient({ maxRetries: 1 });
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Too Many Requests' }, 429))));

            try {
                await client.request('GET', '/test');
            } catch {
                // Expected
            }

            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        test('should respect Retry-After header (seconds)', async () => {
            const client = createClient({ maxRetries: 1 });
            const timestamps: number[] = [];

            setFetch(mock(() => {
                timestamps.push(Date.now());
                return Promise.resolve(mockResponse({ error: 'Slow down' }, 429, { 'Retry-After': '1' }));
            }));

            try {
                await client.request('GET', '/test');
            } catch {
                // Expected
            }

            expect(timestamps.length).toBe(2);
            const delay = timestamps[1] - timestamps[0];
            expect(delay).toBeGreaterThanOrEqual(1000);
        });

        test('should retry on 500 server error up to maxRetries', async () => {
            const client = createClient({ maxRetries: 2, timeout: 60_000 });
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Internal Server Error' }, 500))));

            try {
                await client.request('GET', '/test');
            } catch {
                // Expected
            }

            // 1 initial + 2 retries = 3 total calls
            expect(globalThis.fetch).toHaveBeenCalledTimes(3);
        });

        test('should retry on 502 Bad Gateway', async () => {
            const client = createClient({ maxRetries: 1, timeout: 60_000 });
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Bad Gateway' }, 502))));

            try {
                await client.request('GET', '/test');
            } catch {
                // Expected
            }

            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        test('should retry on 503 Service Unavailable', async () => {
            const client = createClient({ maxRetries: 1, timeout: 60_000 });
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Service Unavailable' }, 503))));

            try {
                await client.request('GET', '/test');
            } catch {
                // Expected
            }

            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        test('should retry on network errors', async () => {
            const client = createClient({ maxRetries: 1, timeout: 60_000 });
            setFetch(mock(() => Promise.reject(new Error('ECONNRESET'))));

            try {
                await client.request('GET', '/test');
            } catch {
                // Expected
            }

            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        test('should stop retrying after success', async () => {
            const client = createClient({ maxRetries: 3, timeout: 60_000 });
            let callCount = 0;

            setFetch(
                mock(() => {
                    callCount++;
                    if (callCount === 1) {
                        return Promise.resolve(mockResponse({ error: 'Server Error' }, 500));
                    }
                    return Promise.resolve(mockResponse({ id: 'recovered' }));
                }),
            );

            const result = await client.request<{ id: string }>('GET', '/test');

            expect(result.id).toBe('recovered');
            expect(callCount).toBe(2);
        });

        test('should throw the LAST error after all retries are exhausted', async () => {
            const client = createClient({ maxRetries: 1, timeout: 60_000 });
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Server is on fire' }, 503))));

            try {
                await client.request('GET', '/test');
                expect(true).toBe(false);
            } catch (err) {
                expect(err).toBeInstanceOf(PayArkError);
                expect((err as PayArkError).code).toBe('api_error');
                expect((err as PayArkError).message).toBe('Server is on fire');
            }
        });

        test('should use maxRetries=0 to disable retrying', async () => {
            const client = createClient({ maxRetries: 0 });
            setFetch(mock(() => Promise.resolve(mockResponse({ error: 'Error' }, 500))));

            try {
                await client.request('GET', '/test');
            } catch {
                // Expected
            }

            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        test('should reuse same idempotency key across retries for POST', async () => {
            const client = createClient({ maxRetries: 1, timeout: 60_000 });
            const keys: string[] = [];

            setFetch(
                mock((_: any, opts: any) => {
                    keys.push(opts.headers['Idempotency-Key']);
                    return Promise.resolve(mockResponse({ error: 'Error' }, 500));
                }),
            );

            try {
                await client.request('POST', '/test', { body: {} });
            } catch {
                // Expected
            }

            // Both attempts should use the SAME idempotency key
            expect(keys).toHaveLength(2);
            expect(keys[0]).toBe(keys[1]);
        });
    });

    // ── Timeout ──────────────────────────────────────────────────────────

    describe('timeout', () => {
        test('should use AbortController signal in fetch', async () => {
            const client = createClient({ timeout: 1000 });
            let receivedSignal: AbortSignal | undefined;

            setFetch(
                mock((_: any, opts: any) => {
                    receivedSignal = opts.signal;
                    return Promise.resolve(mockResponse({}));
                }),
            );

            await client.request('GET', '/test');

            expect(receivedSignal).toBeDefined();
            expect(receivedSignal).toBeInstanceOf(AbortSignal);
        });

        test('should allow per-request timeout override', async () => {
            const client = createClient({ timeout: 30_000 });
            setFetch(mock(() => Promise.resolve(mockResponse({}))));

            const result = await client.request('GET', '/test', { timeout: 1000 });
            expect(result).toEqual({});
        });
    });
});
