export type RuleConditionRequest = {
  timeRange: string;
  metric: string;
  aggregateType?: string;
  compareType: string;
  val1: number;
  val2?: number;
};

export type RuleCreateRequest = {
  projectName?: string;
  channel?: string;
  businessLine: string;
  controlDimension: string;
  dimensionValues?: Record<string, unknown>;
  conditions: RuleConditionRequest[];
  actions?: Record<string, unknown>;
  ruleName?: string;
};

export type RuleCreateIssue = {
  code: string;
  message: string;
  field?: string;
};

export type PlannedField = {
  label: string;
  value: unknown;
  source: 'user' | 'verified-default';
  reason?: string;
};

export type RuleCreatePlan = {
  version: 1;
  status: 'blocked' | 'confirmation-required' | 'confirmed';
  request: RuleCreateRequest;
  explicitFields: PlannedField[];
  supplementedFields: PlannedField[];
  omittedOptionalFields: string[];
  issues: RuleCreateIssue[];
  markdown: string;
};

export type RuleCreateResult = {
  status: 'created' | 'blocked' | 'failed';
  ruleId?: string;
  ruleName?: string;
  projectName?: string;
  channel?: string;
  businessLine: string;
  controlDimension?: string;
  actualFields: Record<string, unknown>;
  conditions: Array<Record<string, unknown>>;
  actions: Record<string, unknown>;
  createdAt?: string;
  evidence: { screenshotPaths: string[]; pageUrl?: string };
  handoff?: {
    nextSkill: 'ui-flow-db';
    ruleId: string;
    suggestedModes: Array<'hit' | 'miss'>;
  };
  issues: RuleCreateIssue[];
};

export type RuleCreationKnowledge = {
  verifiedDefaults: Record<string, unknown>;
  optionalLabels: string[];
  verifiedMetrics: Set<string>;
  verifiedActions: Set<string>;
  standaloneBlockedMetrics: Set<string>;
};
