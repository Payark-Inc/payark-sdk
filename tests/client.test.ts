// ---------------------------------------------------------------------------
// PayArk SDK – Unit Tests
// ---------------------------------------------------------------------------
// Tests the SDK client, HTTP transport, and error handling.
// Uses Bun's built-in test runner + a minimal mock server approach.
// ---------------------------------------------------------------------------

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { PayArk } from '../src/client';
import { PayArkError } from '../src/errors';
import type { CheckoutSession, PaginatedResponse, Payment } from '../src/types';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Create a mock Response object. */
function mockResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/** Standard test client pointing to a fake base URL. */
function createTestClient(): PayArk {
    return new PayArk({
        apiKey: 'sk_test_mock_key_12345',
        baseUrl: 'https://mock.payark.test',
        maxRetries: 0, // Disable retries for predictable tests
        timeout: 5000,
    });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PayArk SDK', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        // Restore original fetch after each test
        globalThis.fetch = originalFetch;
    });

    // ── Constructor ────────────────────────────────────────────────────────
    describe('constructor', () => {
        test('throws if apiKey is missing', () => {
            expect(() => new PayArk({ apiKey: '' })).toThrow(PayArkError);
        });

        test('creates client with valid config', () => {
            const client = createTestClient();
            expect(client).toBeDefined();
            expect(client.checkout).toBeDefined();
            expect(client.payments).toBeDefined();
        });

        test('resources are lazy-initialised (same instance)', () => {
            const client = createTestClient();
            const c1 = client.checkout;
            const c2 = client.checkout;
            expect(c1).toBe(c2); // Same reference
        });
    });

    // ── Checkout ───────────────────────────────────────────────────────────
    describe('checkout.create', () => {
        test('sends correct POST request and returns session', async () => {
            const mockSession: CheckoutSession = {
                id: 'pay_test_123',
                checkout_url: 'https://payark.com/checkout/pay_test_123',
                payment_method: { type: 'esewa', url: 'https://esewa.com.np', method: 'POST' },
            };

            globalThis.fetch = mock(() => Promise.resolve(mockResponse(mockSession)));

            const client = createTestClient();
            const session = await client.checkout.create({
                amount: 500,
                provider: 'esewa',
                returnUrl: 'https://example.com/return',
            });

            expect(session.id).toBe('pay_test_123');
            expect(session.checkout_url).toContain('checkout');
            expect(session.payment_method.type).toBe('esewa');

            // Verify fetch was called with correct args
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            const [url, opts] = (globalThis.fetch as any).mock.calls[0];
            expect(url.toString()).toBe('https://mock.payark.test/v1/checkout');
            expect(opts.method).toBe('POST');
            expect(opts.headers.Authorization).toBe('Bearer sk_test_mock_key_12345');
        });

        test('includes currency default of NPR', async () => {
            globalThis.fetch = mock(() =>
                Promise.resolve(mockResponse({ id: 'p', checkout_url: 'u', payment_method: { type: 'esewa' } })),
            );

            const client = createTestClient();
            await client.checkout.create({
                amount: 100,
                provider: 'esewa',
                returnUrl: 'https://example.com',
            });

            const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
            expect(body.currency).toBe('NPR');
        });

        test('passes metadata and optional fields', async () => {
            globalThis.fetch = mock(() =>
                Promise.resolve(mockResponse({ id: 'p', checkout_url: 'u', payment_method: { type: 'khalti' } })),
            );

            const client = createTestClient();
            await client.checkout.create({
                amount: 1000,
                provider: 'khalti',
                currency: 'NPR',
                returnUrl: 'https://example.com/return',
                cancelUrl: 'https://example.com/cancel',
                metadata: { order_id: 'ORD-42' },
            });

            const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
            expect(body.cancelUrl).toBe('https://example.com/cancel');
            expect(body.metadata.order_id).toBe('ORD-42');
        });
    });

    // ── Payments ───────────────────────────────────────────────────────────
    describe('payments.list', () => {
        test('sends GET with default pagination', async () => {
            const mockPayments: PaginatedResponse<Payment> = {
                data: [
                    {
                        id: 'pay_1',
                        project_id: 'proj_1',
                        amount: 500,
                        currency: 'NPR',
                        status: 'success',
                        created_at: '2026-01-01T00:00:00Z',
                    },
                ],
                meta: { total: 1, limit: 10, offset: 0 },
            };

            globalThis.fetch = mock(() => Promise.resolve(mockResponse(mockPayments)));

            const client = createTestClient();
            const result = await client.payments.list();

            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('pay_1');
            expect(result.meta.total).toBe(1);
        });

        test('forwards limit and offset as query params', async () => {
            globalThis.fetch = mock(() =>
                Promise.resolve(mockResponse({ data: [], meta: { total: 0, limit: 5, offset: 10 } })),
            );

            const client = createTestClient();
            await client.payments.list({ limit: 5, offset: 10 });

            const url = new URL((globalThis.fetch as any).mock.calls[0][0]);
            expect(url.searchParams.get('limit')).toBe('5');
            expect(url.searchParams.get('offset')).toBe('10');
        });
    });

    describe('payments.retrieve', () => {
        test('fetches a single payment by ID', async () => {
            const mockPayment: Payment = {
                id: 'pay_xyz',
                project_id: 'proj_1',
                amount: 1000,
                currency: 'NPR',
                status: 'pending',
                created_at: '2026-02-01T12:00:00Z',
            };

            globalThis.fetch = mock(() => Promise.resolve(mockResponse(mockPayment)));

            const client = createTestClient();
            const payment = await client.payments.retrieve('pay_xyz');

            expect(payment.id).toBe('pay_xyz');
            expect(payment.status).toBe('pending');
            expect((globalThis.fetch as any).mock.calls[0][0].toString()).toContain('/v1/payments/pay_xyz');
        });
    });

    // ── Error Handling ─────────────────────────────────────────────────────
    describe('error handling', () => {
        test('throws PayArkError with authentication_error on 401', async () => {
            globalThis.fetch = mock(() =>
                Promise.resolve(mockResponse({ error: 'Unauthorized: Invalid API Key' }, 401)),
            );

            const client = createTestClient();

            try {
                await client.checkout.create({
                    amount: 100,
                    provider: 'esewa',
                    returnUrl: 'https://x.com',
                });
                expect(true).toBe(false); // Should not reach here
            } catch (err) {
                expect(err).toBeInstanceOf(PayArkError);
                const payarkErr = err as PayArkError;
                expect(payarkErr.code).toBe('authentication_error');
                expect(payarkErr.statusCode).toBe(401);
                expect(payarkErr.message).toContain('Unauthorized');
            }
        });

        test('throws PayArkError with invalid_request_error on 400', async () => {
            globalThis.fetch = mock(() =>
                Promise.resolve(
                    mockResponse({ error: 'Validation Error', details: { amount: 'Required' } }, 400),
                ),
            );

            const client = createTestClient();

            try {
                await client.payments.list();
                expect(true).toBe(false);
            } catch (err) {
                const payarkErr = err as PayArkError;
                expect(payarkErr.code).toBe('invalid_request_error');
                expect(payarkErr.statusCode).toBe(400);
                expect(payarkErr.raw?.details).toBeDefined();
            }
        });

        test('throws network_error on fetch failure', async () => {
            globalThis.fetch = mock(() => Promise.reject(new Error('DNS resolution failed')));

            const client = createTestClient();

            try {
                await client.payments.list();
                expect(true).toBe(false);
            } catch (err) {
                const payarkErr = err as PayArkError;
                expect(payarkErr.code).toBe('network_error');
                expect(payarkErr.statusCode).toBe(0);
                expect(payarkErr.message).toContain('DNS resolution failed');
            }
        });
    });
});
