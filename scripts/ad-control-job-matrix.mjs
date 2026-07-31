import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import mysql from 'mysql2/promise';

const workspace = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const jobRoot = 'D:/Project/market-job/market-job/src/main';
const javaRoot = path.join(jobRoot, 'java/com/dz/glory/job');
const files = {
  schedule: path.join(javaRoot, 'schedule/DataControlSchedule.java'),
  service: path.join(javaRoot, 'service/DataControlService.java'),
  readService: path.join(javaRoot, 'service/DataControlReadService.java'),
  rule: path.join(javaRoot, 'model/DataControlRule.java'),
  pline: path.join(javaRoot, 'utils/PlineEnum.java'),
  mapperJava: path.join(javaRoot, 'mapper/DataControlMapper.java'),
  mapperXml: path.join(javaRoot, 'mapper/xml/DataControlMapper.xml'),
};
const outputDir = path.join(
  workspace,
  '.cursor/skills/domains/ad-control/knowledge/candidate/job-chain',
);

if (fs.existsSync(path.join(workspace, '.env'))) {
  for (const line of fs.readFileSync(path.join(workspace, '.env'), 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || process.env[match[1]] != null) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(
    Buffer.isBuffer(value) ? value : JSON.stringify(value),
  ).digest('hex')}`;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeJson(name, value) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null && value !== ''))];
}

const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

const plinesByEnum = {};
for (const match of source.pline.matchAll(
  /^\s*([A-Z][A-Z0-9_]*)\(\s*-?\d+\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/gm,
)) {
  plinesByEnum[match[1]] = { enumKey: match[1], name: match[2], alias: match[3] };
}

const dataTypes = [...source.rule.matchAll(
  /^\s*(PROMOTION|CHANNEL|PROJECT|USER)\("([^"]+)",\s*"([^"]+)"\)/gm,
)].map((match) => ({ enumKey: match[1], value: match[2], name: match[3] }));

const timeEnumBlock = /public enum TimeTypeEnum\s*\{([\s\S]*?)private String value;/.exec(source.rule)?.[1] ?? '';
const timeRanges = [...timeEnumBlock.matchAll(
  /^\s*([A-Z][A-Z0-9_]*)\("([^"]+)"\),?\s*(?:\/\/\s*(.*))?$/gm,
)].map((match) => ({
  enumKey: match[1],
  value: match[2],
  description: match[3]?.trim() || match[1],
  grain:
    match[1].startsWith('HOUR_')
      ? 'hour'
      : match[1] === 'TODAY'
        ? 'depends-on-business-line-and-release'
        : 'day',
}));

const reduceTypes = [...source.rule.matchAll(
  /^\s*(TOTAL|ANYONE|ALL|FIRST)\("([^"]+)",\s*"([^"]+)"\)/gm,
)].map((match) => ({ enumKey: match[1], value: match[2], name: match[3] }));

const compareTypes = [...source.rule.matchAll(
  /^\s*(GE|LE|BETWEEN)\("([^"]+)",\s*"([^"]+)"\)/gm,
)].map((match) => ({ enumKey: match[1], value: match[2], name: match[3] }));

const columnBlock = /public enum ColumnEnum\s*\{([\s\S]*?)private String value;/.exec(source.rule)?.[1] ?? '';
const metrics = [...columnBlock.matchAll(
  /^\s*([A-Z][A-Z0-9_]*)\("([^"]+)",\s*"([^"]+)",\s*Lists\.newArrayList\((.*)\)\),?/gm,
)].map((match) => {
  const plineEnums = [...match[4].matchAll(/PlineEnum\.([A-Z0-9_]+)\.getAlias\(\)/g)].map(
    (item) => item[1],
  );
  return {
    enumKey: match[1],
    column: match[2],
    name: match[3],
    businessLines: plineEnums.map((key) => plinesByEnum[key]?.alias ?? key),
    evidence: `${files.rule.replaceAll('\\', '/')}:${source.rule.slice(0, match.index).split('\n').length}`,
  };
});

function extractJavaMethodBodies(javaSource) {
  const methods = [];
  const pattern = /public\s+List<[^;\n]+?>\s+(\w+)\([^)]*\)\s*\{/g;
  for (const match of javaSource.matchAll(pattern)) {
    const open = match.index + match[0].lastIndexOf('{');
    let depth = 0;
    let close = open;
    for (; close < javaSource.length; close += 1) {
      if (javaSource[close] === '{') depth += 1;
      if (javaSource[close] === '}') depth -= 1;
      if (depth === 0) break;
    }
    methods.push({ name: match[1], body: javaSource.slice(open + 1, close) });
  }
  return methods;
}

const readServiceMethods = {};
for (const method of extractJavaMethodBodies(source.readService)) {
  const mapperCalls = [...method.body.matchAll(/return dataControlMapper\.(\w+)\(/g)].map(
    (match) => match[1],
  );
  readServiceMethods[method.name] = {
    method: method.name,
    hourMapper: mapperCalls.at(-1),
    dayMapper:
      /TableDimension\s*\.\s*DAY[\s\S]*?return dataControlMapper\.(\w+)\(/.exec(method.body)?.[1],
  };
}

const xmlStatements = {};
for (const match of source.mapperXml.matchAll(
  /<select\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g,
)) {
  const body = match[2];
  const formulas = [];
  const lines = body.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!/\bas\s+_data_/i.test(lines[index])) continue;
    const alias = /\bas\s+(_data_[A-Za-z0-9_]+)/i.exec(lines[index])?.[1];
    if (!alias) continue;
    formulas.push({
      alias,
      expression: lines[index]
        .replace(/^\s*,?/, '')
        .replace(new RegExp(`\\s+as\\s+${alias}\\s*$`, 'i'), '')
        .trim(),
      sourceLine: source.mapperXml.slice(0, match.index).split('\n').length + index + 1,
    });
  }
  xmlStatements[match[1]] = {
    statementId: match[1],
    tables: unique(
      [...body.matchAll(/\b(?:from|join)\s+([A-Za-z0-9_.$#{}`-]+)/gi)].map((item) =>
        item[1].replaceAll('`', ''),
      ),
    ),
    formulas,
    sourceLine: source.mapperXml.slice(0, match.index).split('\n').length,
  };
}

