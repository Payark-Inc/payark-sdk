// ---------------------------------------------------------------------------
// PayArk SDK – Automation Resource
// ---------------------------------------------------------------------------
// Management of automated billing tasks (reminders, reapers).
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http";
import type { PayArkClient } from "./customers";

/**
 * Trigger subscription reminders for upcoming renewals.
 */
export async function dispatchReminders(
  client: PayArkClient,
  cronSecret: string,
): Promise<{ message: string; count: number }> {
  return client.http.request<{ message: string; count: number }>(
    "POST",
    "/v1/automation/reminders",
    {
      headers: { "x-cron-secret": cronSecret },
    },
  );
}

/**
 * Trigger the subscription reaper to handle expired subscriptions.
 */
export async function runReaper(
  client: PayArkClient,
  cronSecret: string,
): Promise<{ message: string; count: number }> {
  return client.http.request<{ message: string; count: number }>(
    "POST",
    "/v1/automation/reaper",
    {
      headers: { "x-cron-secret": cronSecret },
    },
  );
}

// ── Legacy Resource Class ──────────────────────────────────────────────────

/**
 * Resource class for PayArk Automation.
 * @deprecated Use functional exports instead.
 */
export class AutomationResource {
  constructor(public readonly http: HttpClient) {}

  async dispatchReminders(
    cronSecret: string,
  ): Promise<{ message: string; count: number }> {
    return dispatchReminders(this, cronSecret);
  }

  async runReaper(
    cronSecret: string,
  ): Promise<{ message: string; count: number }> {
    return runReaper(this, cronSecret);
  }
}
