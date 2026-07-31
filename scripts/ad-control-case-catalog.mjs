import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const knowledgeDir = path.join(root, '.cursor/skills/domains/ad-control/knowledge');
const outputDir = path.join(root, '.cursor/skills/domains/ad-control/evidence');

const dimensions = JSON.parse(fs.readFileSync(path.join(knowledgeDir, 'dimensions.json'), 'utf8'));
const conditions = JSON.parse(fs.readFileSync(path.join(knowledgeDir, 'conditions.json'), 'utf8'));
const actions = JSON.parse(fs.readFileSync(path.join(knowledgeDir, 'actions.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(knowledgeDir, 'manifest.json'), 'utf8'));

const clientPlines = new Set(['syhplay', 'cltmain', 'cltplay']);
const nearHourTypes = new Set(['1', '2', '3', '6', '53', '43']);

function resolveGrain(plineForm, timeType, releaseVer) {
  const type = String(timeType);
  if (clientPlines.has(plineForm)) return nearHourTypes.has(type) ? 'hour' : 'day';
  if (releaseVer === 3) return nearHourTypes.has(type) ? 'hour' : 'day';
  return nearHourTypes.has(type) || type === '0' ? 'hour' : 'day';
}

const verifiedMetrics = conditions.entries.filter((entry) => entry.status === 'verified');
const verifiedRoutes = dimensions.entries.filter((entry) => entry.status === 'verified');
const verifiedActions = actions.entries.filter((entry) => entry.status === 'verified');
const verifiedCapabilities = conditions.capabilities.filter((entry) => entry.status === 'verified');

const invalidCapabilities = [];
const cases = verifiedCapabilities.flatMap((capability) => {
  const metricEntry = verifiedMetrics.find(
    (entry) =>
      entry.name === capability.column &&
      (entry.applicablePlines.includes(capability.plineForm) || entry.applicablePlines.includes('*')),
  );
  if (!metricEntry) {
    invalidCapabilities.push({
      key: capability.key,
      notes: 'capability 标记为 verified，但找不到同业务线的 verified metric；按不可处理项列出',
    });
    return [];
  }
  const metric = metricEntry.seed.metric;
  const releaseVersions = metric.requireReleaseVer === 3 ? [3] : [null, 3];
  const targets = [];
  for (const releaseVer of releaseVersions) {
    const grain = metric.seedPolicy?.forceGrain ?? resolveGrain(capability.plineForm, capability.timeType, releaseVer);
    for (const routeEntry of verifiedRoutes) {
      const route = routeEntry.seed.tableRoute;
      const routeRelease = route.releaseVer ?? null;
      if (
        route.plineForm === capability.plineForm &&
        route.dataType === capability.dataType &&
        route.timeGrain === grain &&
        routeRelease === releaseVer
      ) {
        targets.push({
          releaseVer: releaseVer ?? 'default',
          grain,
          table: route.table,
          entityIdColumn: route.entityIdColumn,
        });
      }
    }
  }
  if (!targets.length) {
    invalidCapabilities.push({
      key: capability.key,
      notes: 'capability 和 metric 已 verified，但当前知识没有匹配的 verified 表路由',
    });
    return [];
  }
  return [{
    caseId: '',
    capabilityKey: capability.key,
    plineForm: capability.plineForm,
    dataType: capability.dataType,
    timeType: capability.timeType,
    condition: capability.column,
    metricKind: metric.metricKind,
    evaluationPhase: metric.seedPolicy.evaluationPhase,
    standaloneAllowed: metric.seedPolicy.standaloneRule !== 'blocked',
    writeColumns: metric.writeColumns,
    supportedOperators: conditions.comparison.operators,
    supportedModes: ['hit', 'miss'],
    verifiedActions: verifiedActions
      .filter(
        (action) =>
          (action.applicablePlines.includes('*') || action.applicablePlines.includes(capability.plineForm)) &&
          action.levels.includes(capability.dataType),
      )
      .map((action) => action.name),
    targets,
    notes: capability.notes,
  }];
});
cases.forEach((entry, index) => {
  entry.caseId = `seed-case-${String(index + 1).padStart(3, '0')}`;
});

const blocked = {
  dimensions: dimensions.ruleFields
    .filter((entry) => entry.status === 'unknown')
    .map((entry) => ({ id: entry.id, name: entry.name, constraints: entry.constraints })),
  conditions: conditions.entries
    .filter((entry) => entry.status === 'unknown')
    .map((entry) => ({ id: entry.id, name: entry.name, constraints: entry.constraints })),
  capabilities: [
    ...conditions.capabilities
    .filter((entry) => entry.status === 'unknown')
    .map((entry) => ({ key: entry.key, notes: entry.notes })),
    ...invalidCapabilities,
  ],
  actions: actions.entries
    .filter((entry) => entry.status === 'unknown')
    .map((entry) => ({ id: entry.id, name: entry.name, constraints: entry.constraints })),
};

const catalog = {
  generatedAt: new Date().toISOString(),
  knowledgeVersion: manifest.version,
  definition:
    '每个 case 是一个 verified 原子造数能力；支持 HIT 和 MISS。多条件 AND/OR/NOT 可由这些原子能力组合，但组合数不有限枚举，字段冲突由 Preflight 阻断。',
  summary: {
    atomicCases: cases.length,
    standaloneCases: cases.filter((entry) => entry.standaloneAllowed).length,
    combinationOnlyCases: cases.filter((entry) => !entry.standaloneAllowed).length,
    hitCases: cases.length,
    missCases: cases.length,
    executableVariants: cases.length * 2,
    verifiedActions: verifiedActions.map((entry) => entry.name),
    blockedKnowledgeItems:
      blocked.dimensions.length + blocked.conditions.length + blocked.capabilities.length + blocked.actions.length,
  },
  cases,
  blocked,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'case-catalog-v3.json'), `${JSON.stringify(catalog, null, 2)}\n`);

const groups = new Map();
for (const entry of cases) {
  const key = `${entry.plineForm} / ${entry.dataType}`;
  groups.set(key, [...(groups.get(key) ?? []), entry]);
}
const markdown = [
  '# 广告管控 Seed V3 可处理 Case 全量清单',
  '',
  `- 知识版本：\`${manifest.version}\``,
  `- verified 原子能力：${cases.length}`,
  `- 可独立执行：${cases.filter((entry) => entry.standaloneAllowed).length}`,
  `- 仅可参与组合：${cases.filter((entry) => !entry.standaloneAllowed).length}`,
  `- HIT：${cases.length}`,
  `- MISS：${cases.length}`,
  `- 原子执行变体：${cases.length * 2}`,
  `- verified 动作：${verifiedActions.map((entry) => entry.name).join('、') || '无'}`,
  '',
  '> 多条件 AND/OR/NOT 由下列原子能力组合。组合数量理论上不封顶，因此本清单列举可组成组合的全部 verified 原子能力；实际组合仍需通过冲突检查和 Preflight。',
  '',
];

for (const [group, entries] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  markdown.push(`## ${group}`, '');
  markdown.push('| Case ID | 时间类型 | 条件 | 指标类型 | 阶段 | 独立执行 | HIT/MISS | 动作 | 目标表 |', '|---|---:|---|---|---|---|---|---|---|');
  for (const entry of entries) {
    markdown.push(
      `| ${entry.caseId} | ${entry.timeType} | ${entry.condition} | ${entry.metricKind} | ${entry.evaluationPhase} | ${entry.standaloneAllowed ? '是' : '否，须搭配 aggregate 条件'} | HIT、MISS | ${entry.verifiedActions.join('、') || '无'} | ${entry.targets.map((target) => `${target.table}(${target.releaseVer})`).join('<br>')} |`,
    );
  }
  markdown.push('');
}

markdown.push('## 当前阻断项', '');
for (const [domain, entries] of Object.entries(blocked)) {
  markdown.push(`### ${domain}`, '');
  if (!entries.length) {
    markdown.push('- 无', '');
    continue;
  }
  for (const entry of entries) {
    markdown.push(`- \`${entry.id ?? entry.key}\` ${entry.name ?? ''}：${(entry.constraints ?? [entry.notes]).filter(Boolean).join('；')}`);
  }
  markdown.push('');
}

fs.writeFileSync(path.join(outputDir, 'case-catalog-v3.md'), `${markdown.join('\n')}\n`);
console.log(JSON.stringify(catalog.summary, null, 2));