const jobs = [];
for (const match of source.service.matchAll(
  /controlState\.getJobMap\(\)\.put\(DataControlJob\.([A-Z0-9_]+),\s*DataControlJob\.builder\(\)([\s\S]*?)\.build\(\)\);/g,
)) {
  const body = match[2];
  const plineEnums = unique(
    [...body.matchAll(/PlineEnum\.([A-Z0-9_]+)\.getAlias\(\)/g)].map((item) => item[1]),
  );
  const dataTypeEnum = /DataTypeEnum\.([A-Z]+)\.getValue\(\)\.equals\(rule\.getDataType\(\)\)/.exec(body)?.[1];
  const scanMethod = /dataControlReadService\.(\w+)\(/.exec(body)?.[1];
  const releaseVersion =
    /Integer\.valueOf\(3\)\.equals\(rule\.getReleaseVer\(\)\)/.test(body)
      ? /!\s*Integer\.valueOf\(3\)/.test(body)
        ? 'not-3'
        : 3
      : 'any';
  const readMapping = readServiceMethods[scanMethod] ?? {};
  jobs.push({
    jobKey: match[1],
    title: /\.title\("([^"]+)"\)/.exec(body)?.[1],
    baseTable: /\.dataTable\("([^"]+)"\)/.exec(body)?.[1],
    businessLines: plineEnums.map((key) => plinesByEnum[key]?.alias ?? key),
    businessLineNames: plineEnums.map((key) => plinesByEnum[key]?.name ?? key),
    dataType: dataTypes.find((entry) => entry.enumKey === dataTypeEnum)?.value,
    dataTypeName: dataTypes.find((entry) => entry.enumKey === dataTypeEnum)?.name,
    releaseVersion,
    scanMethod,
    hourMapper: readMapping.hourMapper,
    dayMapper: readMapping.dayMapper,
    predicateSource: body
      .split(/\r?\n/)
      .filter((line) => /rulePredicate|rule\.get|PlineEnum|DataTypeEnum/.test(line))
      .map((line) => line.trim()),
    sourceLine: source.service.slice(0, match.index).split('\n').length,
  });
}

