import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StateManager } from "../state/manager.js";
import type { ArtifactReader } from "../artifacts/reader.js";
import type {
  ValidateOutput,
  RequirementCoverage,
  TasksJson,
  FeatureEntry,
} from "../types.js";

function computeRequirementCoverage(
  tasksJson: TasksJson,
  featureEntry: FeatureEntry
): {
  breakdown: Record<string, RequirementCoverage>;
  total: number;
  implemented: number;
  missing: string[];
  orphan_requirements: string[];
} {
  const breakdown: Record<string, RequirementCoverage> = {};
  const allRequirementIds = Object.keys(tasksJson.coverage);
  const orphan_requirements: string[] = [];

  for (const reqId of allRequirementIds) {
    const taskIds = tasksJson.coverage[reqId];

    if (!taskIds || taskIds.length === 0) {
      breakdown[reqId] = { tasks: [], status: "uncovered" };
      orphan_requirements.push(reqId);
      continue;
    }

    const taskStatuses = taskIds.map((tid) => featureEntry.tasks[tid]?.status ?? "pending");
    const allCompleted = taskStatuses.every((s) => s === "completed");
    const someCompleted = taskStatuses.some((s) => s === "completed");

    let status: RequirementCoverage["status"];
    if (allCompleted) {
      status = "covered";
    } else if (someCompleted) {
      status = "partial";
    } else {
      status = "pending";
    }

    breakdown[reqId] = { tasks: taskIds, status };
  }

  const total = allRequirementIds.length;
  const implemented = Object.values(breakdown).filter((b) => b.status === "covered").length;
  const missing = Object.entries(breakdown)
    .filter(([, b]) => b.status !== "covered")
    .map(([id]) => id);

  return { breakdown, total, implemented, missing, orphan_requirements };
}

function computeTaskProgress(
  tasksJson: TasksJson,
  featureEntry: FeatureEntry
): ValidateOutput["deterministic"]["task_progress"] {
  const allTasks = tasksJson.tasks;
  let completed = 0;
  let in_progress = 0;
  let pending = 0;
  const blocked: string[] = [];

  for (const task of allTasks) {
    const status = featureEntry.tasks[task.id]?.status ?? "pending";

    if (status === "completed") {
      completed++;
    } else if (status === "in-progress") {
      in_progress++;
    } else {
      // Check if blocked by unfinished dependencies
      const hasUnfinishedDeps = task.depends_on.some((depId) => {
        const depStatus = featureEntry.tasks[depId]?.status;
        return depStatus !== "completed";
      });

      if (hasUnfinishedDeps) {
        blocked.push(task.id);
      }

      pending++;
    }
  }

  return { total: allTasks.length, completed, in_progress, pending, blocked };
}

function analyzeConstitution(
  constitutionText: string | null
): ValidateOutput["heuristic"]["constitution_compliance"] {
  if (!constitutionText) {
    return { checked: false, issues: [] };
  }

  // Heuristic: parse constitution sections and flag basic structural issues
  // This is best-effort — the caller knows via confidence: "best_effort"
  const issues: Array<{ rule: string; finding: string; severity: "error" | "warning" }> = [];

  const requiredSections = [
    "## Architecture",
    "## Testing",
    "## Security",
    "## Allowed Dependencies",
    "## Code Standards",
    "## Process",
  ];

  for (const section of requiredSections) {
    if (!constitutionText.includes(section)) {
      issues.push({
        rule: `Constitution structure: ${section}`,
        finding: `Section "${section}" not found in constitution.md`,
        severity: "warning",
      });
    }
  }

  return { checked: true, issues };
}

export function registerValidate(
  server: McpServer,
  stateManager: StateManager,
  artifactReader: ArtifactReader
): void {
  server.registerTool(
    "sdd_validate",
    {
      description:
        "Verify implementation against the spec. Returns deterministic coverage data (exact confidence) and heuristic constitution compliance (best-effort confidence). Use after all tasks are completed.",
      inputSchema: {
        feature: z.string().describe("Feature name to validate"),
      },
    },
    async ({ feature }) => {
      const state = await stateManager.read();
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

      const tasksJson = await artifactReader.readTasks(feature);
      if (!tasksJson) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "tasks_json_not_found",
                feature,
                hint: "Run /sdd:tasks first to generate tasks.json",
              }),
            },
          ],
          isError: true,
        };
      }

      // Deterministic: requirement coverage
      const coverage = computeRequirementCoverage(tasksJson, featureEntry);
      const taskProgress = computeTaskProgress(tasksJson, featureEntry);

      // Heuristic: constitution compliance
      const constitutionText = await artifactReader.readConstitution();
      const constitutionCompliance = analyzeConstitution(constitutionText);

      // Summary
      const blockers: string[] = [];
      if (coverage.missing.length > 0) {
        blockers.push(
          `${coverage.missing.length} requirements not yet implemented (${coverage.missing.join(", ")})`
        );
      }
      if (taskProgress.blocked.length > 0) {
        blockers.push(
          `${taskProgress.blocked.length} tasks blocked by dependencies (${taskProgress.blocked.join(", ")})`
        );
      }
      if (taskProgress.pending > 0) {
        blockers.push(`${taskProgress.pending} tasks still pending`);
      }

      const output: ValidateOutput = {
        feature,
        state: featureEntry.state,
        deterministic: {
          confidence: "exact",
          requirement_coverage: {
            total: coverage.total,
            implemented: coverage.implemented,
            missing: coverage.missing,
            breakdown: coverage.breakdown,
          },
          task_progress: taskProgress,
          orphan_requirements: coverage.orphan_requirements,
        },
        heuristic: {
          confidence: "best_effort",
          constitution_compliance: constitutionCompliance,
        },
        summary: {
          can_complete: blockers.length === 0,
          blockers,
        },
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
      };
    }
  );
}
