import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const marketJobRoot = path.resolve(
  process.env.MARKET_JOB_ROOT || path.join(repoRoot, '../market-job/market-job'),
);
const sourceRoot = path.join(marketJobRoot, 'src/main');
const modelFile = path.join(
  sourceRoot,
  'java/com/dz/glory/job/model/DataControlRule.java',
);
const outputDir = path.join(
  repoRoot,
  '.cursor/skills/domains/ad-control/evidence/job-rule-mapping',
);

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(java|xml)$/.test(entry.name) ? [full] : [];
  });
}

function snake(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function getter(field) {
  return `get${field[0].toUpperCase()}${field.slice(1)}`;
}

function cleanComment(lines) {
  return lines
    .join(' ')
    .replace(/^\s*\/\*+|\*+\/\s*$/g, '')
    .replace(/^\s*\/\//, '')
    .replace(/\s*\*\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFields(source) {
  const lines = source.split(/\r?\n/);
  const fields = [];
  let depth = 0;
  let classSeen = false;
  let comment = [];
  let tableField;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const before = depth;
    if (!classSeen && /class\s+DataControlRule\b/.test(line)) classSeen = true;
    if (classSeen && before === 1) {
      if (/^\s*\/\*\*/.test(line)) comment = [line];
      else if (comment.length && !comment.at(-1).includes('*/')) comment.push(line);
      const annotation = line.match(/@TableField\("([^"]+)"\)/);
      if (annotation) tableField = annotation[1];
      const match = line.match(
        /^\s*private\s+(?!static\b)([A-Za-z0-9_<>,.?\[\] ]+)\s+([A-Za-z][A-Za-z0-9_]*)\s*(?:=[^;]+)?;/,
      );
      if (match) {
        const name = match[2];
        fields.push({
          name,
          ruleColumn: tableField || snake(name),
          javaType: match[1].trim(),
          description: cleanComment(comment),
          declaration: {
            file: path.relative(marketJobRoot, modelFile).replaceAll('\\', '/'),
            line: index + 1,
          },
          getter: getter(name),
        });
        comment = [];
        tableField = undefined;
      } else if (
        line.trim() &&
        !line.trim().startsWith('@') &&
        !line.trim().startsWith('*') &&
        !line.trim().startsWith('/*') &&
        !line.trim().startsWith('//')
      ) {
        if (!comment.at(-1)?.includes('*/')) comment = [];
      }
    }
    depth += (line.match(/{/g) || []).length;
    depth -= (line.match(/}/g) || []).length;
  }
  return fields;
}

const sqlStopWords = new Set([
  'and', 'or', 'in', 'is', 'not', 'null', 'where', 'having', 'like', 'find_in_set',
  'true', 'false', 'select', 'from', 'as', 'on', 'if', 'else', 'equals', 'append',
]);

function sqlColumns(context) {
  const quoted = [...context.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
  const candidates = new Set();
  for (const text of quoted) {
    for (const match of text.matchAll(/\b[a-z][a-z0-9_]*\b/g)) {
      const value = match[0];
      if (value.includes('_') && !sqlStopWords.has(value)) candidates.add(value);
    }
  }
  return [...candidates].sort();
}

function usageKind(context, file) {
  if (/whereBy|havingByOrWhere|where\s|having\s/i.test(context)) return 'sql-predicate';
  if (/removeIf|isSkip|filter|qualified|cacheBook/i.test(context)) return 'program-filter';
  if (/scanData|calTable|TableDimension|releaseVer|plineForm|dataType/.test(context)) return 'routing';
  if (/doType|Action|execute|pause|budget|copy|material/i.test(context)) return 'action';
  if (/fillRuleField|control_|log|record/i.test(context) || /Log\.java$/.test(file)) return 'audit-log';
  return 'business-logic';
}

function scanUsages(field, files) {
  const uses = [];
  const tokenPattern = new RegExp(
    `(?:\\b(?:rule|dataControlRule|controlRule|r)\\s*\\.|getRule\\(\\)\\s*\\.)${field.getter}\\s*\\(`,
  );
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('DataControlRule')) continue;
    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!tokenPattern.test(lines[index])) continue;
      const start = Math.max(0, index - 4);
      const end = Math.min(lines.length, index + 5);
      const context = lines.slice(start, end).join('\n');
      uses.push({
        file: path.relative(marketJobRoot, file).replaceAll('\\', '/'),
        line: index + 1,
        kind: usageKind(context, file),
        targetColumns: sqlColumns(context).filter((column) => column !== field.ruleColumn),
        code: lines[index].trim(),
        context: lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 2)).join('\n').trim(),
      });
    }
  }
  return uses;
}