const tableCandidates = unique(
  jobs.flatMap((job) => [
    job.baseTable,
    job.baseTable?.replace(/_hour$/, '_day'),
    ...(xmlStatements[job.hourMapper]?.tables ?? []),
    ...(xmlStatements[job.dayMapper]?.tables ?? []),
  ]),
).filter((table) => /^ad_[A-Za-z0-9_]+$/.test(table));

async function inspectSchemas() {
  const required = ['E2E_DB_HOST', 'E2E_DB_USER', 'E2E_DB_NAME'];
  if (required.some((key) => !process.env[key])) {
    return {
      status: 'unknown',
      reason: `missing ${required.filter((key) => !process.env[key]).join(', ')}`,
      tables: [],
    };
  }
  const connection = await mysql.createConnection({
    host: process.env.E2E_DB_HOST,
    port: Number(process.env.E2E_DB_PORT || 3306),
    user: process.env.E2E_DB_USER,
    password: process.env.E2E_DB_PASSWORD,
    database: process.env.E2E_DB_NAME,
  });
  try {
    const tables = [];
    for (const table of tableCandidates) {
      const [found] = await connection.query(
        `SELECT TABLE_NAME
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [process.env.E2E_DB_NAME, table],
      );
      if (!found.length) {
        tables.push({ table, exists: false, columns: [] });
        continue;
      }
      const [columns] = await connection.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION`,
        [process.env.E2E_DB_NAME, table],
      );
      tables.push({ table, exists: true, columns });
    }
    return { status: 'verified', database: process.env.E2E_DB_NAME, tables };
  } finally {
    await connection.end();
  }
}

const schema = await inspectSchemas();
const schemaByTable = new Map(schema.tables.map((entry) => [entry.table, entry]));

const routeMatrix = jobs.flatMap((job) =>
  job.businessLines.flatMap((plineForm) =>
    ['hour', 'day'].map((grain) => {
      const table =
        grain === 'hour' ? job.baseTable : job.baseTable?.replace(/_hour$/, '_day');
      const mapper = grain === 'hour' ? job.hourMapper : job.dayMapper;
      return {
        routeId: `${plineForm}|${job.dataType}|${job.releaseVersion}|${grain}`,
        plineForm,
        businessLine: plinesByEnum[
          Object.keys(plinesByEnum).find((key) => plinesByEnum[key].alias === plineForm)
        ]?.name,
        dataType: job.dataType,
        dataTypeName: job.dataTypeName,
        releaseVersion: job.releaseVersion,
        grain,
        table,
        tableExists: schemaByTable.get(table)?.exists ?? false,
        mapperStatement: mapper,
        mapperTables: xmlStatements[mapper]?.tables ?? [],
        formulaCount: xmlStatements[mapper]?.formulas.length ?? 0,
        source: `${files.service.replaceAll('\\', '/')}:${job.sourceLine}`,
      };
    }),
  ),
);

