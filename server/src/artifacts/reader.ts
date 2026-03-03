import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SpecJson, TasksJson } from "../types.js";

export class ArtifactReader {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async readSpec(featureName: string): Promise<SpecJson | null> {
    try {
      const specPath = join(this.projectRoot, "specs", featureName, "spec.json");
      const raw = await readFile(specPath, "utf-8");
      return JSON.parse(raw) as SpecJson;
    } catch {
      return null;
    }
  }

  async readTasks(featureName: string): Promise<TasksJson | null> {
    try {
      const tasksPath = join(this.projectRoot, "specs", featureName, "tasks.json");
      const raw = await readFile(tasksPath, "utf-8");
      return JSON.parse(raw) as TasksJson;
    } catch {
      return null;
    }
  }

  async readConstitution(): Promise<string | null> {
    try {
      const constitutionPath = join(this.projectRoot, "constitution.md");
      return await readFile(constitutionPath, "utf-8");
    } catch {
      return null;
    }
  }
}