function parseResultMap(xml) {
  const mappings = new Map();
  for (const match of xml.matchAll(/<result\s+column="([^"]+)"\s+property="([^"]+)"/g)) {
    if (!mappings.has(match[2])) mappings.set(match[2], match[1]);
  }
  return mappings;
}

function relationship(field, usages) {
  const targets = [...new Set(usages.flatMap((usage) => usage.targetColumns))].sort();
  const kinds = [...new Set(usages.map((usage) => usage.kind))].sort();
  let relationType = 'unresolved';
  if (!usages.length) relationType = 'not-used-by-job';
  else if (kinds.includes('sql-predicate')) relationType = 'predicate';
  else if (kinds.includes('program-filter')) relationType = 'program-filter';
  else if (kinds.includes('routing')) relationType = 'routing';
  else if (kinds.includes('action')) relationType = 'action-control';
  else if (kinds.every((kind) => kind === 'audit-log')) relationType = 'audit-only';
  return { relationType, targetColumns: targets, usageKinds: kinds };
}

// 人工复核自 DataControlService.ruleBaseCondition2Where、addLatestMetricToHavingCondition、
// promotionOrProjectStatus 与 confirmDataControlLogs。这里只描述 Job 现状，不代表已 promote。
const semanticRelations = {
  id: { role: 'rule-identity', factFields: [], mapping: '作为 ruleId、日志和频控 key，不过滤事实表' },
  name: { role: 'rule-metadata', factFields: [], mapping: '仅用于日志和展示' },
  dataType: { role: 'routing', factFields: ['promotion_id', 'project_id', 'channel_code', 'agent_user_name'], mapping: '决定扫描维度、分组键和动作对象' },
  plineForm: { role: 'routing-and-direct', factFields: ['pline_form'], mapping: '决定扫描函数/事实表，并写入 pline_form 条件' },
  videoType: { role: 'direct-predicate', factFields: ['video_type'], mapping: '非 -1 时 video_type = rule.videoType' },
  media: { role: 'rule-eligibility', factFields: [], mapping: '当前广告管控调度仅选择 MediaEnum.TT；ruleBaseCondition2Where 明确注释 media 暂时只支持头条，未追加事实表 media WHERE' },
  releaseVer: { role: 'routing-and-conditional-predicate', factFields: ['release_ver'], mapping: '决定 ROI3/普通表路由；特定业务线、渠道/项目维度且值为 1/2 时追加 release_ver 等值过滤' },
  osType: { role: 'direct-predicate', factFields: ['os_type'], mapping: '非 -1 时 os_type = rule.osType' },
  effectScope: { role: 'predicate-transform', factFields: ['service_provider_name'], mapping: '1=自投：服务商为空/无；2=服务商：按 serviceProviderNames IN 或非空非无' },
  roiCoefficientMin: { role: 'having-boundary', factFields: ['roi_goal'], mapping: '非 -10 时 roi_goal > min' },
  roiCoefficientMax: { role: 'having-boundary', factFields: ['roi_goal'], mapping: '非 -10 时 roi_goal < max；仅 max 时同时要求 roi_goal > 0' },
  budgetMin: { role: 'having-boundary', factFields: ['project_budget'], mapping: '非空时 project_budget > min' },
  budgetMax: { role: 'having-boundary', factFields: ['project_budget'], mapping: '非空时 project_budget < max' },
  serviceProviderNames: { role: 'list-predicate', factFields: ['service_provider_name'], mapping: 'effectScope=2 且非 -1 时 service_provider_name IN 列表' },
  mediaFree: { role: 'list-predicate', factFields: ['media_free'], mapping: '非 -1 时 media_free IN 列表' },
  putMode: { role: 'value-transform-predicate', factFields: ['put_mode'], mapping: '通过 PutModeEnum.getDescByValue 转为事实表中文值后等值过滤' },
  channelUsers: { role: 'list-or-derived-predicate', factFields: ['agent_user_name'], mapping: '不限不筛；本部门全部按 creator 查部门人员；否则 agent_user_name IN 显式列表' },
  deepExternalAction: { role: 'dynamic-field-predicate', factFields: ['advert_target', 'deep_conversion_type', 'deep_external_action'], mapping: 'syhplay 渠道→advert_target、其他维度→deep_conversion_type；其他业务→deep_external_action；次日留存转为次留' },
  deliveryMode: { role: 'direct-predicate', factFields: ['delivery_mode'], mapping: '非 -1/不限时等值；doType=ROI_UPDATE 时强制自动投放' },
  placementMode: { role: 'list-predicate', factFields: ['placement_mode'], mapping: '非 -1/不限时 placement_mode IN 列表' },
  isAnime: { role: 'direct-predicate', factFields: ['is_anime'], mapping: '非 -1 时等值过滤' },
  bidType: { role: 'direct-predicate', factFields: ['bid_type'], mapping: '非 -1 时等值过滤' },
  appName: { role: 'list-or-prefix-predicate', factFields: ['app_name'], mapping: '客户端短剧使用 LIKE 前缀，其他业务使用 IN 列表' },
  bookId: { role: 'list-predicate', factFields: ['book_id'], mapping: '非 -1/不限时 book_id IN 列表' },
  channelPrefix: { role: 'prefix-predicate', factFields: ['channel_code'], mapping: '每个前缀生成 channel_code LIKE prefix%' },
  dramaType: { role: 'list-predicate', factFields: ['drama_type'], mapping: '非 -1/不限时 drama_type IN 列表' },
  animeType: { role: 'csv-membership-predicate', factFields: ['anime_type'], mapping: '每个值生成 FIND_IN_SET(value, anime_type)' },
  externalAction: { role: 'direct-predicate', factFields: ['external_action'], mapping: '非 -1/不限时等值过滤' },
  accountType: { role: 'direct-predicate', factFields: ['account_type'], mapping: '非 -1 时 account_type = rule.accountType' },
  deliveryWay: { role: 'value-transform-predicate', factFields: ['delivery_way'], mapping: '1→自动订阅，2→常规投放；xmtplay 固定排除自动订阅' },
  bidStrategyId: { role: 'direct-predicate', factFields: ['bid_strategy_id'], mapping: '单个 ID 优先等值过滤' },
  bidStrategyIds: { role: 'list-predicate', factFields: ['bid_strategy_id'], mapping: '无单值且非 -1 时 bid_strategy_id IN 列表' },
  mainBodys: { role: 'list-predicate', factFields: ['main_body'], mapping: '非 -1/不限时 main_body IN 列表' },
  ignoreBookIds: { role: 'negative-list-predicate', factFields: ['book_id'], mapping: '非 -1 时 book_id NOT IN 列表' },
  effectiveBookIds: { role: 'list-predicate', factFields: ['book_id'], mapping: '非 -1 时 book_id IN 列表' },
  ignoreChannelCodes: { role: 'negative-list-predicate', factFields: ['channel_code'], mapping: '非 -1 时 channel_code NOT IN 列表' },
  ignoreAccounts: { role: 'negative-list-predicate', factFields: ['account'], mapping: '非 -1 时 account NOT IN 列表' },
  createTime: { role: 'dynamic-time-predicate', factFields: ['promotion_create_time', 'project_create_time', 'plan_create_time'], mapping: '按业务线与 dataType 选择时间字段并应用枚举时间范围' },
  optStatus: { role: 'dynamic-status-predicate', factFields: ['promotion_status', 'project_status', 'plan_status'], mapping: '按 dataType、plineForm 与小时/天阶段转换为启停状态谓词' },
  projectStatus: { role: 'dynamic-status-predicate', factFields: ['project_status'], mapping: '广告维度可附加项目状态；1=非暂停/删除，2=暂停' },
  isNewBook: { role: 'having-predicate', factFields: ['is_new_book'], mapping: '天粒度且非 -1 时 is_new_book 等值' },
  conditions: { role: 'metric-expression', factFields: [], mapping: '解析为时间范围、聚合方式、指标和比较条件；指标字段由 Mapper 公式矩阵决定' },
  bookUpType: { role: 'program-filter', factFields: ['book_id'], mapping: '扫描后按 book_id 查询上架日期缓存，判断当日/非当日/日期范围' },
  bookUpDays: { role: 'program-filter-parameter', factFields: ['book_id'], mapping: 'bookUpType=指定日期时作为开始边界' },
  bookUpDaysEnd: { role: 'program-filter-parameter', factFields: ['book_id'], mapping: 'bookUpType=指定日期时作为结束边界' },
  articleType: { role: 'program-filter', factFields: ['book_id'], mapping: '扫描后通过 book_id 的书籍缓存 articleType 比较，不直接要求事实表同名列' },
  sex: { role: 'program-filter', factFields: ['book_id'], mapping: '扫描后通过 book_id 的书籍缓存 sex 比较，不直接要求事实表同名列' },
  bookDataFilterFlag: { role: 'program-filter-switch', factFields: ['book_id'], mapping: '开启后按书维度聚合 consume/ROI 再过滤命中结果' },
  bookDataFilterConsume: { role: 'program-filter-threshold', factFields: ['book_id', 'consume'], mapping: '书维度数据过滤的消耗阈值' },
  bookDataFilterRoi: { role: 'program-filter-threshold', factFields: ['book_id'], mapping: '书维度 ROI 阈值' },
  bookDataFilterRoi3Day: { role: 'program-filter-threshold', factFields: ['book_id'], mapping: '书维度近三日 ROI 阈值' },
  status: { role: 'rule-eligibility', factFields: [], mapping: '仅 status=1 的规则进入执行' },
  effectiveDate: { role: 'schedule-gate', factFields: [], mapping: '当前日期不在配置集合时跳过规则' },
  skipHourRange: { role: 'schedule-gate', factFields: [], mapping: '当前小时处于跳过范围时跳过规则' },
  cycleType: { role: 'schedule-gate', factFields: [], mapping: '控制每30分钟/每小时/每2小时/固定时间执行' },
  runHours: { role: 'schedule-gate-parameter', factFields: [], mapping: 'cycleType=固定时间时声明执行小时集合' },
  rateLimitFlag: { role: 'rate-limit-switch', factFields: [], mapping: '开启 ruleId+实体ID Redis 频控' },
  rateLimitWindowHours: { role: 'rate-limit-parameter', factFields: [], mapping: 'Redis 频控窗口小时数' },
  rateLimitMaxCount: { role: 'rate-limit-parameter', factFields: [], mapping: '窗口内最大动作次数' },
  restartDisabledFlag: { role: 'action-guard', factFields: [], mapping: '与 bookDataFilterFlag 联合控制是否允许重新启用' },
  doType: { role: 'action-control', factFields: [], mapping: '决定预警、暂停、启用、复制、删广告、改预算、改ROI/CPA等动作；ROI更新额外限制 delivery_mode=自动投放' },
  emptyScheduleTime: { role: 'action-parameter', factFields: [], mapping: '清空/调整投放时段动作参数，不参与事实数据扫描条件' },
  emptyScheduleTimeToday: { role: 'action-parameter', factFields: [], mapping: '当日清空投放时段动作参数，不参与事实数据扫描条件' },
  budgetUpdate: { role: 'action-parameter', factFields: [], mapping: '预算调整动作配置，不作为扫描事实字段' },
  budgetChange: { role: 'action-parameter', factFields: [], mapping: '预算变化 JSON 动作配置，不作为扫描事实字段' },
  roiChange: { role: 'action-parameter', factFields: [], mapping: 'ROI 系数调整动作配置，不作为扫描事实字段' },
  cpaBidChange: { role: 'action-parameter', factFields: [], mapping: 'CPA 出价调整动作配置，不作为扫描事实字段' },
  creatorId: { role: 'rule-metadata', factFields: [], mapping: '创建人 ID，用于权限/审计，不作为事实扫描条件' },
  creator: { role: 'derived-filter-input', factFields: ['agent_user_name'], mapping: 'channelUsers=本部门全部时用 creator 查询部门人员集合，间接形成 agent_user_name IN 条件' },
  optUserName: { role: 'rule-metadata', factFields: [], mapping: '最新操作人，仅审计展示' },
  ctime: { role: 'rule-metadata', factFields: [], mapping: '规则创建时间，仅日志/审计回填' },
  utime: { role: 'rule-metadata', factFields: [], mapping: '规则更新时间，仅日志/审计回填' },
  raiseBudget: { role: 'action-parameter', factFields: [], mapping: '预算提升动作参数，不作为扫描事实条件' },
  raiseEndHour: { role: 'action-parameter', factFields: [], mapping: '预算提升结束小时，不作为扫描事实条件' },
  roiGoal: { role: 'action-parameter', factFields: ['roi_goal'], mapping: 'ROI 调整动作目标值；扫描中的 ROI 系数过滤由 roiCoefficientMin/Max 控制' },
  whereBy: { role: 'runtime-transient', factFields: [], mapping: '模型中的运行时动态 WHERE 载体，不是 ad_data_control_rule 业务输入映射' },
};

