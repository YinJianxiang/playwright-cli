import fs from 'node:fs';
import path from 'node:path';
import type {
  MetricMapEntry,
  SeedAllowEntry,
  TableMapEntry,
} from './engine';

export type KnowledgeStatus = 'verified' | 'unknown' | 'deprecated';

export type EvidenceRef = {
  evidenceId: string;
  sourceType: 'code' | 'database' | 'ui' | 'sql-log' | 'user-confirmation';
  source: string;
  digest?: string;
  capturedAt: string;
  notes?: string;
};

export type KnowledgeEntry = {
  id: string;
  name: string;
  status: KnowledgeStatus;
  applicablePlines?: string[];
  levels?: string[];
  confirmedAt: string;
  evidenceRefs: string[];
  constraints?: string[];
};

export type DimensionKnowledge = KnowledgeEntry & {
  seed?: { tableRoute: TableMapEntry };
};

export type ConditionKnowledge = KnowledgeEntry & {
  seed: { metric: MetricMapEntry };
};

export type ActionKnowledge = KnowledgeEntry & {
  ui?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  assertion?: Record<string, unknown>;
  cleanup?: Record<string, unknown>;
};

export type AdControlKnowledgeBundle = {
  version: string;
  frozenAt: string;
  evidenceDigest: string;
  jobChain?: {
    path: string;
    version: string;
    verifiedConditionRows: number;
    sourceDigest: string;
  };
  dimensions: {
    entries: DimensionKnowledge[];
    ruleFields: Array<KnowledgeEntry & {
      ruleField: string;
      unlimited?: unknown[];
      patchColumn?: string;
    }>;
    seedDefaults: Record<string, unknown>;
    uiDefaults: Record<string, string>;
  };
  conditions: {
    entries: ConditionKnowledge[];
    capabilities: Array<SeedAllowEntry & {
      status: KnowledgeStatus;
      evidenceRefs: string[];
      confirmedAt: string;
    }>;
  };
  actions: { entries: ActionKnowledge[] };
  evidence: EvidenceRef[];
};

export type SeedRuntimeConfigV3 = {
  knowledgeVersion: string;
  evidenceDigest: string;
  seedDefaults: Record<string, unknown>;
  tables: TableMapEntry[];
  metrics: MetricMapEntry[];
  filters: AdControlKnowledgeBundle['dimensions']['ruleFields'];
  capabilities: SeedAllowEntry[];
  jobChainKnowledge?: {
    version: string;
    verifiedConditionRows: number;
    sourceDigest: string;
  };
};

const DEFAULT_DIR = path.resolve(
  '.cursor/skills/domains/ad-control/knowledge',
);

export function loadAdControlKnowledge(
  knowledgeDir = DEFAULT_DIR,
): AdControlKnowledgeBundle {
  const read = <T>(name: string): T =>
    JSON.parse(fs.readFileSync(path.join(knowledgeDir, name), 'utf8')) as T;
  const manifest = read<{
    version: string;
    frozenAt: string;
    evidenceDigest: string;
  }>('manifest.json');
  const sourceIndex = JSON.parse(
    fs.readFileSync(
      path.join(knowledgeDir, '..', 'evidence', 'source-index.json'),
      'utf8',
    ),
  ) as { entries: EvidenceRef[] };
  return {
    ...manifest,
    dimensions: read('dimensions.json'),
    conditions: read('conditions.json'),
    actions: read('actions.json'),
    evidence: sourceIndex.entries,
  };
}

export function compileSeedConfigFromKnowledge(
  bundle: AdControlKnowledgeBundle,
): SeedRuntimeConfigV3 {
  return {
    knowledgeVersion: bundle.version,
    evidenceDigest: bundle.evidenceDigest,
    seedDefaults: bundle.dimensions.seedDefaults,
    tables: bundle.dimensions.entries.map((entry) => {
      if (!entry.seed?.tableRoute) {
        throw new Error(`KNOWLEDGE_TABLE_ROUTE_MISSING: ${entry.id}`);
      }
      return entry.seed.tableRoute;
    }),
    metrics: bundle.conditions.entries.map((entry) => entry.seed.metric),
    filters: bundle.dimensions.ruleFields,
    capabilities: bundle.conditions.capabilities
      .filter((entry) => entry.status === 'verified')
      .map(({ status: _status, evidenceRefs: _evidence, confirmedAt: _confirmed, ...entry }) => entry),
    jobChainKnowledge: bundle.jobChain
      ? {
          version: bundle.jobChain.version,
          verifiedConditionRows: bundle.jobChain.verifiedConditionRows,
          sourceDigest: bundle.jobChain.sourceDigest,
        }
      : undefined,
  };
}

export function assertKnowledgeEntryVerified(
  entry: KnowledgeEntry,
  purpose: string,
): void {
  if (entry.status !== 'verified') {
    throw new Error(`KNOWLEDGE_UNKNOWN: ${purpose} requires ${entry.id}`);
  }
}

export function getVerifiedActionKnowledge(
  actionId = 'action:warning',
): ActionKnowledge {
  const action = loadAdControlKnowledge().actions.entries.find(
    (entry) => entry.id === actionId,
  );
  if (!action) throw new Error(`KNOWLEDGE_ACTION_MISSING: ${actionId}`);
  assertKnowledgeEntryVerified(action, 'action execution');
  return action;
}

export function getDimensionUiDefaults(): Record<string, string> {
  return loadAdControlKnowledge().dimensions.uiDefaults;
}
