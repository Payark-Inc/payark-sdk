import { describe, test, expect } from "bun:test";
import { PayArk } from "../../src/index";
import { PayArkSignatureVerificationError } from "../../src/errors";

// Helper to generate a valid signature
async function generateSignature(
  payload: string,
  secret: string,
  timestamp: number
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(`${timestamp}.${payload}`);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("Webhooks", () => {
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({
    id: "evt_123",
    type: "payment.succeeded",
    data: {
      object: {
        id: "pay_123",
        amount: 1000,
        currency: "usd",
      },
    },
  });

  test("should successfully verify a valid signature", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await generateSignature(payload, secret, timestamp);
    const header = `t=${timestamp},v1=${signature}`;

    const event = await PayArk.webhooks.constructEvent(
      payload,
      header,
      secret
    );

    expect(event.type).toBe("payment.succeeded");
    expect((event as any).data.object.id).toBe("pay_123");
  });

  test("should throw error for invalid signature", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = "invalid_signature";
    const header = `t=${timestamp},v1=${signature}`;

    try {
      await PayArk.webhooks.constructEvent(payload, header, secret);
      expect(true).toBe(false); // Fail if no error thrown
    } catch (err) {
      expect(err).toBeInstanceOf(PayArkSignatureVerificationError);
      expect((err as any).message).toContain("Signature did not match");
    }
  });

  test("should throw error for timestamp outside tolerance", async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const signature = await generateSignature(payload, secret, timestamp);
    const header = `t=${timestamp},v1=${signature}`;

    try {
      await PayArk.webhooks.constructEvent(payload, header, secret);
      expect(true).toBe(false); // Fail if no error thrown
    } catch (err) {
      expect(err).toBeInstanceOf(PayArkSignatureVerificationError);
      expect((err as any).message).toContain("Timestamp outside the tolerance zone");
    }
  });

    test("should throw error for malformed header", async () => {
    const header = `malformed_header`;

    try {
      await PayArk.webhooks.constructEvent(payload, header, secret);
      expect(true).toBe(false); // Fail if no error thrown
    } catch (err) {
      expect(err).toBeInstanceOf(PayArkSignatureVerificationError);
      expect((err as any).message).toContain("Unable to extract timestamp and signature");
    }
  });
});