if (!fs.existsSync(modelFile)) {
  throw new Error(`DataControlRule.java not found: ${modelFile}`);
}

const sourceFiles = walk(sourceRoot);
const modelSource = fs.readFileSync(modelFile, 'utf8');
const resultMapFile = path.join(
  sourceRoot,
  'java/com/dz/glory/job/mapper/xml/DataControlMapper.xml',
);
const resultMap = parseResultMap(fs.readFileSync(resultMapFile, 'utf8'));
const fields = parseFields(modelSource).map((field) => {
  const usages = scanUsages(field, sourceFiles).filter(
    (usage) => !(usage.file.endsWith('DataControlRule.java') && usage.line === field.declaration.line),
  );
  const relation = relationship(field, usages);
  return {
    ...field,
    ruleColumn: resultMap.get(field.name) || field.ruleColumn,
    ...relation,
    semantic: semanticRelations[field.name] || {
      role: relation.relationType,
      factFields: relation.targetColumns,
      mapping: relation.relationType === 'not-used-by-job'
        ? '在广告管控 src/main 中未发现 DataControlRule getter 使用'
        : '已保留全部源码使用位置，尚未完成人工语义归纳',
    },
    usageCount: usages.length,
    usages,
  };
});

const sourceDigest = sha256(
  sourceFiles
    .sort()
    .map((file) => `${path.relative(marketJobRoot, file)}:${sha256(fs.readFileSync(file))}`)
    .join('\n'),
);
const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceRoot: sourceRoot.replaceAll('\\', '/'),
  sourceDigest,
  fieldCount: fields.length,
  fieldsWithUsage: fields.filter((field) => field.usageCount > 0).length,
  fieldsWithoutUsage: fields.filter((field) => field.usageCount === 0).length,
  relationCounts: Object.fromEntries(
    [...new Set(fields.map((field) => field.relationType))]
      .sort()
      .map((type) => [type, fields.filter((field) => field.relationType === type).length]),
  ),
};

