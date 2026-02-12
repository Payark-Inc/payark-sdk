// ---------------------------------------------------------------------------
// PayArk SDK – Client Unit Tests
// ---------------------------------------------------------------------------
// Tests the main PayArk client class including:
//   - Constructor validation and config handling
//   - Lazy resource initialisation and caching
//   - Resource accessor behaviour
//   - String shorthand support
// ---------------------------------------------------------------------------

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { PayArk } from '../../src/client';
import { PayArkError } from '../../src/errors';

/**
 * Safely assign a mock to `globalThis.fetch` without Bun's `preconnect` type error.
 */
function setFetch(fn: (...args: any[]) => any): void {
    (globalThis as any).fetch = fn;
}

/** Read recorded mock calls from the mock fetch. */
function fetchMock(): { mock: { calls: any[][] } } {
    return globalThis.fetch as any;
}

describe('PayArk Client', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    // ── Constructor ──────────────────────────────────────────────────────

    describe('constructor', () => {
        test('should create client with valid config object', () => {
            const client = new PayArk({ apiKey: 'sk_test_valid' });
            expect(client).toBeDefined();
        });

        test('should throw PayArkError when apiKey is empty', () => {
            expect(() => new PayArk({ apiKey: '' })).toThrow(PayArkError);
        });

        test('should throw PayArkError when apiKey is whitespace', () => {
            expect(() => new PayArk({ apiKey: '   \t\n' })).toThrow(PayArkError);
        });

        test('should accept all optional config overrides', () => {
            const client = new PayArk({
                apiKey: 'sk_test_full_config',
                baseUrl: 'http://localhost:3001',
                timeout: 5_000,
                maxRetries: 0,
            });
            expect(client).toBeDefined();
        });
    });

    // ── Resource Accessors ───────────────────────────────────────────────

    describe('resource accessors', () => {
        test('should expose checkout resource', () => {
            const client = new PayArk({ apiKey: 'sk_test' });
            expect(client.checkout).toBeDefined();
        });

        test('should expose payments resource', () => {
            const client = new PayArk({ apiKey: 'sk_test' });
            expect(client.payments).toBeDefined();
        });

        test('should return the SAME checkout instance on repeated access (lazy singleton)', () => {
            const client = new PayArk({ apiKey: 'sk_test' });
            const first = client.checkout;
            const second = client.checkout;
            expect(first).toBe(second);
        });

        test('should return the SAME payments instance on repeated access (lazy singleton)', () => {
            const client = new PayArk({ apiKey: 'sk_test' });
            const first = client.payments;
            const second = client.payments;
            expect(first).toBe(second);
        });

        test('checkout and payments should be different resource types', () => {
            const client = new PayArk({ apiKey: 'sk_test' });
            expect(client.checkout).not.toBe(client.payments as any);
        });
    });

    // ── Checkout Resource Methods ────────────────────────────────────────

    describe('checkout.create', () => {
        function mockResponse(body: unknown): Response {
            return new Response(JSON.stringify(body), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        test('should POST to /v1/checkout with correct body', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({
                            id: 'pay_abc',
                            checkout_url: 'https://payark.com/checkout/pay_abc',
                            payment_method: { type: 'esewa' },
                        }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            const session = await client.checkout.create({
                amount: 500,
                provider: 'esewa',
                returnUrl: 'https://example.com/return',
            });

            expect(session.id).toBe('pay_abc');
            expect(session.checkout_url).toBe('https://payark.com/checkout/pay_abc');
            expect(session.payment_method.type).toBe('esewa');

            const [url, opts] = fetchMock().mock.calls[0];
            expect(url.toString()).toContain('/v1/checkout');
            expect(opts.method).toBe('POST');
        });

        test('should default currency to NPR', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({ id: 'p', checkout_url: 'u', payment_method: { type: 'esewa' } }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            await client.checkout.create({
                amount: 100,
                provider: 'esewa',
                returnUrl: 'https://example.com',
            });

            const body = JSON.parse(fetchMock().mock.calls[0][1].body);
            expect(body.currency).toBe('NPR');
        });

        test('should allow custom currency override', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({ id: 'p', checkout_url: 'u', payment_method: { type: 'khalti' } }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            await client.checkout.create({
                amount: 100,
                provider: 'khalti',
                currency: 'USD',
                returnUrl: 'https://example.com',
            });

            const body = JSON.parse(fetchMock().mock.calls[0][1].body);
            expect(body.currency).toBe('USD');
        });

        test('should pass metadata to the API', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({ id: 'p', checkout_url: 'u', payment_method: { type: 'esewa' } }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            await client.checkout.create({
                amount: 1000,
                provider: 'esewa',
                returnUrl: 'https://example.com',
                metadata: { order_id: 'ORD-42', user_email: 'user@test.com' },
            });

            const body = JSON.parse(fetchMock().mock.calls[0][1].body);
            expect(body.metadata.order_id).toBe('ORD-42');
            expect(body.metadata.user_email).toBe('user@test.com');
        });

        test('should pass cancelUrl when provided', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({ id: 'p', checkout_url: 'u', payment_method: { type: 'khalti' } }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            await client.checkout.create({
                amount: 200,
                provider: 'khalti',
                returnUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel',
            });

            const body = JSON.parse(fetchMock().mock.calls[0][1].body);
            expect(body.cancelUrl).toBe('https://example.com/cancel');
        });

        test('should NOT include cancelUrl when not provided', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({ id: 'p', checkout_url: 'u', payment_method: { type: 'esewa' } }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            await client.checkout.create({
                amount: 100,
                provider: 'esewa',
                returnUrl: 'https://example.com',
            });

            const body = JSON.parse(fetchMock().mock.calls[0][1].body);
            expect(body.cancelUrl).toBeUndefined();
        });

        test('should propagate PayArkError from API failure', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400 }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });

            try {
                await client.checkout.create({
                    amount: -1,
                    provider: 'esewa',
                    returnUrl: 'https://example.com',
                });
                expect(true).toBe(false);
            } catch (err) {
                expect(err).toBeInstanceOf(PayArkError);
                expect((err as PayArkError).code).toBe('invalid_request_error');
            }
        });
    });

    // ── Payments Resource Methods ────────────────────────────────────────

    describe('payments.list', () => {
        function mockResponse(body: unknown): Response {
            return new Response(JSON.stringify(body), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        test('should GET /v1/payments', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({
                            data: [{ id: 'pay_1', amount: 500, status: 'success' }],
                            meta: { total: 1, limit: 10, offset: 0 },
                        }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            const result = await client.payments.list();

            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('pay_1');
            expect(result.meta.total).toBe(1);
        });

        test('should pass limit and offset as query params', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({ data: [], meta: { total: 0, limit: 5, offset: 20 } }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            await client.payments.list({ limit: 5, offset: 20 });

            const url = new URL(fetchMock().mock.calls[0][0]);
            expect(url.searchParams.get('limit')).toBe('5');
            expect(url.searchParams.get('offset')).toBe('20');
        });

        test('should work with no arguments (empty params)', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({ data: [], meta: { total: 0, limit: 10, offset: 0 } }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            const result = await client.payments.list();

            expect(result.data).toHaveLength(0);
        });

        test('should handle empty result set', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({ data: [], meta: { total: 0, limit: 10, offset: 0 } }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            const result = await client.payments.list();

            expect(result.data).toEqual([]);
            expect(result.meta.total).toBe(0);
        });

        test('should handle large result sets', async () => {
            const payments = Array.from({ length: 100 }, (_, i) => ({
                id: `pay_${i}`,
                project_id: 'proj_1',
                amount: 100 * (i + 1),
                currency: 'NPR',
                status: 'success',
                created_at: '2026-01-01T00:00:00Z',
            }));

            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({ data: payments, meta: { total: 500, limit: 100, offset: 0 } }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            const result = await client.payments.list({ limit: 100 });

            expect(result.data).toHaveLength(100);
            expect(result.meta.total).toBe(500);
        });
    });

    describe('payments.retrieve', () => {
        function mockResponse(body: unknown): Response {
            return new Response(JSON.stringify(body), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        test('should GET /v1/payments/:id', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({
                            id: 'pay_xyz',
                            project_id: 'proj_1',
                            amount: 1000,
                            currency: 'NPR',
                            status: 'pending',
                            created_at: '2026-01-01T00:00:00Z',
                        }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            const payment = await client.payments.retrieve('pay_xyz');

            expect(payment.id).toBe('pay_xyz');
            expect(payment.status).toBe('pending');
        });

        test('should URL-encode the payment ID', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({ id: 'pay/special', amount: 100, status: 'success', created_at: '' }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            await client.payments.retrieve('pay/special');

            const url = fetchMock().mock.calls[0][0].toString();
            expect(url).toContain('pay%2Fspecial');
            expect(url).not.toContain('pay/special');
        });

        test('should throw not_found_error on 404', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404 }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });

            try {
                await client.payments.retrieve('pay_nonexistent');
                expect(true).toBe(false);
            } catch (err) {
                expect((err as PayArkError).code).toBe('not_found_error');
                expect((err as PayArkError).statusCode).toBe(404);
            }
        });

        test('should return full payment object with optional fields', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({
                            id: 'pay_full',
                            project_id: 'proj_1',
                            amount: 2500,
                            currency: 'NPR',
                            status: 'success',
                            provider_ref: 'esewa_ref_123',
                            metadata_json: { order_id: 'ORD-99' },
                            gateway_response: { status: 'COMPLETE' },
                            created_at: '2026-01-15T10:30:00Z',
                            updated_at: '2026-01-15T10:35:00Z',
                        }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            const payment = await client.payments.retrieve('pay_full');

            expect(payment.provider_ref).toBe('esewa_ref_123');
            expect(payment.metadata_json).toEqual({ order_id: 'ORD-99' });
            expect(payment.gateway_response).toEqual({ status: 'COMPLETE' });
            expect(payment.updated_at).toBe('2026-01-15T10:35:00Z');
        });

        test('should handle nullable optional fields', async () => {
            setFetch(
                mock(() =>
                    Promise.resolve(
                        mockResponse({
                            id: 'pay_null',
                            project_id: 'proj_1',
                            amount: 100,
                            currency: 'NPR',
                            status: 'pending',
                            provider_ref: null,
                            metadata_json: null,
                            gateway_response: null,
                            created_at: '2026-01-01T00:00:00Z',
                        }),
                    ),
                ),
            );

            const client = new PayArk({ apiKey: 'sk_test', baseUrl: 'https://mock.test', maxRetries: 0 });
            const payment = await client.payments.retrieve('pay_null');

            expect(payment.provider_ref).toBeNull();
            expect(payment.metadata_json).toBeNull();
            expect(payment.gateway_response).toBeNull();
        });
    });

    // ── Cross-Cutting Concerns ──────────────────────────────────────────

    describe('cross-cutting', () => {
        test('should use same API key across all resource calls', async () => {
            const apiKeys: string[] = [];

            setFetch(
                mock((_: any, opts: any) => {
                    apiKeys.push(opts.headers.Authorization);
                    return Promise.resolve(
                        new Response(JSON.stringify({ data: [], meta: { total: 0, limit: 10, offset: 0 } }), {
                            status: 200,
                        }),
                    );
                }),
            );

            const client = new PayArk({
                apiKey: 'sk_live_consistent_key',
                baseUrl: 'https://mock.test',
                maxRetries: 0,
            });

            await client.payments.list();
            await client.payments.list();

            expect(apiKeys[0]).toBe('Bearer sk_live_consistent_key');
            expect(apiKeys[1]).toBe('Bearer sk_live_consistent_key');
        });

        test('independent clients should have independent configs', async () => {
            const urls: string[] = [];

            setFetch(
                mock((url: any) => {
                    urls.push(url.toString());
                    return Promise.resolve(
                        new Response(JSON.stringify({ data: [], meta: { total: 0, limit: 10, offset: 0 } }), {
                            status: 200,
                        }),
                    );
                }),
            );

            const client1 = new PayArk({ apiKey: 'sk_1', baseUrl: 'https://api1.test', maxRetries: 0 });
            const client2 = new PayArk({ apiKey: 'sk_2', baseUrl: 'https://api2.test', maxRetries: 0 });

            await client1.payments.list();
            await client2.payments.list();

            expect(urls[0]).toContain('api1.test');
            expect(urls[1]).toContain('api2.test');
        });
    });
});