const formulaCatalog = Object.values(xmlStatements).flatMap((statement) =>
  statement.formulas.map((formula) => {
    const hourAlias = /^_data_h\d+_/i.test(formula.alias);
    const metric = metrics
      .filter((entry) => {
        const column = entry.column.toLowerCase();
        const base = column.startsWith('hour_') ? column.slice('hour_'.length) : column;
        return formula.alias.toLowerCase().endsWith(`_${base}`);
      })
      .sort((a, b) => {
        const aHour = a.column.toLowerCase().startsWith('hour_');
        const bHour = b.column.toLowerCase().startsWith('hour_');
        const aScore = (aHour === hourAlias ? 1000 : 0) + a.column.length;
        const bScore = (bHour === hourAlias ? 1000 : 0) + b.column.length;
        return bScore - aScore;
      })[0];
    return {
      formulaId: `${statement.statementId}|${formula.alias}`,
      mapperStatement: statement.statementId,
      alias: formula.alias,
      metric: metric?.column,
      metricName: metric?.name,
      expression: formula.expression,
      source: `${files.mapperXml.replaceAll('\\', '/')}:${formula.sourceLine}`,
    };
  }),
);

function expectedAliases(timeType, reduceType, column) {
  const base = column.startsWith('hour_') ? column.slice('hour_'.length) : column;
  const day = (offset) => `_data_d${offset || ''}_${column}`;
  const recent = (count) => `_data_rd${count}_${column}`;
  const hour = (offset) => `_data_h${offset}_${base}`;
  if (timeType === '0') return [day(0)];
  if (['1', '2', '3', '6'].includes(timeType)) {
    return Array.from({ length: Number(timeType) }, (_, index) => hour(index + 1));
  }
  if (timeType === '53') return [hour(3), hour(4), hour(5)];
  if (timeType === '43') return [hour(3), hour(4)];
  const ranges = {
    '102': [2, 3, 4],
    '103': [4, 5, 6],
    '104': [5, 6, 7],
    '105': [6, 7, 8],
    '106': [7, 8, 9],
    '107': [8, 9, 10],
    '201': [1],
  };
  if (ranges[timeType]) return ranges[timeType].map(day);
  const recentCounts = { '101': 3, '202': 2, '204': 4, '205': 5, '206': 6, '207': 7 };
  if (recentCounts[timeType]) {
    const count = recentCounts[timeType];
    return reduceType === 'total'
      ? [recent(count)]
      : Array.from({ length: count }, (_, index) => day(index + 1));
  }
  if (timeType === '99') {
    return reduceType === 'total' ? [recent(2)] : [day(0), day(1)];
  }
  if (timeType === '100') {
    return reduceType === 'total' ? [recent(3)] : [day(0), day(1), day(2)];
  }
  return [];
}

function routeSupportsTime(route, timeType) {
  if (['1', '2', '3', '6', '53', '43'].includes(timeType)) return route.grain === 'hour';
  if (timeType !== '0') return route.grain === 'day';
  const isClient = ['syhplay', 'cltmain', 'cltplay'].includes(route.plineForm);
  if (isClient || route.releaseVersion === 3) return route.grain === 'day';
  return route.grain === 'hour';
}

const conditionMatrix = [];
for (const route of routeMatrix) {
  const statementFormulas = formulaCatalog.filter(
    (formula) => formula.mapperStatement === route.mapperStatement,
  );
  for (const timeRange of timeRanges.filter((entry) => routeSupportsTime(route, entry.value))) {
    for (const reduceType of reduceTypes) {
      for (const metric of metrics.filter((entry) => entry.businessLines.includes(route.plineForm))) {
        const aliases = expectedAliases(timeRange.value, reduceType.value, metric.column);
        if (!aliases.length) continue;
        const formulaPlans = aliases.map((alias) => {
          const formula = statementFormulas.find(
            (entry) => entry.alias.toLowerCase() === alias.toLowerCase(),
          );
          return {
            alias,
            found: Boolean(formula),
            expression: formula?.expression,
            evidence: formula?.source,
          };
        });
        const missingAliases = formulaPlans.filter((entry) => !entry.found).map((entry) => entry.alias);
        conditionMatrix.push({
          conditionKey: [
            route.plineForm,
            route.dataType,
            route.releaseVersion,
            timeRange.value,
            reduceType.value,
            metric.column,
          ].join('|'),
          plineForm: route.plineForm,
          dataType: route.dataType,
          releaseVersion: route.releaseVersion,
          grain: route.grain,
          timeType: timeRange.value,
          timeName: timeRange.description,
          reduceType: reduceType.value,
          reduceName: reduceType.name,
          compareTypes: compareTypes.map((entry) => entry.value),
          metric: metric.column,
          metricName: metric.name,
          table: route.table,
          tableExists: route.tableExists,
          mapperStatement: route.mapperStatement,
          formulaPlans,
          missingAliases,
          status: route.tableExists && !missingAliases.length ? 'candidate' : 'blocked',
        });
      }
    }
  }
}

