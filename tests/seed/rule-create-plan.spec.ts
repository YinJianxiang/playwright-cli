import { expect, test } from '@playwright/test';
import { buildRuleCreatePlan, confirmRuleCreatePlan, type RuleCreationKnowledge } from '../e2e/helpers/rule-create';

const knowledge: RuleCreationKnowledge = {
  verifiedDefaults: { media: '不限', owner: '不限' },
  optionalLabels: ['媒体', '负责人', '转化目标'],
  verifiedMetrics: new Set(['消耗', 'consume', 'ROI']),
  verifiedActions: new Set(['预警']),
  standaloneBlockedMetrics: new Set(['模型预测ROI']),
};

const request = () => ({
  projectName: '新媒体-免费短剧',
  channel: '竞价投放',
  businessLine: '手动投放',
  controlDimension: '项目',
  conditions: [{ timeRange: '当天', metric: '消耗', aggregateType: '累计', compareType: '大于等于', val1: 50 }],
});

test('requires control dimension, business line and a metric', () => {
  const plan = buildRuleCreatePlan({ ...request(), controlDimension: '', conditions: [] }, knowledge);
  expect(plan.status).toBe('blocked');
  expect(plan.issues.map((issue) => issue.code)).toEqual(['CONTROL_DIMENSION_REQUIRED', 'CONDITION_REQUIRED']);
});

test('channel is optional', () => {
  const { channel: _channel, ...withoutChannel } = request();
  expect(buildRuleCreatePlan(withoutChannel, knowledge).status).toBe('confirmation-required');
});

test('blocks metrics absent from verified knowledge', () => {
  const plan = buildRuleCreatePlan({ ...request(), conditions: [{ ...request().conditions[0], metric: '未知指标' }] }, knowledge);
  expect(plan.status).toBe('blocked');
  expect(plan.issues[0].code).toBe('METRIC_KNOWLEDGE_UNKNOWN');
});

test('blocks metrics that cannot be used as the only condition', () => {
  const plan = buildRuleCreatePlan({ ...request(), conditions: [{ ...request().conditions[0], metric: '模型预测ROI' }] }, knowledge);
  expect(plan.status).toBe('blocked');
  expect(plan.issues.map((issue) => issue.code)).toContain('METRIC_STANDALONE_BLOCKED');
});

test('keeps user values above defaults and leaves optional fields omitted', () => {
  const plan = buildRuleCreatePlan({ ...request(), dimensionValues: { 媒体: '头条媒体' } }, knowledge);
  expect(plan.status).toBe('confirmation-required');
  expect(plan.explicitFields).toContainEqual({ label: '媒体', value: '头条媒体', source: 'user' });
  expect(plan.supplementedFields.some((field) => field.label === '媒体')).toBe(false);
  expect(plan.omittedOptionalFields).toContain('转化目标');
});

test('orders upstream linkage fields before dependent project and channel fields', () => {
  const plan = buildRuleCreatePlan({ ...request(), dimensionValues: { 投放版本: '全域投放' } }, knowledge);
  expect(plan.explicitFields.map((field) => field.label)).toEqual([
    '管控维度', '业务线', '投放版本', '项目', '渠道',
  ]);
});

test('requires explicit confirmation before UI execution', () => {
  const plan = buildRuleCreatePlan(request(), knowledge);
  expect(plan.status).toBe('confirmation-required');
  expect(confirmRuleCreatePlan(plan).status).toBe('confirmed');
  expect(plan.markdown).toContain('当天 / 消耗 / 累计 / 大于等于 / 50');
});

test('blocked plan cannot be confirmed', () => {
  const plan = buildRuleCreatePlan({ ...request(), businessLine: '' }, knowledge);
  expect(() => confirmRuleCreatePlan(plan)).toThrow('RULE_CREATE_PLAN_BLOCKED');
});
