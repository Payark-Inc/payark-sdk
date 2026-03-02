// ---------------------------------------------------------------------------
// PayArk SDK – Webhook Verification Utility
// ---------------------------------------------------------------------------
// Static helper for verifying incoming PayArk webhook signatures.
// ---------------------------------------------------------------------------

import { PayArkSignatureVerificationError } from "../errors";
import type { WebhookEvent } from "../schemas";

/** Default tolerance: 5 minutes (300 seconds). */
const DEFAULT_TOLERANCE_SECONDS = 300;

/** Parsed signature header components. */
export interface ParsedSignature {
  timestamp: number;
  signature: string;
}

// ── Functional API ─────────────────────────────────────────────────────────

/**
 * Verify the signature header and parse the webhook body.
 */
export async function constructEvent(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): Promise<WebhookEvent> {
  await verifySignature(rawBody, signatureHeader, secret, toleranceSeconds);
  return JSON.parse(rawBody) as WebhookEvent;
}

/**
 * Helper to perform the actual verification check.
 */
export async function verifySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number,
): Promise<void> {
  const parsed = parseHeader(signatureHeader);
  if (!parsed) {
    throw new PayArkSignatureVerificationError(
      "Unable to extract timestamp and signature from header",
    );
  }

  const { timestamp, signature } = parsed;

  // ── Replay Protection ──────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  if (toleranceSeconds > 0 && Math.abs(now - timestamp) > toleranceSeconds) {
    throw new PayArkSignatureVerificationError(
      "Timestamp outside the tolerance zone",
    );
  }

  // ── Recompute & Compare ────────────────────────────────────────
  const signedContent = `${timestamp}.${rawBody}`;
  const expected = await hmacSHA256Hex(signedContent, secret);

  if (!constantTimeEqual(signature, expected)) {
    throw new PayArkSignatureVerificationError("Signature did not match");
  }
}

/**
 * Parse the `X-PayArk-Signature` header into its components.
 */
export function parseHeader(header: string): ParsedSignature | null {
  if (!header) return null;

  const parts = header.split(",");
  let timestamp: number | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "t") {
      timestamp = parseInt(value, 10);
    } else if (key === "v1") {
      signature = value;
    }
  }

  if (timestamp === undefined || isNaN(timestamp) || !signature) {
    return null;
  }

  return { timestamp, signature };
}

// ── Internal Cryptographic Helpers ─────────────────────────────────────────

/** HMAC-SHA256 → lowercase hex. */
async function hmacSHA256Hex(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── Legacy Resource Class ──────────────────────────────────────────────────

/**
 * Static webhook verification utility.
 * @deprecated Use functional exports instead.
 */
export class WebhooksResource {
  async constructEvent(
    rawBody: string,
    signatureHeader: string,
    secret: string,
    toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
  ): Promise<WebhookEvent> {
    return constructEvent(rawBody, signatureHeader, secret, toleranceSeconds);
  }

  parseHeader(header: string): ParsedSignature | null {
    return parseHeader(header);
  }
}
