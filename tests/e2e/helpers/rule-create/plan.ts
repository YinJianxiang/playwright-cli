import fs from 'node:fs';
import path from 'node:path';
import type {
  PlannedField,
  RuleCreatePlan,
  RuleCreateRequest,
  RuleCreationKnowledge,
} from './types';

const KNOWLEDGE_ROOT = path.resolve('.cursor/skills/domains/ad-control/knowledge');

const DEFAULT_LABELS: Record<string, string> = {
  miniProgramType: '小程序类型',
  media: '媒体',
  subject: '主体',
  owner: '负责人',
  createTime: '创建时间',
  selfAgency: '自投',
  dramaShelfTime: '短剧上架时间',
  bookFilter: '单书/剧数据筛选',
  isComic: '是否漫画',
  bidStrategy: '出价策略',
  isNewBook: '是否新书',
  adStatus: '广告状态',
};

function readJson(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_ROOT, name), 'utf8'));
}

export function loadRuleCreationKnowledge(): RuleCreationKnowledge {
  const dimensions = readJson('dimensions.json');
  const conditions = readJson('conditions.json');
  const actions = readJson('actions.json');
  const verifiedMetrics = new Set<string>();
  const standaloneBlockedMetrics = new Set<string>();
  for (const entry of conditions.entries ?? []) {
    if (entry.status !== 'verified') continue;
    verifiedMetrics.add(entry.name);
    const metric = entry.seed?.metric;
    if (metric?.column) verifiedMetrics.add(metric.column);
    if (metric?.desc) {
      verifiedMetrics.add(metric.desc);
      verifiedMetrics.add(String(metric.desc).replace(/^(当日|当天|近\d+(小时|天)|累计)/, ''));
    }
    for (const alias of metric?.uiAliases ?? []) verifiedMetrics.add(String(alias));
    if (metric?.seedPolicy?.standaloneRule === 'blocked') {
      for (const value of [entry.name, metric?.column, metric?.desc, ...(metric?.uiAliases ?? [])].filter(Boolean)) {
        standaloneBlockedMetrics.add(String(value));
      }
    }
  }
  return {
    verifiedDefaults: dimensions.uiDefaults ?? {},
    optionalLabels: Object.values(DEFAULT_LABELS),
    verifiedMetrics,
    verifiedActions: new Set(
      (actions.entries ?? []).filter((entry: any) => entry.status === 'verified').map((entry: any) => entry.name),
    ),
    standaloneBlockedMetrics,
  };
}

function renderMarkdown(plan: Omit<RuleCreatePlan, 'markdown'>): string {
  const lines = [
    '# 广告管控规则创建计划',
    '',
    `- 状态：${plan.status}`,
    `- 项目：${plan.request.projectName ?? '页面上下文决定'}`,
    `- 渠道：${plan.request.channel || '未指定'}`,
    `- 业务线：${plan.request.businessLine || '缺失'}`,
    `- 管控维度：${plan.request.controlDimension || '缺失'}`,
    '',
    '## 用户明确字段',
    ...plan.explicitFields.map((field) => `- ${field.label}：${String(field.value)}`),
    '',
    '## 系统补充的必填字段',
    ...(plan.supplementedFields.length
      ? plan.supplementedFields.map((field) => `- ${field.label}：${String(field.value)}（${field.reason}）`)
      : ['- 无']),
    '',
    '## 管控条件',
    ...plan.request.conditions.map(
      (condition, index) =>
        `- ${index + 1}. ${condition.timeRange} / ${condition.metric} / ${condition.aggregateType ?? '页面默认'} / ${condition.compareType} / ${condition.val1}${condition.val2 === undefined ? '' : `～${condition.val2}`}`,
    ),
    '',
    `- 管控动作：${JSON.stringify(plan.request.actions ?? {})}`,
    `- 保持不填的可选字段：${plan.omittedOptionalFields.join('、') || '无'}`,
    '- 创建后：仅返回 ruleId 和 ui-flow-db handoff，不自动造数。',
  ];
  if (plan.issues.length) {
    lines.push('', '## 阻断项', ...plan.issues.map((issue) => `- ${issue.code}：${issue.message}`));
  }
  return lines.join('\n');
}

export function buildRuleCreatePlan(
  request: RuleCreateRequest,
  knowledge = loadRuleCreationKnowledge(),
): RuleCreatePlan {
  const issues: RuleCreatePlan['issues'] = [];
  if (!request.controlDimension?.trim()) issues.push({ code: 'CONTROL_DIMENSION_REQUIRED', field: 'controlDimension', message: '管控维度必填' });
  if (!request.businessLine?.trim()) issues.push({ code: 'BUSINESS_LINE_REQUIRED', field: 'businessLine', message: '业务线必填' });
  if (!request.conditions?.length) issues.push({ code: 'CONDITION_REQUIRED', field: 'conditions', message: '至少需要一个指标条件' });
  request.conditions?.forEach((condition, index) => {
    if (!condition.metric?.trim()) issues.push({ code: 'METRIC_REQUIRED', field: `conditions[${index}].metric`, message: `第 ${index + 1} 条条件缺少指标` });
    else if (!knowledge.verifiedMetrics.has(condition.metric)) issues.push({ code: 'METRIC_KNOWLEDGE_UNKNOWN', field: `conditions[${index}].metric`, message: `指标“${condition.metric}”没有 verified 知识映射` });
  });
  if (request.conditions?.length === 1 && knowledge.standaloneBlockedMetrics.has(request.conditions[0].metric)) {
    issues.push({
      code: 'METRIC_STANDALONE_BLOCKED',
      field: 'conditions[0].metric',
      message: `指标“${request.conditions[0].metric}”不能作为唯一条件，请补充一个可聚合指标条件`,
    });
  }

  const explicitFields: PlannedField[] = [
    { label: '管控维度', value: request.controlDimension, source: 'user' },
    { label: '业务线', value: request.businessLine, source: 'user' },
    ...Object.entries(request.dimensionValues ?? {}).map(([label, value]) => ({ label, value, source: 'user' as const })),
    ...(request.projectName ? [{ label: '项目', value: request.projectName, source: 'user' as const }] : []),
    ...(request.channel ? [{ label: '渠道', value: request.channel, source: 'user' as const }] : []),
  ];
  const explicitLabels = new Set(explicitFields.map((field) => field.label));
  const supplementedFields = Object.entries(knowledge.verifiedDefaults)
    .filter(([key]) => !explicitLabels.has(DEFAULT_LABELS[key] ?? key))
    .map(([key, value]) => ({
      label: DEFAULT_LABELS[key] ?? key,
      value,
      source: 'verified-default' as const,
      reason: '仅在页面显示为必填且当前为空时使用',
    }));
  const status = issues.length ? 'blocked' : 'confirmation-required';
  const base = {
    version: 1 as const,
    status,
    request,
    explicitFields,
    supplementedFields,
    omittedOptionalFields: knowledge.optionalLabels.filter((label) => !explicitLabels.has(label)),
    issues,
  };
  return { ...base, markdown: renderMarkdown(base) };
}

export function confirmRuleCreatePlan(plan: RuleCreatePlan): RuleCreatePlan {
  if (plan.status === 'blocked') throw new Error(`RULE_CREATE_PLAN_BLOCKED: ${plan.issues.map((i) => i.code).join(',')}`);
  return { ...plan, status: 'confirmed', markdown: plan.markdown.replace('状态：confirmation-required', '状态：confirmed') };
}
