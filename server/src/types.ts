// SDD MCP Server — Shared types
// Mirrors the JSON artifact schemas designed for the data layer.

// ─── State Machine ───────────────────────────────────────────────

export type FeatureState =
  | "drafting"
  | "specified"
  | "clarified"
  | "planned"
  | "tasked"
  | "implementing"
  | "validating"
  | "completed";

export interface TaskStatus {
  status: "pending" | "in-progress" | "completed";
  title: string;
  completed_at?: string;
}

export interface FeatureTransition {
  from: FeatureState;
  to: FeatureState;
  at: string;
  command: string;
}

export interface FeatureEntry {
  state: FeatureState;
  spec_path: string;
  plan_path?: string;
  tasks_path?: string;
  prd_reference?: string | null;
  transitions: FeatureTransition[];
  tasks: Record<string, TaskStatus>;
}

export interface Policy {
  max_concurrent_implementing: number;
}

export interface StateJson {
  version: string;
  project: string;
  initialized_at: string;
  active_feature: string | null;
  last_session_notes: string | null;
  last_session_end: string | null;
  coaching_profile: Record<string, { scaffolded: number; unscaffolded: number }>;
  completed_features: number;
  milestones: Record<string, boolean>;
  prd: { status: "none" | "draft" | "approved"; path: string };
  features: Record<string, FeatureEntry>;
  allowed_transitions: Record<FeatureState, FeatureState[]>;
  policy?: Policy;
}

// ─── Spec Artifact ───────────────────────────────────────────────

export interface Requirement {
  id: string;
  text: string;
}

export interface EdgeCase {
  id: string;
  scenario: string;
  behavior: string;
}

export interface DataModelField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface DataModel {
  entity: string;
  fields: DataModelField[];
}

export interface ApiError {
  code: number;
  meaning: string;
}

export interface ApiContract {
  method: string;
  path: string;
  purpose?: string;
  request?: Record<string, string>;
  response_code: number;
  errors: ApiError[] | number[];
}

export interface Clarification {
  id: string;
  type: "edge_case" | "ambiguity" | "assumption" | "gap";
  question: string;
  answer: string;
}

export interface SpecJson {
  feature: string;
  version: string;
  status: string;
  created: string;
  updated: string;
  prd_reference?: string | null;
  requirements: {
    functional: Requirement[];
    non_functional: Requirement[];
    edge_cases: EdgeCase[];
  };
  data_models: DataModel[];
  api_contracts: ApiContract[];
  clarifications: Clarification[];
  open_questions_count: number;
}

// ─── Tasks Artifact ──────────────────────────────────────────────

export interface TaskDefinition {
  id: string;
  title: string;
  complexity: "S" | "M" | "L";
  requirements: string[];
  depends_on: string[];
  files: string[];
  description: string;
  validation: string;
}

export interface Wave {
  wave: number;
  tasks: string[];
}

export interface TasksJson {
  feature: string;
  generated: string;
  tasks: TaskDefinition[];
  coverage: Record<string, string[]>;
  waves: Wave[];
}

// ─── Tool Outputs ────────────────────────────────────────────────

export interface GetStateGlobalOutput {
  project: string;
  active_feature: string | null;
  completed_features: number;
  features: Record<string, {
    state: FeatureState;
    tasks_completed: number;
    tasks_total: number;
  }>;
}

export interface GetStateFeatureOutput {
  feature: string;
  state: FeatureState;
  spec_path: string;
  plan_path?: string;
  tasks: Record<string, TaskStatus>;
  transitions: FeatureTransition[];
}

export interface TransitionSuccess {
  ok: true;
  feature: string;
  from: FeatureState;
  to: FeatureState;
  at: string;
}

export interface TransitionError {
  ok: false;
  error: "feature_not_found" | "invalid_transition" | "precondition_failed" | "feature_lock";
  feature: string;
  current_state?: FeatureState;
  requested?: FeatureState;
  allowed?: FeatureState[];
  unmet?: string[];
  hint?: string;
  locked_by?: string;
}

export type TransitionResult = TransitionSuccess | TransitionError;

export interface RequirementCoverage {
  tasks: string[];
  status: "covered" | "partial" | "pending" | "uncovered";
}

export interface ValidateOutput {
  feature: string;
  state: FeatureState;
  deterministic: {
    confidence: "exact";
    requirement_coverage: {
      total: number;
      implemented: number;
      missing: string[];
      breakdown: Record<string, RequirementCoverage>;
    };
    task_progress: {
      total: number;
      completed: number;
      in_progress: number;
      pending: number;
      blocked: string[];
    };
    orphan_requirements: string[];
  };
  heuristic: {
    confidence: "best_effort";
    constitution_compliance: {
      checked: boolean;
      issues: Array<{ rule: string; finding: string; severity: "error" | "warning" }>;
    };
  };
  summary: {
    can_complete: boolean;
    blockers: string[];
  };
}

export interface AvailableTransition {
  to: FeatureState;
  command: string;
  preconditions_met: boolean;
  blockers: string[];
  description: string;
}

export interface NextTask {
  id: string;
  title: string;
  complexity: "S" | "M" | "L";
  status: "pending" | "in-progress" | "completed";
  ready: boolean;
  blocked_by?: string[];
}

export interface NextActionFeatureOutput {
  feature: string;
  current_state: FeatureState;
  available_transitions: AvailableTransition[];
  next_tasks: NextTask[];
}

export interface NextActionGlobalOutput {
  active_feature: string | null;
  available_actions: Array<{
    action: string;
    command: string;
    description: string;
    features_available?: string[];
  }>;
}