const unresolved = {
  routesWithoutMapper: routeMatrix.filter((entry) => !entry.mapperStatement),
  routesWithMissingTable: routeMatrix.filter((entry) => !entry.tableExists),
  metricsWithoutFormula: metrics.filter(
    (metric) => !formulaCatalog.some((formula) => formula.metric === metric.column),
  ),
  formulasWithoutMetric: formulaCatalog.filter((formula) => !formula.metric),
  conditionRowsMissingFormula: conditionMatrix.filter((entry) => entry.missingAliases.length),
  duplicateRouteKeys: Object.entries(
    routeMatrix.reduce((result, entry) => {
      (result[entry.routeId] ??= []).push(entry);
      return result;
    }, {}),
  )
    .filter(([, entries]) => entries.length > 1)
    .map(([routeId, entries]) => ({ routeId, entries })),
};

const capturedAt = new Date().toISOString();
const sourceDigest = digest(
  Object.entries(files).map(([key, file]) => ({
    key,
    source: file.replaceAll('\\', '/'),
    digest: digest(fs.readFileSync(file)),
  })),
);
const summary = {
  capturedAt,
  sourceDigest,
  businessLines: unique(jobs.flatMap((job) => job.businessLines)).length,
  dataTypes: dataTypes.length,
  jobBranches: jobs.length,
  routeRows: routeMatrix.length,
  timeRanges: timeRanges.length,
  reduceTypes: reduceTypes.length,
  compareTypes: compareTypes.length,
  metrics: metrics.length,
  formulaRows: formulaCatalog.length,
  conditionRows: conditionMatrix.length,
  schemaStatus: schema.status,
  unresolved: Object.fromEntries(
    Object.entries(unresolved).map(([key, entries]) => [key, entries.length]),
  ),
};

writeJson('manifest.json', summary);
writeJson('business-lines.json', Object.values(plinesByEnum));
writeJson('dimension-subjects.json', dataTypes);
writeJson('release-versions.json', [
  { value: 'any', meaning: 'Job 分支未限制 release_ver' },
  { value: 'not-3', meaning: '标准路径，明确排除 release_ver=3' },
  { value: 3, meaning: '全域投放 ROI3 专用路径' },
]);
writeJson('time-ranges.json', { timeRanges, reduceTypes, compareTypes });
writeJson('metrics.json', metrics);
writeJson('job-branches.json', jobs);
writeJson('dimension-route-matrix.json', routeMatrix);
writeJson('formula-catalog.json', formulaCatalog);
writeJson('condition-formula-matrix.json', conditionMatrix);
writeJson('schema-snapshot.json', schema);
writeJson('unresolved.json', unresolved);

const markdown = [
  '# 广告管控 Job 全链路候选知识矩阵',
  '',
  `- 扫描时间：${capturedAt}`,
  `- 来源摘要：\`${sourceDigest}\``,
  `- 业务线：${summary.businessLines}`,
  `- Job 分支：${summary.jobBranches}`,
  `- 维度/版本/粒度路由：${summary.routeRows}`,
  `- 时间范围：${summary.timeRanges}`,
  `- 指标枚举：${summary.metrics}`,
  `- Mapper 公式：${summary.formulaRows}`,
  `- 条件矩阵行：${summary.conditionRows}`,
  '',
  '## 未决项',
  '',
  ...Object.entries(summary.unresolved).map(([key, count]) => `- ${key}: ${count}`),
  '',
  '> 本目录是候选快照。表路由、公式和 schema 未完成唯一闭环前，不得 Promote 为正式 Seed 知识。',
  '',
];
fs.writeFileSync(path.join(outputDir, 'README.md'), `${markdown.join('\n')}\n`);

