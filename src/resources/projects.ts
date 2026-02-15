import { HttpClient } from "../http";
import { PaginatedResponse } from "../types";

export interface Project {
  id: string;
  name: string;
  api_key_secret: string;
  created_at: string;
}

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
