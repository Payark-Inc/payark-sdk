// ---------------------------------------------------------------------------
// PayArk SDK – Integration Tests
// ---------------------------------------------------------------------------
// Tests the SDK as a consumer would use it: creating a PayArk instance and
// calling resource methods end-to-end through the full call stack.
//
// These tests simulate realistic multi-step workflows and verify the SDK
// behaves correctly in production-like scenarios.
// ---------------------------------------------------------------------------

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { PayArk, PayArkError } from '../../src/index';
import type { CheckoutSession, PaginatedResponse, Payment } from '../../src/types';

describe('SDK Integration – End-to-End Workflows', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    function setupMockApi(handlers: Record<string, (method: string, body?: any) => Response>) {
        globalThis.fetch = mock((url: string | URL, opts: RequestInit) => {
            const urlStr = url.toString();
            const path = new URL(urlStr).pathname;
            const handler = handlers[path];

            if (handler) {
                return Promise.resolve(handler(opts.method ?? 'GET', opts.body ? JSON.parse(opts.body as string) : undefined));
            }

            return Promise.resolve(
                new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 }),
            );
        });
    }

    // ── Complete Payment Flow ────────────────────────────────────────────

    describe('complete payment flow', () => {
        test('should create checkout → retrieve payment → verify status', async () => {
            setupMockApi({
                '/v1/checkout': (method, body) => {
                    expect(method).toBe('POST');
                    expect(body.amount).toBe(1500);
                    expect(body.provider).toBe('esewa');

                    return new Response(
                        JSON.stringify({
                            id: 'pay_flow_123',
                            checkout_url: 'https://payark.com/checkout/pay_flow_123',
                            payment_method: {
                                type: 'esewa',
                                url: 'https://esewa.com.np/pay',
                                method: 'POST',
                                fields: { pid: 'pay_flow_123', amt: '1500' },
                            },
                        } satisfies CheckoutSession),
                        { status: 200 },
                    );
                },
                '/v1/payments/pay_flow_123': () => {
                    return new Response(
                        JSON.stringify({
                            id: 'pay_flow_123',
                            project_id: 'proj_test',
                            amount: 1500,
                            currency: 'NPR',
                            status: 'success',
                            provider_ref: 'esewa_ref_abc',
                            created_at: '2026-02-12T10:00:00Z',
                            updated_at: '2026-02-12T10:05:00Z',
                        } satisfies Payment),
                        { status: 200 },
                    );
                },
            });

            const payark = new PayArk({
                apiKey: 'sk_test_integration',
                baseUrl: 'https://mock.test',
                maxRetries: 0,
            });

            // Step 1: Create checkout session
            const session = await payark.checkout.create({
                amount: 1500,
                provider: 'esewa',
                returnUrl: 'https://example.com/done',
                metadata: { order_id: 'ORD-001' },
            });

            expect(session.id).toBe('pay_flow_123');
            expect(session.checkout_url).toContain('checkout');
            expect(session.payment_method.type).toBe('esewa');
            expect(session.payment_method.fields?.pid).toBe('pay_flow_123');

            // Step 2: After webhook, retrieve the payment
            const payment = await payark.payments.retrieve(session.id);

            expect(payment.id).toBe(session.id);
            expect(payment.status).toBe('success');
            expect(payment.provider_ref).toBe('esewa_ref_abc');
            expect(payment.amount).toBe(1500);
        });
    });

    // ── Pagination Flow ──────────────────────────────────────────────────

    describe('paginated listing', () => {
        test('should iterate through pages of payments', async () => {
            const allPayments = Array.from({ length: 25 }, (_, i) => ({
                id: `pay_${String(i).padStart(3, '0')}`,
                project_id: 'proj_1',
                amount: 100 * (i + 1),
                currency: 'NPR',
                status: 'success' as const,
                created_at: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
            }));

            globalThis.fetch = mock((url: string | URL) => {
                const parsedUrl = new URL(url.toString());
                const limit = parseInt(parsedUrl.searchParams.get('limit') ?? '10');
                const offset = parseInt(parsedUrl.searchParams.get('offset') ?? '0');
                const page = allPayments.slice(offset, offset + limit);

                return Promise.resolve(
                    new Response(
                        JSON.stringify({
                            data: page,
                            meta: { total: allPayments.length, limit, offset },
                        }),
                        { status: 200 },
                    ),
                );
            });

            const payark = new PayArk({
                apiKey: 'sk_test',
                baseUrl: 'https://mock.test',
                maxRetries: 0,
            });

            // Page 1
            const page1 = await payark.payments.list({ limit: 10, offset: 0 });
            expect(page1.data).toHaveLength(10);
            expect(page1.data[0].id).toBe('pay_000');
            expect(page1.meta.total).toBe(25);

            // Page 2
            const page2 = await payark.payments.list({ limit: 10, offset: 10 });
            expect(page2.data).toHaveLength(10);
            expect(page2.data[0].id).toBe('pay_010');

            // Page 3 (partial)
            const page3 = await payark.payments.list({ limit: 10, offset: 20 });
            expect(page3.data).toHaveLength(5);
            expect(page3.data[4].id).toBe('pay_024');
        });
    });

    // ── Error Recovery ───────────────────────────────────────────────────

    describe('error recovery', () => {
        test('should handle auth failure gracefully', async () => {
            globalThis.fetch = mock(() =>
                Promise.resolve(
                    new Response(
                        JSON.stringify({ error: 'Unauthorized: API key revoked' }),
                        { status: 401 },
                    ),
                ),
            );

            const payark = new PayArk({
                apiKey: 'sk_test_revoked',
                baseUrl: 'https://mock.test',
                maxRetries: 0,
            });

            try {
                await payark.payments.list();
                expect(true).toBe(false);
            } catch (err) {
                expect(err).toBeInstanceOf(PayArkError);
                const payarkErr = err as PayArkError;
                expect(payarkErr.code).toBe('authentication_error');
                expect(payarkErr.statusCode).toBe(401);
                expect(payarkErr.message).toContain('revoked');

                // Verify error is serialisable for logging
                const json = payarkErr.toJSON();
                expect(json.code).toBe('authentication_error');
            }
        });

        test('should handle validation errors with structured details', async () => {
            globalThis.fetch = mock(() =>
                Promise.resolve(
                    new Response(
                        JSON.stringify({
                            error: 'Validation failed',
                            details: {
                                amount: 'Must be a positive integer',
                                provider: 'Must be one of: esewa, khalti',
                            },
                        }),
                        { status: 400 },
                    ),
                ),
            );

            const payark = new PayArk({
                apiKey: 'sk_test',
                baseUrl: 'https://mock.test',
                maxRetries: 0,
            });

            try {
                await payark.checkout.create({
                    amount: -1,
                    provider: 'esewa',
                    returnUrl: 'https://example.com',
                });
                expect(true).toBe(false);
            } catch (err) {
                const payarkErr = err as PayArkError;
                expect(payarkErr.code).toBe('invalid_request_error');
                expect(payarkErr.raw?.details).toBeDefined();

                const details = payarkErr.raw?.details as Record<string, string>;
                expect(details.amount).toContain('positive');
                expect(details.provider).toContain('esewa');
            }
        });

        test('should recover from transient server errors via retry', async () => {
            let callCount = 0;

            globalThis.fetch = mock(() => {
                callCount++;
                if (callCount <= 2) {
                    return Promise.resolve(
                        new Response(JSON.stringify({ error: 'Service overloaded' }), { status: 503 }),
                    );
                }
                return Promise.resolve(
                    new Response(
                        JSON.stringify({
                            data: [],
                            meta: { total: 0, limit: 10, offset: 0 },
                        }),
                        { status: 200 },
                    ),
                );
            });

            const payark = new PayArk({
                apiKey: 'sk_test',
                baseUrl: 'https://mock.test',
                maxRetries: 3,
                timeout: 60_000,
            });

            const result = await payark.payments.list();
            expect(result.data).toEqual([]);
            expect(callCount).toBe(3); // 2 failures + 1 success
        });
    });

    // ── Khalti Provider ──────────────────────────────────────────────────

    describe('khalti provider', () => {
        test('should create checkout with khalti-specific response', async () => {
            globalThis.fetch = mock(() =>
                Promise.resolve(
                    new Response(
                        JSON.stringify({
                            id: 'pay_khalti_001',
                            checkout_url: 'https://payark.com/checkout/pay_khalti_001',
                            payment_method: {
                                type: 'khalti',
                                url: 'https://khalti.com/pay/pay_khalti_001',
                                method: 'GET',
                            },
                        }),
                        { status: 200 },
                    ),
                ),
            );

            const payark = new PayArk({
                apiKey: 'sk_test',
                baseUrl: 'https://mock.test',
                maxRetries: 0,
            });

            const session = await payark.checkout.create({
                amount: 2000,
                provider: 'khalti',
                returnUrl: 'https://example.com/thank-you',
            });

            expect(session.payment_method.type).toBe('khalti');
            expect(session.payment_method.method).toBe('GET');
        });
    });

    // ── Public Exports ───────────────────────────────────────────────────

    describe('public API surface', () => {
        test('should export PayArk class', () => {
            expect(PayArk).toBeDefined();
            expect(typeof PayArk).toBe('function');
        });

        test('should export PayArkError class', () => {
            expect(PayArkError).toBeDefined();
            expect(typeof PayArkError).toBe('function');
        });

        test('PayArkError should be catchable as instanceof', () => {
            const err = new PayArkError('test', 400, 'invalid_request_error');
            expect(err instanceof PayArkError).toBe(true);
            expect(err instanceof Error).toBe(true);
        });
    });
});
