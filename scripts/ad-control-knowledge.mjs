import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import mysql from 'mysql2/promise';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const domain = path.join(root, '.cursor/skills/domains/ad-control');
const knowledge = path.join(domain, 'knowledge');
const evidence = path.join(domain, 'evidence');
const candidateDir = path.join(knowledge, 'candidate');
const runtimeFile = path.join(knowledge, 'seed-runtime-v3.json');
const promotionLog = path.join(evidence, 'knowledge-promotions.jsonl');
const capturedAt = new Date().toISOString();

if (fs.existsSync(path.join(root, '.env'))) {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || process.env[match[1]] != null) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nested]) => nested !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, canonical(nested)]),
    );
  }
  return value;
}

function digest(value) {
  const input = Buffer.isBuffer(value)
    ? value
    : Buffer.from(JSON.stringify(canonical(value)));
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sourceEvidence(evidenceId, sourceType, file, notes) {
  const absolute = path.resolve(file);
  return {
    evidenceId,
    sourceType,
    source: absolute.replaceAll('\\', '/'),
    digest:
      fs.existsSync(absolute) && fs.statSync(absolute).isFile()
        ? digest(fs.readFileSync(absolute))
        : undefined,
    capturedAt,
    notes,
  };
}

function walkSourceFiles(directory) {
  const result = [];
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkSourceFiles(absolute));
    } else if (/\.(?:java|xml|properties|ya?ml)$/i.test(entry.name)) {
      result.push(absolute);
    }
  }
  return result.sort();
}

function buildFullCodeScan(jobRoot, dimensions, conditions, actions) {
  const files = walkSourceFiles(jobRoot);
  const terms = [
    ...dimensions.ruleFields.filter((entry) => entry.status === 'unknown').map((entry) => entry.ruleField),
    ...conditions.entries.filter((entry) => entry.status === 'unknown').flatMap((entry) => [
      entry.name,
      entry.name.startsWith('hour_') ? entry.name.slice('hour_'.length) : undefined,
    ]),
    ...actions.entries.filter((entry) => entry.status === 'unknown').flatMap((entry) => [
      entry.id.replace(/^action:/, ''),
      entry.name,
    ]),
  ].filter(Boolean);
  const uniqueTerms = [...new Set(terms)];
  const matches = Object.fromEntries(uniqueTerms.map((term) => [term, []]));
  const fileDigests = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    fileDigests.push({
      source: path.resolve(file).replaceAll('\\', '/'),
      digest: digest(Buffer.from(content)),
    });
    const lines = content.split(/\r?\n/);
    for (const term of uniqueTerms) {
      const normalized = term.toLowerCase().replaceAll('-', '_');
      for (let index = 0; index < lines.length; index += 1) {
        if (!lines[index].toLowerCase().includes(normalized)) continue;
        if (matches[term].length >= 100) break;
        matches[term].push({
          source: path.resolve(file).replaceAll('\\', '/'),
          line: index + 1,
          text: lines[index].trim().slice(0, 500),
        });
      }
    }
  }

  return {
    capturedAt,
    root: path.resolve(jobRoot).replaceAll('\\', '/'),
    scannedFileCount: files.length,
    sourceDigest: digest(fileDigests),
    files: fileDigests,
    unknownMatches: matches,
  };
}

function buildKnowledge() {
  return {
    dimensions: readJson(path.join(knowledge, 'dimensions.json')),
    conditions: readJson(path.join(knowledge, 'conditions.json')),
    actions: readJson(path.join(knowledge, 'actions.json')),
  };
}

function runtimeFromKnowledge(dimensions, conditions, actions, sourceIndex) {
  const jobChainManifestFile = path.join(
    knowledge,
    'compiled/job-chain/manifest.json',
  );
  const jobChainKnowledge = fs.existsSync(jobChainManifestFile)
    ? readJson(jobChainManifestFile)
    : undefined;
  const tables = dimensions.entries.map((entry) => entry.seed.tableRoute);
  const metrics = conditions.entries.map((entry) => entry.seed.metric);
  const capabilities = conditions.capabilities
    .filter((entry) => entry.status === 'verified')
    .map(({ status: _status, evidenceRefs: _evidenceRefs, confirmedAt: _confirmedAt, ...entry }) => entry);
  const semantic = {
    knowledgeVersion: '',
    evidenceDigest: digest(sourceIndex),
    seedDefaults: dimensions.seedDefaults,
    tables,
    metrics,
    filters: dimensions.ruleFields,
    capabilities,
    jobChainKnowledge: jobChainKnowledge
      ? {
          version: jobChainKnowledge.version,
          verifiedConditionRows: jobChainKnowledge.verifiedConditionRows,
          sourceDigest: jobChainKnowledge.sourceDigest,
        }
      : undefined,
  };
  semantic.knowledgeVersion = digest({
    dimensions,
    conditions,
    actions,
    evidenceDigest: semantic.evidenceDigest,
    jobChainKnowledge: semantic.jobChainKnowledge,
  });
  return semantic;
}

