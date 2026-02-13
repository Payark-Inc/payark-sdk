// ---------------------------------------------------------------------------
// PayArk SDK – Webhook Verification Utility
// ---------------------------------------------------------------------------
// Static helper for verifying incoming PayArk webhook signatures.
//
// Unlike checkout/payments resources, this does NOT require an HTTP client
// or API key — it's a pure cryptographic verification utility.
//
// Usage:
//   ```ts
//   import { PayArk } from '@payark/sdk';
//
//   const isValid = await PayArk.webhooks.verify(
//     rawBody,                            // The raw request body string
//     request.headers['x-payark-signature'], // The signature header
//     'whsec_...',                        // Your webhook secret
//   );
//   ```
//
// Reference: Stripe-style `t=<timestamp>,v1=<hex>` HMAC-SHA256 scheme.
// ---------------------------------------------------------------------------

/** Default tolerance: 5 minutes (300 seconds). */
const DEFAULT_TOLERANCE_SECONDS = 300;

/** Parsed signature header components. */
interface ParsedSignature {
    timestamp: number;
    signature: string;
}

/**
 * Static webhook verification utility.
 *
 * Provides methods for verifying HMAC-SHA256 webhook signatures
 * without needing an SDK client instance.
 */
export class WebhooksResource {
    /**
     * Verify a PayArk webhook signature.
     *
     * Call this in your webhook handler to ensure the request
     * actually came from PayArk and hasn't been tampered with.
     *
     * @param rawBody - The raw request body string (NOT parsed JSON).
     * @param signatureHeader - The `X-PayArk-Signature` header value.
     * @param secret - Your project's webhook signing secret.
     * @param toleranceSeconds - Max age before rejecting (default: 300s).
     * @returns `true` if the signature is valid and the timestamp is fresh.
     *
     * @example
     * ```ts
     * // Express.js example
     * app.post('/webhooks/payark', express.raw({ type: 'application/json' }), async (req, res) => {
     *   const isValid = await PayArk.webhooks.verify(
     *     req.body.toString(),
     *     req.headers['x-payark-signature'] as string,
     *     process.env.PAYARK_WEBHOOK_SECRET!,
     *   );
     *
     *   if (!isValid) {
     *     return res.status(401).send('Invalid signature');
     *   }
     *
     *   const event = JSON.parse(req.body.toString());
     *   // Handle event...
     *   res.json({ received: true });
     * });
     * ```
     */
    async verify(
        rawBody: string,
        signatureHeader: string,
        secret: string,
        toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
    ): Promise<boolean> {
        const parsed = this.parseHeader(signatureHeader);
        if (!parsed) return false;

        const { timestamp, signature } = parsed;

        // ── Replay Protection ──────────────────────────────────────────
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - timestamp) > toleranceSeconds) {
            return false;
        }

        // ── Recompute & Compare ────────────────────────────────────────
        const signedContent = `${timestamp}.${rawBody}`;
        const expected = await this.hmacSHA256Hex(signedContent, secret);

        return this.constantTimeEqual(signature, expected);
    }

    /**
     * Parse the `X-PayArk-Signature` header into its components.
     *
     * Useful if you want to inspect the timestamp or signature
     * separately before calling `verify()`.
     *
     * @param header - The raw `X-PayArk-Signature` header value.
     * @returns Parsed components, or `null` if malformed.
     */
    parseHeader(header: string): ParsedSignature | null {
        if (!header) return null;

        const parts = header.split(',');
        let timestamp: number | undefined;
        let signature: string | undefined;

        for (const part of parts) {
            const [key, value] = part.split('=', 2);
            if (key === 't') {
                timestamp = parseInt(value, 10);
            } else if (key === 'v1') {
                signature = value;
            }
        }

        if (timestamp === undefined || isNaN(timestamp) || !signature) {
            return null;
        }

        return { timestamp, signature };
    }

    // ── Private Cryptographic Helpers ───────────────────────────────────

    /** HMAC-SHA256 → lowercase hex. Works in Node 18+, Bun, Deno, CF Workers. */
    private async hmacSHA256Hex(data: string, secret: string): Promise<string> {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const msgData = encoder.encode(data);

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
        );

        const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
        return Array.from(new Uint8Array(sig))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /** Constant-time string comparison to prevent timing attacks. */
    private constantTimeEqual(a: string, b: string): boolean {
        if (a.length !== b.length) return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }
}
