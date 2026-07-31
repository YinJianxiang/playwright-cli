/**
 * 基线填表：load / merge / 上下文匹配。
 * 约定见 .cursor/skills/ui-flow-codegen/references/default-preferences.md（A/B/C）。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  getDimensionUiDefaults,
  getVerifiedActionKnowledge,
} from '../seed/knowledge-v3';

export type BaselineContextKey = {
  dimension: string;
  businessLine: string;
  deliveryVersion?: string;
};

/** B 层字段（机读 key → UI 文案值） */
export type BaselineFields = {
  miniProgramType?: string;
  media?: string;
  subject?: string;
  owner?: string;
  convertTarget?: string;
  adStatus?: string;
  projectStatus?: string;
  createTime?: string;
  selfAgency?: string;
  dramaShelfTime?: string;
  bookFilter?: string;
  isComic?: string;
  bidStrategy?: string;
  isNewBook?: string;
  action?: string;
  execCycle?: string;
  [key: string]: string | undefined;
};

export type BaselineContext = BaselineContextKey & {
  source?: 'explored' | 'inferred';
  fields: BaselineFields;
};

export type BaselineFillFile = {
  batch?: string;
  contexts: BaselineContext[];
};

/** ad-control 静态 defaults（与 ui.defaults.md 对齐的可机读子集） */
const dimensionDefaults = getDimensionUiDefaults();
const defaultAction = getVerifiedActionKnowledge();
const defaultActionUi = defaultAction.ui as {
  value?: string;
  defaultCycle?: string;
};

export const AD_CONTROL_FORM_DEFAULTS: BaselineFields = {
  ...dimensionDefaults,
  action: defaultActionUi.value,
  execCycle: defaultActionUi.defaultCycle,
};

export function contextKey(ctx: BaselineContextKey): string {
  return [ctx.dimension, ctx.businessLine, ctx.deliveryVersion || ''].join('|');
}

export function loadBaselineFill(batchRoot: string): BaselineFillFile {
  const file = path.join(batchRoot, 'explore', 'baseline-fill.json');
  if (!fs.existsSync(file)) {
    throw new Error(
      `缺少 explore/baseline-fill.json（suite=flow 门禁）。路径: ${file}`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as BaselineFillFile;
  if (!raw?.contexts?.length) {
    throw new Error(`baseline-fill.json 无 contexts: ${file}`);
  }
  return raw;
}

export function findBaselineContext(
  file: BaselineFillFile,
  key: BaselineContextKey,
): BaselineContext | undefined {
  const exact = contextKey(key);
  const hit = file.contexts.find((c) => contextKey(c) === exact);
  if (hit) return hit;
  // 无投放版本时允许 deliveryVersion 空匹配
  if (!key.deliveryVersion) {
    return file.contexts.find(
      (c) =>
        c.dimension === key.dimension &&
        c.businessLine === key.businessLine &&
        !c.deliveryVersion,
    );
  }
  // 放宽：同维度+业务线、版本缺省的 entry
  return file.contexts.find(
    (c) =>
      c.dimension === key.dimension &&
      c.businessLine === key.businessLine &&
      (c.deliveryVersion === key.deliveryVersion || !c.deliveryVersion),
  );
}

export function requireBaselineContext(
  file: BaselineFillFile,
  key: BaselineContextKey,
): BaselineContext {
  const hit = findBaselineContext(file, key);
  if (!hit) {
    throw new Error(
      `baseline-fill 无上下文 ${contextKey(key)}；请补 explore/baseline-fill.json`,
    );
  }
  return hit;
}

/**
 * merge：defaults < baseline.fields < matrixForm（后者覆盖）
 * 返回供 fill / log 使用的平面对象（含 A+B）。
 */
export function mergeForm<T extends Record<string, unknown>>(
  matrixForm: T,
  baselineFields: BaselineFields | undefined,
  defaults: BaselineFields = AD_CONTROL_FORM_DEFAULTS,
): T & BaselineFields & { _baselineSource?: string } {
  const dim = String(matrixForm.dimension ?? '');
  const projectStatusDefault =
    dim === '项目' ? '开启' : defaults.projectStatus ?? '不限';

  const layerDefaults: BaselineFields = {
    ...defaults,
    projectStatus: projectStatusDefault,
  };

  const merged = {
    ...layerDefaults,
    ...(baselineFields ?? {}),
    ...matrixForm,
  } as T & BaselineFields;

  // matrix 显式 undefined 不应抹掉 baseline；上面 spread 已处理
  return merged;
}

/** 有「不限」优先，否则用候选，否则 null */
export function pickPolicy(opts: {
  hasUnlimited: boolean;
  preferred?: string;
  options?: string[];
}): string | null {
  const { hasUnlimited, preferred, options } = opts;
  if (hasUnlimited) return '不限';
  if (preferred && (!options?.length || options.includes(preferred))) return preferred;
  if (options?.length) return options[0];
  return preferred ?? null;
}