async function databaseSnapshot() {
  const required = ['E2E_DB_HOST', 'E2E_DB_USER', 'E2E_DB_NAME'];
  if (required.some((key) => !process.env[key])) {
    return { capturedAt, status: 'unknown', reason: `missing ${required.filter((key) => !process.env[key]).join(', ')}` };
  }
  const connection = await mysql.createConnection({
    host: process.env.E2E_DB_HOST,
    port: Number(process.env.E2E_DB_PORT || 3306),
    user: process.env.E2E_DB_USER,
    password: process.env.E2E_DB_PASSWORD,
    database: process.env.E2E_DB_NAME,
  });
  try {
    const [ruleColumns] = await connection.query('SHOW COLUMNS FROM `ad_data_control_rule`');
    const [rules] = await connection.query(
      `SELECT id, pline_form, data_type, release_ver, external_action, delivery_way,
              opt_status, project_status, status
         FROM ad_data_control_rule
        ORDER BY id DESC LIMIT 20`,
    );
    const routeEntries = readJson(runtimeFile).tables;
    const tables = [...new Set(routeEntries.map((entry) => entry.table))];
    const schemas = [];
    for (const table of tables) {
      const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
      schemas.push({ table, columns: columns.map((column) => ({ Field: column.Field, Type: column.Type, Null: column.Null, Key: column.Key })) });
    }
    return { capturedAt, status: 'verified', database: process.env.E2E_DB_NAME, ruleColumns, representativeRules: rules, factSchemas: schemas };
  } finally {
    await connection.end();
  }
}

function validateKnowledge(dimensions, conditions, actions, sourceIndex) {
  const errors = [];
  const evidenceIds = new Set(sourceIndex.entries.map((entry) => entry.evidenceId));
  const all = [...dimensions.entries, ...dimensions.ruleFields, ...conditions.entries, ...actions.entries];
  const ids = new Set();
  for (const entry of all) {
    if (ids.has(entry.id)) errors.push(`duplicate id ${entry.id}`);
    ids.add(entry.id);
    if (!['verified', 'unknown', 'deprecated'].includes(entry.status)) errors.push(`invalid status ${entry.id}`);
    if (!entry.confirmedAt) errors.push(`missing confirmedAt ${entry.id}`);
    if (!entry.evidenceRefs?.length) errors.push(`missing evidence ${entry.id}`);
    for (const ref of entry.evidenceRefs ?? []) {
      if (!evidenceIds.has(ref)) errors.push(`unknown evidence ${entry.id}:${ref}`);
    }
  }
  if (errors.length) throw new Error(`KNOWLEDGE_INVALID\n${errors.join('\n')}`);
  return { entries: all.length, verified: all.filter((entry) => entry.status === 'verified').length, unknown: all.filter((entry) => entry.status === 'unknown').length };
}

