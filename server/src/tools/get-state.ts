import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StateManager } from "../state/manager.js";
import type { GetStateGlobalOutput, GetStateFeatureOutput } from "../types.js";

export function registerGetState(server: McpServer, stateManager: StateManager): void {
  server.registerTool(
    "sdd_get_state",
    {
      description:
        "Get current SDD project state. Pass a feature name for detailed feature state, or omit for global overview.",
      inputSchema: {
        feature: z
          .string()
          .optional()
          .describe("Feature name. Omit for global project state."),
      },
    },
    async ({ feature }) => {
      const state = await stateManager.read();

      if (feature) {
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

        const output: GetStateFeatureOutput = {
          feature,
          state: featureEntry.state,
          spec_path: featureEntry.spec_path,
          plan_path: featureEntry.plan_path,
          tasks: featureEntry.tasks,
          transitions: featureEntry.transitions,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      }

      // Global state
      const features: GetStateGlobalOutput["features"] = {};
      for (const [name, entry] of Object.entries(state.features)) {
        const tasks = Object.values(entry.tasks);
        features[name] = {
          state: entry.state,
          tasks_completed: tasks.filter((t) => t.status === "completed").length,
          tasks_total: tasks.length,
        };
      }

      const output: GetStateGlobalOutput = {
        project: state.project,
        active_feature: state.active_feature,
        completed_features: state.completed_features,
        features,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
      };
    }
  );
}
