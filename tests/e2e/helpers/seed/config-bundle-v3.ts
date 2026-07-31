import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  MetricMapEntry,
  SeedAllowEntry,
  TableMapEntry,
} from './engine';

export type SourceDigest = { source: string; digest: string };
export type SeedConfigBundle = {
  version: string;
  generatedAt: string;
  generatedFrom: SourceDigest[];
  tables: TableMapEntry[];
  metrics: MetricMapEntry[];
  filters: Array<Record<string, unknown>>;
  capabilities: SeedAllowEntry[];
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stable(nested)]),
    );
  }
  return value;
}

export function configBundleDigest(
  bundle: Pick<
    SeedConfigBundle,
    'generatedFrom' | 'tables' | 'metrics' | 'filters' | 'capabilities'
  >,
): string {
  const semantic = {
    generatedFrom: bundle.generatedFrom,
    tables: bundle.tables,
    metrics: bundle.metrics,
    filters: bundle.filters,
    capabilities: bundle.capabilities,
  };
  return `sha256:${crypto
    .createHash('sha256')
    .update(JSON.stringify(stable(semantic)))
    .digest('hex')}`;
}

export function loadPromotedConfigBundle(
  file = path.resolve(
    '.cursor/skills/domains/ad-control/knowledge/seed-runtime-v3.json',
  ),
): SeedConfigBundle {
  if (!fs.existsSync(file)) {
    throw new Error(
      'SEED_KNOWLEDGE_NOT_PROMOTED: run knowledge:snapshot/diff and explicit knowledge:promote',
    );
  }
  const runtime = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    knowledgeVersion: string;
    evidenceDigest: string;
    tables: SeedConfigBundle['tables'];
    metrics: SeedConfigBundle['metrics'];
    filters: SeedConfigBundle['filters'];
    capabilities: SeedConfigBundle['capabilities'];
  };
  const bundle: SeedConfigBundle = {
    version: '',
    generatedAt: '',
    generatedFrom: [
      {
        source: 'ad-control-knowledge',
        digest: runtime.knowledgeVersion,
      },
      {
        source: 'ad-control-evidence',
        digest: runtime.evidenceDigest,
      },
    ],
    tables: runtime.tables,
    metrics: runtime.metrics,
    filters: runtime.filters,
    capabilities: runtime.capabilities,
  };
  bundle.version = configBundleDigest(bundle);
  if (
    !bundle.version ||
    !Array.isArray(bundle.generatedFrom) ||
    !Array.isArray(bundle.tables) ||
    !Array.isArray(bundle.metrics) ||
    !Array.isArray(bundle.filters) ||
    !Array.isArray(bundle.capabilities)
  ) {
    throw new Error('SEED_CONFIG_V3_INVALID');
  }
  const actual = configBundleDigest(bundle);
  if (actual !== bundle.version) {
    throw new Error(`SEED_CONFIG_V3_HASH_MISMATCH expected=${bundle.version} actual=${actual}`);
  }
  return bundle;
}