async function snapshot(target = knowledge) {
  const evidenceTarget =
    path.resolve(target) === path.resolve(candidateDir)
      ? path.join(candidateDir, 'evidence')
      : evidence;
  const job = 'D:/Project/market-job/market-job/src/main';
  const { dimensions, conditions, actions } = buildKnowledge();
  const fullCodeScan = buildFullCodeScan(job, dimensions, conditions, actions);
  const sources = [
    sourceEvidence('code-rule-model', 'code', path.join(job, 'java/com/dz/glory/job/model/DataControlRule.java'), '规则字段、枚举和指标'),
    sourceEvidence('code-job-routing', 'code', path.join(job, 'java/com/dz/glory/job/service/DataControlService.java'), '表路由、执行与时间粒度'),
    sourceEvidence('code-mapper-formula', 'code', path.join(job, 'java/com/dz/glory/job/mapper/xml/DataControlMapper.xml'), '指标聚合公式'),
    sourceEvidence('code-job-action', 'code', path.join(job, 'java/com/dz/glory/job/service/DataControlService.java'), '动作执行证据'),
    sourceEvidence('job-schedule', 'code', path.join(job, 'java/com/dz/glory/job/schedule/DataControlSchedule.java'), 'Job 调度入口'),
    sourceEvidence('ui-domain', 'ui', path.join(domain, 'references/dimensions.md'), '已消化的 UI 探索结论'),
    sourceEvidence('legacy-sql', 'sql-log', path.join(evidence, 'raw/SOURCES.md'), '历史 SQL 来源索引'),
    sourceEvidence('legacy-seed-success', 'sql-log', path.join(root, 'tests/e2e/generated/20260728-181405/explore'), '历史 Seed plan/audit/manifest'),
    { evidenceId: 'database-schema', sourceType: 'database', source: process.env.E2E_DB_NAME || 'unconfigured', capturedAt, notes: '测试库规则与事实表 schema 快照' },
  ];
  sources.push({
    evidenceId: 'code-full-scan',
    sourceType: 'code',
    source: path.resolve(job).replaceAll('\\', '/'),
    digest: fullCodeScan.sourceDigest,
    capturedAt,
    notes: `显式 refresh 全量扫描 ${fullCodeScan.scannedFileCount} 个 Java/XML/配置文件；只生成候选证据，不自动升级 verified`,
  });
  const sourceIndex = { schemaVersion: 1, capturedAt, entries: sources };
  const db = await databaseSnapshot();
  writeJson(path.join(evidenceTarget, 'source-index.json'), sourceIndex);
  writeJson(path.join(evidenceTarget, 'code-snapshot.json'), {
    capturedAt,
    sources: sources.filter((item) => item.sourceType === 'code'),
    fullScan: fullCodeScan,
  });
  writeJson(path.join(evidenceTarget, 'knowledge-gap-report.json'), {
    capturedAt,
    ruleFields: dimensions.ruleFields
      .filter((entry) => entry.status === 'unknown')
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        term: entry.ruleField,
        codeMatches: fullCodeScan.unknownMatches[entry.ruleField]?.length ?? 0,
        decision: 'manual-review-required',
      })),
    conditions: conditions.entries
      .filter((entry) => entry.status === 'unknown')
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        codeMatches:
          (fullCodeScan.unknownMatches[entry.name]?.length ?? 0) +
          (entry.name.startsWith('hour_')
            ? fullCodeScan.unknownMatches[entry.name.slice('hour_'.length)]?.length ?? 0
            : 0),
        decision: 'formula-and-schema-review-required',
      })),
    actions: actions.entries
      .filter((entry) => entry.status === 'unknown')
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        codeMatches:
          (fullCodeScan.unknownMatches[entry.id.replace(/^action:/, '')]?.length ?? 0) +
          (fullCodeScan.unknownMatches[entry.name]?.length ?? 0),
        decision: 'code-and-ui-closed-loop-review-required',
      })),
  });
  writeJson(path.join(evidenceTarget, 'database-snapshot.json'), db);
  writeJson(path.join(evidenceTarget, 'ui-snapshot.json'), { capturedAt, sources: sources.filter((item) => item.sourceType === 'ui') });
  writeJson(path.join(target, 'dimensions.json'), dimensions);
  writeJson(path.join(target, 'conditions.json'), conditions);
  writeJson(path.join(target, 'actions.json'), actions);
  const stats = validateKnowledge(dimensions, conditions, actions, sourceIndex);
  const runtime = runtimeFromKnowledge(dimensions, conditions, actions, sourceIndex);
  writeJson(path.join(target, 'seed-runtime-v3.json'), runtime);
  writeJson(path.join(target, 'manifest.json'), {
    schemaVersion: 1,
    version: runtime.knowledgeVersion,
    frozenAt: capturedAt,
    evidenceDigest: runtime.evidenceDigest,
    domains: { dimensions: 'dimensions.json', conditions: 'conditions.json', actions: 'actions.json' },
    runtime: 'seed-runtime-v3.json',
    stats,
  });
  return { version: runtime.knowledgeVersion, stats };
}

function semanticDiff(before, after) {
  const result = {};
  for (const name of ['dimensions', 'conditions', 'actions']) {
    const previous = fs.existsSync(path.join(before, `${name}.json`)) ? readJson(path.join(before, `${name}.json`)) : {};
    const next = readJson(path.join(after, `${name}.json`));
    result[name] = { changed: digest(previous) !== digest(next), before: digest(previous), after: digest(next) };
  }
  return result;
}