const routeMarkdown = [
  '# 管控维度：业务线 × 维度主体 × 投放版本 × 表',
  '',
  '| 业务线 | 维度主体 | 投放版本 | 粒度 | 事实表 | Mapper | Schema |',
  '|---|---|---|---|---|---|---|',
  ...routeMatrix.map(
    (entry) =>
      `| ${entry.businessLine}(\`${entry.plineForm}\`) | ${entry.dataTypeName}(\`${entry.dataType}\`) | ${entry.releaseVersion} | ${entry.grain} | \`${entry.table}\` | \`${entry.mapperStatement ?? '未解析'}\` | ${entry.tableExists ? '存在' : '缺失'} |`,
  ),
  '',
];
fs.writeFileSync(
  path.join(outputDir, 'dimension-route-matrix.md'),
  `${routeMarkdown.join('\n')}\n`,
);

const formulaMarkdown = [
  '# 管控指标：Mapper 计算公式目录',
  '',
  '| Mapper | 结果别名 | 指标 | 公式 | 代码证据 |',
  '|---|---|---|---|---|',
  ...formulaCatalog.map(
    (entry) =>
      `| \`${entry.mapperStatement}\` | \`${entry.alias}\` | \`${entry.metric ?? '未映射'}\` | \`${entry.expression.replaceAll('|', '\\|')}\` | ${entry.source} |`,
  ),
  '',
];
fs.writeFileSync(
  path.join(outputDir, 'formula-catalog.md'),
  `${formulaMarkdown.join('\n')}\n`,
);

