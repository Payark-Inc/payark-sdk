// ---------------------------------------------------------------------------
// PayArk SDK – Projects Resource
// ---------------------------------------------------------------------------

import type { HttpClient } from "../http";
import type { Project } from "../schemas";
import type { PayArkClient } from "./customers";

// ── Functional API ─────────────────────────────────────────────────────────

/**
 * List all projects belonging to the authenticated account.
 * Requires a Personal Access Token (PAT).
 */
export async function listProjects(client: PayArkClient): Promise<Project[]> {
  return client.http.request<Project[]>("GET", "/v1/projects");
}

// ── Legacy Resource Class ──────────────────────────────────────────────────

/**
 * Resource class for managing PayArk Projects.
 * @deprecated Use functional exports instead for better tree-shaking.
 */
export class Projects {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<Project[]> {
    return listProjects(this);
  }
}
