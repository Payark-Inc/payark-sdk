import { HttpClient } from "../http";

import { Project } from "../types";

export class Projects {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all projects belonging to the authenticated account.
   * Requires a Personal Access Token (PAT).
   */
  async list(): Promise<Project[]> {
    return this.http.request<Project[]>("GET", "/v1/projects");
  }
}
