import { Effect, Context } from "effect";
import { HttpClient, HttpClientRequest } from "@effect/platform";
import { PayArkEffectError } from "./errors";
import type { PayArkConfig } from "../types";

/**
 * Service tag for the PayArk configuration.
 */
export class PayArkConfigService extends Context.Tag("PayArkConfigService")<
  PayArkConfigService,
  PayArkConfig
>() {}

/**
 * Executes an HTTP request using Effect and returns the JSON body or a PayArkEffectError.
 */
export const request = <T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options?: {
    readonly query?: Record<string, string | number | undefined>;
    readonly body?: any;
    readonly headers?: Record<string, string>;
  },
): Effect.Effect<
  T,
  PayArkEffectError,
  PayArkConfigService | HttpClient.HttpClient
> =>
  Effect.gen(function* (_) {
    const config = yield* _(PayArkConfigService);
    const client = yield* _(HttpClient.HttpClient);

    const baseUrl = (config.baseUrl ?? "https://api.payark.com").replace(
      /\/+$/,
      "",
    );
    const url = new URL(`${baseUrl}${path}`);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": `payark-sdk-effect/0.1.0`,
      ...options?.headers,
    };

    if (config.sandbox) {
      headers["x-sandbox-mode"] = "true";
    }

    let req = HttpClientRequest.make(method)(url.toString()).pipe(
      HttpClientRequest.setHeaders(headers),
    );

    if (options?.body) {
      req = yield* _(
        HttpClientRequest.bodyJson(options.body)(req).pipe(
          Effect.mapError(
            (e) =>
              new PayArkEffectError({
                message: `Invalid request body: ${String(e)}`,
                statusCode: 400,
                code: "invalid_request_error",
              }),
          ),
        ),
      );
    }

    const response = yield* _(
      client.execute(req).pipe(
        Effect.mapError(
          (e) =>
            new PayArkEffectError({
              message: `Network error: ${e.message}`,
              statusCode: 0,
              code: "connection_error",
            }),
        ),
      ),
    );

    if (response.status >= 200 && response.status < 300) {
      if (response.status === 204) return {} as T;
      return (yield* _(
        response.json.pipe(
          Effect.mapError(
            (e) =>
              new PayArkEffectError({
                message: `Failed to parse response: ${String(e)}`,
                statusCode: response.status,
                code: "api_error",
              }),
          ),
        ),
      )) as T;
    }

    const errorBody: any = yield* _(
      response.json.pipe(
        Effect.catchAll(() => Effect.succeed({ error: undefined })),
      ),
    );

    return yield* _(
      Effect.fail(
        new PayArkEffectError({
          message:
            errorBody?.error || `Request failed with status ${response.status}`,
          statusCode: response.status,
          code: mapStatusToCode(response.status),
          raw: errorBody,
        }),
      ),
    );
  });

function mapStatusToCode(status: number): any {
  if (status === 401) return "authentication_error";
  if (status === 403) return "permission_error";
  if (status === 400 || status === 422) return "invalid_request_error";
  if (status === 404) return "not_found_error";
  if (status === 429) return "rate_limit_error";
  if (status >= 500) return "api_error";
  return "unknown_error";
}
