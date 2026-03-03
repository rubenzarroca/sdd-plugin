import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StateManager } from "../state/manager.js";
import type { ArtifactReader } from "../artifacts/reader.js";
import type {
  FeatureState,
  NextActionFeatureOutput,
  NextActionGlobalOutput,
  AvailableTransition,
  NextTask,
} from "../types.js";

const TRANSITION_DESCRIPTIONS: Record<FeatureState, { command: string; description: string }> = {
  drafting: { command: "sdd-specify", description: "Start or restart the specification" },
  specified: { command: "sdd-specify", description: "Feature has been specified" },
  clarified: { command: "sdd-clarify", description: "Specification has been clarified" },
  planned: { command: "sdd-plan", description: "Technical plan has been designed" },
  tasked: { command: "sdd-tasks", description: "Plan has been decomposed into tasks" },
  implementing: { command: "sdd-implement", description: "Tasks are being implemented" },
  validating: { command: "sdd-validate", description: "Verify implementation against spec" },
  completed: { command: "sdd-validate", description: "Feature is complete" },
};

function getCommandForTransition(to: FeatureState): string {
  return TRANSITION_DESCRIPTIONS[to]?.command ?? "unknown";
}

function getDescriptionForTransition(from: FeatureState, to: FeatureState): string {
  if (to === "drafting") return "Full reset to re-specify the feature";

  const descriptions: Record<string, string> = {
    "drafting->specified": "Specify the feature requirements",
    "specified->clarified": "Clarify gaps and ambiguities in the spec",
    "specified->planned": "Design the technical approach (skip clarify)",
    "specified->drafting": "Reset to re-specify from scratch",
    "clarified->planned": "Design the technical approach",
    "clarified->drafting": "Reset to re-specify from scratch",
    "planned->tasked": "Decompose plan into atomic tasks",
    "planned->drafting": "Reset to re-specify from scratch",
    "tasked->implementing": "Start implementing tasks",
    "tasked->drafting": "Reset to re-specify from scratch",
    "implementing->validating": "Verify implementation against spec",
    "implementing->tasked": "Re-decompose tasks (keeps spec and plan)",
    "implementing->drafting": "Reset to re-specify from scratch",
    "validating->completed": "Mark feature as complete",
    "validating->implementing": "Return to implementation to fix issues",
    "validating->drafting": "Reset to re-specify from scratch",
    "completed->drafting": "Start a new iteration of this feature",
  };

  return descriptions[`${from}->${to}`] ?? `Transition to ${to}`;
}

function checkPreconditions(
  state: FeatureState,
  to: FeatureState,
  feature: { tasks: Record<string, { status: string }> }
): { met: boolean; blockers: string[] } {
  const blockers: string[] = [];

  if (to === "implementing") {
    const taskCount = Object.keys(feature.tasks).length;
    if (taskCount === 0) {
      blockers.push("No tasks defined — run /sdd:tasks first");
    }
  }

  if (to === "validating") {
    const pending = Object.entries(feature.tasks)
      .filter(([, t]) => t.status !== "completed")
      .map(([id]) => id);
    if (pending.length > 0) {
      blockers.push(`${pending.length} tasks still pending: ${pending.join(", ")}`);
    }
  }

  if (to === "completed") {
    const pending = Object.entries(feature.tasks)
      .filter(([, t]) => t.status !== "completed")
      .map(([id]) => id);
    if (pending.length > 0) {
      blockers.push(`${pending.length} tasks not completed: ${pending.join(", ")}`);
    }
  }

  return { met: blockers.length === 0, blockers };
}

export function registerNextAction(
  server: McpServer,
  stateManager: StateManager,
  artifactReader: ArtifactReader
): void {
  server.registerTool(
    "sdd_next_action",
    {
      description:
        "Get available actions for a feature or the project. Read-only — shows valid transitions with precondition status and available tasks. Does not decide; the caller decides.",
      inputSchema: {
        feature: z
          .string()
          .optional()
          .describe("Feature name. Omit for global project actions."),
      },
    },
    async ({ feature }) => {
      const state = await stateManager.read();

      if (!feature) {
        const output: NextActionGlobalOutput = {
          active_feature: state.active_feature,
          available_actions: [],
        };

        if (state.active_feature) {
          output.available_actions.push({
            action: "resume_feature",
            command: "sdd-status",
            description: `Resume work on "${state.active_feature}"`,
          });
        }

        const incompleteFeatures = Object.entries(state.features)
          .filter(([, f]) => f.state !== "completed")
          .map(([name]) => name);

        if (incompleteFeatures.length > 0) {
          output.available_actions.push({
            action: "continue_feature",
            command: "sdd-status",
            description: "Continue an in-progress feature",
            features_available: incompleteFeatures,
          });
        }

        output.available_actions.push({
          action: "specify_new_feature",
          command: "sdd-specify",
          description: "Start specifying a new feature",
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      }

      // Feature-specific
      const featureEntry = state.features[feature];
      if (!featureEntry) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "feature_not_found",
                feature,
                available: Object.keys(state.features),
              }),
            },
          ],
          isError: true,
        };
      }

      const currentState = featureEntry.state;
      const allowed = state.allowed_transitions[currentState] ?? [];

      const available_transitions: AvailableTransition[] = allowed.map((to) => {
        const { met, blockers } = checkPreconditions(currentState, to, featureEntry);
        return {
          to,
          command: getCommandForTransition(to),
          preconditions_met: met,
          blockers,
          description: getDescriptionForTransition(currentState, to),
        };
      });

      // Next tasks (only relevant if in tasked or implementing state)
      const next_tasks: NextTask[] = [];

      if (currentState === "tasked" || currentState === "implementing") {
        const tasksJson = await artifactReader.readTasks(feature);

        if (tasksJson) {
          for (const task of tasksJson.tasks) {
            const status = featureEntry.tasks[task.id]?.status ?? "pending";

            const blockedByIds = task.depends_on.filter((depId) => {
              const depStatus = featureEntry.tasks[depId]?.status;
              return depStatus !== "completed";
            });

            const ready = status === "pending" && blockedByIds.length === 0;

            const nextTask: NextTask = {
              id: task.id,
              title: task.title,
              complexity: task.complexity,
              status: status as NextTask["status"],
              ready,
            };

            if (blockedByIds.length > 0) {
              nextTask.blocked_by = blockedByIds;
            }

            next_tasks.push(nextTask);
          }
        }
      }

      const output: NextActionFeatureOutput = {
        feature,
        current_state: currentState,
        available_transitions,
        next_tasks,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
      };
    }
  );
}
