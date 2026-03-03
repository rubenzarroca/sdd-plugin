import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StateManager } from "../state/manager.js";
import type { FeatureState } from "../types.js";

const VALID_STATES: FeatureState[] = [
  "drafting",
  "specified",
  "clarified",
  "planned",
  "tasked",
  "implementing",
  "validating",
  "completed",
];

export function registerTransition(server: McpServer, stateManager: StateManager): void {
  server.registerTool(
    "sdd_transition",
    {
      description:
        "Transition a feature to a new state. Enforces the state machine: validates allowed transitions, preconditions, and feature locks. The only way to change feature state.",
      inputSchema: {
        feature: z.string().describe("Feature name (kebab-case)"),
        to: z
          .enum(VALID_STATES as [string, ...string[]])
          .describe("Target state to transition to"),
        command: z
          .string()
          .describe("The skill or tool that originates this transition (for audit trail)"),
      },
    },
    async ({ feature, to, command }) => {
      const result = await stateManager.transition(
        feature,
        to as FeatureState,
        command
      );

      if (result.ok) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        isError: true,
      };
    }
  );
}
