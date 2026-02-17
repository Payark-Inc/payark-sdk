import { Effect } from "effect";
import { Schema } from "@effect/schema";
import { PayArkConfigService, request } from "../http";
import { ProjectSchema } from "../schemas";
import type { PayArkConfig } from "../../types";
import type { Project } from "../../resources/projects";
import type { HttpClient } from "@effect/platform";

/**
 * Effect-based resource for PayArk Projects.
 */
export class ProjectsEffect {
  constructor(private readonly config: PayArkConfig) {}

  /**
   * List all projects belonging to the authenticated account.
   *
   * @returns Effect that resolves to an array of projects.
   */
  list(): Effect.Effect<Project[], any, HttpClient.HttpClient> {
    return request<any>("GET", "/v1/projects").pipe(
      Effect.flatMap(Schema.decodeUnknown(Schema.Array(ProjectSchema))),
      Effect.provideService(PayArkConfigService, this.config),
    ) as any;
  }
}