const supportGroups = new Map();
for (const entry of conditionMatrix) {
  const key = [entry.plineForm, entry.dataType, entry.releaseVersion, entry.metric].join('|');
  const group = supportGroups.get(key) ?? {
    plineForm: entry.plineForm,
    dataType: entry.dataType,
    releaseVersion: entry.releaseVersion,
    metric: entry.metric,
    metricName: entry.metricName,
    tables: new Set(),
    supported: 0,
    blocked: 0,
  };
  group.tables.add(entry.table);
  group[entry.status === 'candidate' ? 'supported' : 'blocked'] += 1;
  supportGroups.set(key, group);
}
const supportMarkdown = [
  '# 管控条件支持汇总',
  '',
  '完整逐行数据位于 `condition-formula-matrix.json`。',
  '',
  '| 业务线 | 维度 | 投放版本 | 指标 | 表 | 公式完整组合 | 缺公式组合 |',
  '|---|---|---|---|---|---:|---:|',
  ...[...supportGroups.values()].map(
    (entry) =>
      `| \`${entry.plineForm}\` | \`${entry.dataType}\` | ${entry.releaseVersion} | ${entry.metricName}(\`${entry.metric}\`) | ${[...entry.tables].map((table) => `\`${table}\``).join('<br>')} | ${entry.supported} | ${entry.blocked} |`,
  ),
  '',
];
fs.writeFileSync(
  path.join(outputDir, 'condition-support-summary.md'),
  `${supportMarkdown.join('\n')}\n`,
);

if (process.argv[2] === 'promote') {
  const args = Object.fromEntries(
    process.argv.slice(3)
      .filter((value) => value.startsWith('--'))
      .map((value) => {
        const [key, ...rest] = value.slice(2).split('=');
        return [key, rest.join('=')];
      }),
  );
  const expected = Number(args.expected || 6255);
  const approvedBy = args.approvedBy || 'user';
  const reason = args.reason || '批准 6255 条广告管控公式闭环组合正式入库';
  const verifiedRows = conditionMatrix
    .filter((entry) => entry.status === 'candidate')
    .map((entry) => ({
      ...entry,
      status: 'verified',
      promotedAt: capturedAt,
      approvedBy,
    }));
  if (verifiedRows.length !== expected) {
    throw new Error(
      `PROMOTION_COUNT_MISMATCH: expected=${expected}, actual=${verifiedRows.length}`,
    );
  }
  if (verifiedRows.some((entry) => !entry.tableExists || entry.missingAliases.length)) {
    throw new Error('PROMOTION_NOT_CLOSED_LOOP: verified rows contain missing table/formula');
  }

  const formalDir = path.join(
    workspace,
    '.cursor/skills/domains/ad-control/knowledge/compiled/job-chain',
  );
  fs.mkdirSync(formalDir, { recursive: true });
  const verifiedRouteIds = new Set(
    verifiedRows.map((entry) =>
      [entry.plineForm, entry.dataType, entry.releaseVersion, entry.grain].join('|'),
    ),
  );
  const verifiedRoutes = routeMatrix
    .filter((entry) => verifiedRouteIds.has(entry.routeId))
    .map((entry) => ({ ...entry, status: 'verified' }));
  const verifiedFormulaMap = new Map();
  for (const entry of verifiedRows) {
    for (const plan of entry.formulaPlans) {
      const key = `${entry.mapperStatement}|${plan.alias}|${plan.expression}`;
      verifiedFormulaMap.set(key, {
        formulaId: key,
        mapperStatement: entry.mapperStatement,
        alias: plan.alias,
        expression: plan.expression,
        evidence: plan.evidence,
        status: 'verified',
      });
    }
  }
  const verifiedFormulas = [...verifiedFormulaMap.values()];
  const formalVersion = digest({
    sourceDigest,
    verifiedRows,
    verifiedRoutes,
    verifiedFormulas,
  });
  const formalManifest = {
    schemaVersion: 1,
    version: formalVersion,
    sourceDigest,
    promotedAt: capturedAt,
    approvedBy,
    reason,
    verifiedConditionRows: verifiedRows.length,
    verifiedRoutes: verifiedRoutes.length,
    verifiedFormulas: verifiedFormulas.length,
    rejectedCandidateRows: conditionMatrix.length - verifiedRows.length,
    files: {
      conditionMatrix: 'condition-formula-matrix.json',
      routes: 'dimension-route-matrix.json',
      formulas: 'formula-catalog.json',
    },
  };
  fs.writeFileSync(
    path.join(formalDir, 'manifest.json'),
    `${JSON.stringify(formalManifest, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(formalDir, 'condition-formula-matrix.json'),
    `${JSON.stringify(verifiedRows, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(formalDir, 'dimension-route-matrix.json'),
    `${JSON.stringify(verifiedRoutes, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(formalDir, 'formula-catalog.json'),
    `${JSON.stringify(verifiedFormulas, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(formalDir, 'README.md'),
    `# 广告管控 Job 正式公式知识\n\n- 版本：\`${formalVersion}\`\n- verified 条件公式组合：${verifiedRows.length}\n- verified 路由：${verifiedRoutes.length}\n- verified 去重公式：${verifiedFormulas.length}\n- 批准人：${approvedBy}\n- 理由：${reason}\n\n未闭环候选没有进入本目录。\n`,
  );
  fs.appendFileSync(
    path.join(
      workspace,
      '.cursor/skills/domains/ad-control/evidence/knowledge-promotions.jsonl',
    ),
    `${JSON.stringify({
      type: 'job-chain-formula-matrix',
      version: formalVersion,
      approvedBy,
      reason,
      approvedAt: capturedAt,
      verifiedConditionRows: verifiedRows.length,
      sourceDigest,
    })}\n`,
  );
  execFileSync(
    process.execPath,
    [path.join(workspace, 'scripts/ad-control-knowledge.mjs'), 'compile'],
    { cwd: workspace, stdio: 'inherit' },
  );
  console.log(`promoted=${formalVersion}\nverifiedConditionRows=${verifiedRows.length}`);
}
console.log(JSON.stringify(summary, null, 2));