const [command = 'validate', ...raw] = process.argv.slice(2);
const args = Object.fromEntries(raw.filter((value) => value.startsWith('--')).map((value) => {
  const [key, ...rest] = value.slice(2).split('=');
  return [key, rest.join('=')];
}));

if (command === 'snapshot') {
  console.log(JSON.stringify(await snapshot(candidateDir), null, 2));
} else if (command === 'diff') {
  console.log(JSON.stringify(semanticDiff(knowledge, candidateDir), null, 2));
} else if (command === 'promote') {
  if (!args.approvedBy || !args.reason) throw new Error('promote requires --approvedBy and --reason');
  const candidateDimensions = readJson(path.join(candidateDir, 'dimensions.json'));
  const candidateConditions = readJson(path.join(candidateDir, 'conditions.json'));
  const candidateActions = readJson(path.join(candidateDir, 'actions.json'));
  const candidateSourceIndex = readJson(path.join(candidateDir, 'evidence/source-index.json'));
  const candidateStats = validateKnowledge(
    candidateDimensions,
    candidateConditions,
    candidateActions,
    candidateSourceIndex,
  );
  const candidateRuntime = runtimeFromKnowledge(
    candidateDimensions,
    candidateConditions,
    candidateActions,
    candidateSourceIndex,
  );
  writeJson(path.join(candidateDir, 'seed-runtime-v3.json'), candidateRuntime);
  writeJson(path.join(candidateDir, 'manifest.json'), {
    schemaVersion: 1,
    version: candidateRuntime.knowledgeVersion,
    frozenAt: new Date().toISOString(),
    evidenceDigest: candidateRuntime.evidenceDigest,
    domains: { dimensions: 'dimensions.json', conditions: 'conditions.json', actions: 'actions.json' },
    runtime: 'seed-runtime-v3.json',
    stats: candidateStats,
  });
  for (const name of ['manifest.json', 'dimensions.json', 'conditions.json', 'actions.json', 'seed-runtime-v3.json']) {
    fs.copyFileSync(path.join(candidateDir, name), path.join(knowledge, name));
    fs.unlinkSync(path.join(candidateDir, name));
  }
  for (const name of ['source-index.json', 'code-snapshot.json', 'database-snapshot.json', 'ui-snapshot.json', 'knowledge-gap-report.json']) {
    fs.copyFileSync(path.join(candidateDir, 'evidence', name), path.join(evidence, name));
  }
  fs.rmSync(candidateDir, { recursive: true, force: true });
  fs.appendFileSync(promotionLog, `${JSON.stringify({ version: readJson(path.join(knowledge, 'manifest.json')).version, approvedBy: args.approvedBy, reason: args.reason, approvedAt: new Date().toISOString() })}\n`);
  console.log(`promoted=${readJson(path.join(knowledge, 'manifest.json')).version}`);
} else if (command === 'compile') {
  const dimensions = readJson(path.join(knowledge, 'dimensions.json'));
  const conditions = readJson(path.join(knowledge, 'conditions.json'));
  const actions = readJson(path.join(knowledge, 'actions.json'));
  const sourceIndex = readJson(path.join(evidence, 'source-index.json'));
  validateKnowledge(dimensions, conditions, actions, sourceIndex);
  const runtime = runtimeFromKnowledge(dimensions, conditions, actions, sourceIndex);
  writeJson(runtimeFile, runtime);
  const manifestFile = path.join(knowledge, 'manifest.json');
  const manifest = readJson(manifestFile);
  const jobChainManifestFile = path.join(knowledge, 'compiled/job-chain/manifest.json');
  writeJson(manifestFile, {
    ...manifest,
    version: runtime.knowledgeVersion,
    evidenceDigest: runtime.evidenceDigest,
    frozenAt: new Date().toISOString(),
    jobChain: fs.existsSync(jobChainManifestFile)
      ? {
          path: 'compiled/job-chain/manifest.json',
          ...readJson(jobChainManifestFile),
        }
      : undefined,
  });
  console.log(`runtime=${runtimeFile}\nversion=${runtime.knowledgeVersion}`);
} else if (command === 'validate') {
  const stats = validateKnowledge(
    readJson(path.join(knowledge, 'dimensions.json')),
    readJson(path.join(knowledge, 'conditions.json')),
    readJson(path.join(knowledge, 'actions.json')),
    readJson(path.join(evidence, 'source-index.json')),
  );
  console.log(JSON.stringify(stats, null, 2));
} else {
  throw new Error(`unknown knowledge command ${command}`);
}
