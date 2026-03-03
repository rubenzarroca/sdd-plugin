import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  StateJson,
  FeatureState,
  FeatureEntry,
  TransitionResult,
} from "../types.js";

export class StateManager {
  private statePath: string;

  constructor(projectRoot: string) {
    this.statePath = join(projectRoot, ".sdd", "state.json");
  }

  async read(): Promise<StateJson> {
    const raw = await readFile(this.statePath, "utf-8");
    return JSON.parse(raw) as StateJson;
  }

  private async write(state: StateJson): Promise<void> {
    await writeFile(this.statePath, JSON.stringify(state, null, 2), "utf-8");
  }

  async getFeature(featureName: string): Promise<FeatureEntry | null> {
    const state = await this.read();
    return state.features[featureName] ?? null;
  }

  async transition(
    featureName: string,
    toState: FeatureState,
    command: string
  ): Promise<TransitionResult> {
    const state = await this.read();

    // 1. Feature exists?
    const feature = state.features[featureName];
    if (!feature) {
      return {
        ok: false,
        error: "feature_not_found",
        feature: featureName,
        hint: `Feature "${featureName}" does not exist in state.json`,
      };
    }

    const fromState = feature.state;

    // 2. Transition allowed?
    const allowed = state.allowed_transitions[fromState];
    if (!allowed || !allowed.includes(toState)) {
      return {
        ok: false,
        error: "invalid_transition",
        feature: featureName,
        current_state: fromState,
        requested: toState,
        allowed: allowed ?? [],
        hint: `Cannot transition from "${fromState}" to "${toState}". Allowed: ${(allowed ?? []).join(", ")}`,
      };
    }

    // 3. Precondition: implementing requires tasks exist
    if (toState === "implementing") {
      const taskCount = Object.keys(feature.tasks).length;
      if (taskCount === 0) {
        return {
          ok: false,
          error: "precondition_failed",
          feature: featureName,
          current_state: fromState,
          requested: toState,
          unmet: ["Feature has no tasks defined"],
          hint: "Run /sdd:tasks first to decompose the plan into tasks",
        };
      }
    }

    // 4. Precondition: single-feature lock for implementing
    if (toState === "implementing") {
      const maxConcurrent = state.policy?.max_concurrent_implementing ?? 1;
      const currentlyImplementing = Object.entries(state.features)
        .filter(([name, f]) => f.state === "implementing" && name !== featureName);

      if (currentlyImplementing.length >= maxConcurrent) {
        return {
          ok: false,
          error: "feature_lock",
          feature: featureName,
          current_state: fromState,
          requested: toState,
          locked_by: currentlyImplementing[0][0],
          hint: `Feature "${currentlyImplementing[0][0]}" is already in "implementing" state. Complete or reset it first.`,
        };
      }
    }

    // 5. Precondition: validating requires all tasks completed
    if (toState === "validating") {
      const pendingTasks = Object.entries(feature.tasks)
        .filter(([, t]) => t.status !== "completed")
        .map(([id]) => id);

      if (pendingTasks.length > 0) {
        return {
          ok: false,
          error: "precondition_failed",
          feature: featureName,
          current_state: fromState,
          requested: toState,
          unmet: [`${pendingTasks.length} tasks still pending: ${pendingTasks.join(", ")}`],
          hint: "Complete all tasks before validating",
        };
      }
    }

    // 6. Precondition: completed requires clean validation
    if (toState === "completed") {
      const pendingTasks = Object.entries(feature.tasks)
        .filter(([, t]) => t.status !== "completed")
        .map(([id]) => id);

      if (pendingTasks.length > 0) {
        return {
          ok: false,
          error: "precondition_failed",
          feature: featureName,
          current_state: fromState,
          requested: toState,
          unmet: [`${pendingTasks.length} tasks not completed: ${pendingTasks.join(", ")}`],
          hint: "All tasks must be completed before marking feature as done",
        };
      }
    }

    // All checks passed — apply transition
    const now = new Date().toISOString();

    feature.state = toState;
    feature.transitions.push({
      from: fromState,
      to: toState,
      at: now,
      command,
    });

    // Side effects
    if (toState === "implementing" && !state.active_feature) {
      state.active_feature = featureName;
    }

    if (toState === "completed") {
      state.completed_features += 1;
      state.active_feature = null;
    }

    if (toState === "drafting") {
      state.active_feature = featureName;
    }

    await this.write(state);

    return {
      ok: true,
      feature: featureName,
      from: fromState,
      to: toState,
      at: now,
    };
  }
}