const bundle = { ...summary, fields };
const markdown = [
  '# ad_data_control_rule → Job 字段关系全量扫描',
  '',
  `- 生成时间：${summary.generatedAt}`,
  `- 源码摘要：\`${summary.sourceDigest}\``,
  `- 规则字段：${summary.fieldCount}`,
  `- Job 中有使用：${summary.fieldsWithUsage}`,
  `- 未发现 Job 使用：${summary.fieldsWithoutUsage}`,
  '',
  '> 本报告是源码全量证据，不等于全部关系均已 verified。targetColumns 为空但有业务使用的字段必须人工核对。',
  '',
  '| 规则字段 | DB列 | 类型 | Job语义 | 事实/关联字段 | 使用数 | 映射关系 |',
  '|---|---|---|---|---|---:|---|',
  ...fields.map((field) =>
    `| \`${field.name}\` | \`${field.ruleColumn}\` | ${field.javaType} | ${field.semantic.role} | ${field.semantic.factFields.map((value) => `\`${value}\``).join(', ') || '-'} | ${field.usageCount} | ${field.semantic.mapping.replaceAll('|', '\\|')} |`,
  ),
  '',
  '## 逐字段使用位置',
  '',
  ...fields.flatMap((field) => [
    `### ${field.name} / ${field.ruleColumn}`,
    '',
    `- 关系：${field.semantic.role}`,
    `- 事实/关联字段：${field.semantic.factFields.join(', ') || '无直接事实字段'}`,
    `- 映射：${field.semantic.mapping}`,
    `- 使用次数：${field.usageCount}`,
    '',
    ...(field.usages.length
      ? field.usages.map((usage) =>
          `- \`${usage.file}:${usage.line}\` · ${usage.kind} · ${usage.code.replaceAll('|', '\\|')}`,
        )
      : ['- 未在 src/main Java/XML 中发现 getter 使用。']),
    '',
  ]),
].join('\n');

const unresolved = fields
  .filter((field) => field.semantic.mapping.includes('尚未完成人工语义归纳'))
  .map((field) => ({
    field: field.name,
    ruleColumn: field.ruleColumn,
    relationType: field.relationType,
    usageCount: field.usageCount,
    usages: field.usages.map(({ file, line, kind, code }) => ({ file, line, kind, code })),
  }));

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'rule-field-mapping.json'), `${JSON.stringify(bundle, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'rule-field-mapping.md'), `${markdown}\n`);
fs.writeFileSync(path.join(outputDir, 'unresolved.json'), `${JSON.stringify({ generatedAt: summary.generatedAt, fields: unresolved }, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, ...summary, unresolved: unresolved.length }, null, 2));
