// ---------------------------------------------------------------------------
// PayArk SDK – Error Module Unit Tests
// ---------------------------------------------------------------------------
// Tests PayArkError construction, serialisation, instanceof behaviour,
// and the errorCodeFromStatus mapping function.
// ---------------------------------------------------------------------------

import { describe, test, expect } from 'bun:test';
import { PayArkError, errorCodeFromStatus } from '../../src/errors';
import type { PayArkErrorCode } from '../../src/errors';

describe('PayArkError', () => {
    // ── Construction ─────────────────────────────────────────────────────

    describe('constructor', () => {
        test('should set all properties correctly', () => {
            const raw = { error: 'test error', details: { field: 'amount' } };
            const err = new PayArkError('Test message', 400, 'invalid_request_error', raw);

            expect(err.message).toBe('Test message');
            expect(err.statusCode).toBe(400);
            expect(err.code).toBe('invalid_request_error');
            expect(err.raw).toEqual(raw);
            expect(err.name).toBe('PayArkError');
        });

        test('should work without raw body (optional param)', () => {
            const err = new PayArkError('No body', 500, 'api_error');

            expect(err.raw).toBeUndefined();
            expect(err.statusCode).toBe(500);
        });

        test('should set statusCode to 0 for network errors', () => {
            const err = new PayArkError('DNS failed', 0, 'network_error');

            expect(err.statusCode).toBe(0);
            expect(err.code).toBe('network_error');
        });

        test('should have a proper stack trace', () => {
            const err = new PayArkError('Stack test', 500, 'api_error');

            expect(err.stack).toBeDefined();
            expect(err.stack).toContain('Stack test');
        });
    });

    // ── instanceof ───────────────────────────────────────────────────────

    describe('instanceof', () => {
        test('should be an instance of PayArkError', () => {
            const err = new PayArkError('test', 400, 'invalid_request_error');
            expect(err).toBeInstanceOf(PayArkError);
        });

        test('should be an instance of Error', () => {
            const err = new PayArkError('test', 400, 'invalid_request_error');
            expect(err).toBeInstanceOf(Error);
        });

        test('should work correctly after Object.setPrototypeOf', () => {
            // This specifically tests the cross-realm instanceof fix
            const err = new PayArkError('cross-realm', 401, 'authentication_error');
            const isPayArkError = err instanceof PayArkError;
            const isError = err instanceof Error;

            expect(isPayArkError).toBe(true);
            expect(isError).toBe(true);
        });
    });

    // ── Serialisation ────────────────────────────────────────────────────

    describe('toString', () => {
        test('should include code, message, and HTTP status', () => {
            const err = new PayArkError('Unauthorized', 401, 'authentication_error');
            const str = err.toString();

            expect(str).toContain('PayArkError');
            expect(str).toContain('authentication_error');
            expect(str).toContain('Unauthorized');
            expect(str).toContain('401');
        });

        test('should show HTTP 0 for network errors', () => {
            const err = new PayArkError('Timeout', 0, 'network_error');

            expect(err.toString()).toContain('HTTP 0');
        });
    });

    describe('toJSON', () => {
        test('should return a serialisable plain object', () => {
            const raw = { error: 'Bad request' };
            const err = new PayArkError('Bad request', 400, 'invalid_request_error', raw);
            const json = err.toJSON();

            expect(json.name).toBe('PayArkError');
            expect(json.message).toBe('Bad request');
            expect(json.code).toBe('invalid_request_error');
            expect(json.statusCode).toBe(400);
            expect(json.raw).toEqual(raw);
        });

        test('should produce valid JSON via JSON.stringify', () => {
            const err = new PayArkError('Serialise me', 500, 'api_error');
            const parsed = JSON.parse(JSON.stringify(err.toJSON()));

            expect(parsed.name).toBe('PayArkError');
            expect(parsed.code).toBe('api_error');
            expect(parsed.statusCode).toBe(500);
        });

        test('should handle undefined raw body', () => {
            const err = new PayArkError('No raw', 404, 'not_found_error');
            const json = err.toJSON();

            expect(json.raw).toBeUndefined();
        });
    });
});

// ── errorCodeFromStatus ────────────────────────────────────────────────

describe('errorCodeFromStatus', () => {
    const statusCodeMappings: Array<[number, PayArkErrorCode]> = [
        [400, 'invalid_request_error'],
        [401, 'authentication_error'],
        [403, 'forbidden_error'],
        [404, 'not_found_error'],
        [422, 'invalid_request_error'],
        [429, 'rate_limit_error'],
        [500, 'api_error'],
        [502, 'api_error'],
        [503, 'api_error'],
        [504, 'api_error'],
    ];

    test.each(statusCodeMappings)(
        'should map HTTP %d to %s',
        (status, expectedCode) => {
            expect(errorCodeFromStatus(status)).toBe(expectedCode);
        },
    );

    test('should return unknown_error for unmapped status codes', () => {
        expect(errorCodeFromStatus(418)).toBe('unknown_error');  // I'm a teapot
        expect(errorCodeFromStatus(451)).toBe('unknown_error');   // Unavailable for Legal Reasons
        expect(errorCodeFromStatus(200)).toBe('unknown_error');   // OK (shouldn't reach this path)
        expect(errorCodeFromStatus(301)).toBe('unknown_error');   // Redirect
    });

    test('should handle edge case status 499 as unknown (not api_error)', () => {
        // 499 is a client-side error (Nginx), not 5xx
        expect(errorCodeFromStatus(499)).toBe('unknown_error');
    });
});
