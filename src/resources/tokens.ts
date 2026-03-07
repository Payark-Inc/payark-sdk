// ---------------------------------------------------------------------------
// PayArk SDK – Tokens Resource
// ---------------------------------------------------------------------------
// Management of Personal Access Tokens (PAT).
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http";
import type { Token } from "../types";
import type { PayArkClient } from "./customers";

/**
 * Create a new personal access token.
 * Requires User Session (Supabase JWT).
 */
export async function createToken(
  client: PayArkClient,
  params: {
    name: string;
    scopes?: string[];
    expires_in_days?: number;
  },
  userToken: string,
): Promise<Token & { token: string }> {
  return client.http.request<Token & { token: string }>("POST", "/v1/tokens", {
    body: params,
    headers: { Authorization: `Bearer ${userToken}` },
  });
}

/**
 * List all tokens belonging to the authenticated user.
 */
export async function listTokens(
  client: PayArkClient,
  userToken: string,
): Promise<Token[]> {
  return client.http.request<Token[]>("GET", "/v1/tokens", {
    headers: { Authorization: `Bearer ${userToken}` },
  });
}

/**
 * Delete a token by its ID.
 */
export async function deleteToken(
  client: PayArkClient,
  id: string,
  userToken: string,
): Promise<void> {
  return client.http.request<void>(
    "DELETE",
    `/v1/tokens/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: `Bearer ${userToken}` },
    },
  );
}

// ── Legacy Resource Class ──────────────────────────────────────────────────

/**
 * Resource class for PayArk Tokens.
 * @deprecated Use functional exports instead.
 */
export class TokensResource {
  constructor(public readonly http: HttpClient) {}

  async create(
    params: { name: string; scopes?: string[]; expires_in_days?: number },
    userToken: string,
  ): Promise<Token & { token: string }> {
    return createToken(this, params, userToken);
  }

  async list(userToken: string): Promise<Token[]> {
    return listTokens(this, userToken);
  }

  async delete(id: string, userToken: string): Promise<void> {
    return deleteToken(this, id, userToken);
  }
}
