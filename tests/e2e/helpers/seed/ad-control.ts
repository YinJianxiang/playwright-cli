import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { execute, pingDb, query } from '../db';

/** Recipe A：新媒体-免费短剧 · 广告 · 当天 · 消耗 */
const RECIPE_A = {
  table: 'ad_advertiser_online_free_promotion_hour',
  plineForm: 'cpsvideomf',
  dataType: 'promotion',
  column: 'consume',
  promotionStatus: '投放中',
  projectStatus: '开启',
  account: 'e2e_dc_account',
  videoType: '2',
} as const;

export type SeedOpts = {
  /** 默认 hit：使 Job 对该 ruleId 能命中并写管控记录 */
  mode?: 'hit' | 'miss';
  /**
   * 是否已人工确认拟插入表单。
   * Agent 造数：必须先 plan → 展示表单 → 用户确认后再传 true。
   * Playwright 无人值守：传 true，或设环境变量 E2E_SEED_AUTO_CONFIRM=1。
   */
  confirmed?: boolean;
  /** 使用已确认的 plan（避免确认后重算导致 promotion_id 变化） */
  plan?: SeedPlan;
};

/** 拟插入行（表单字段） */
export type SeedPlanRow = {
  cdate: string;
  hour: string;
  pline_form: string;
  promotion_id: string;
  promotion_name: string;
  account: string;
  video_type: string;
  consume: number;
  promotion_status: string;
  project_status: string;
};

export type SeedPlan = {
  recipe: 'A';
  mode: 'hit';
  ruleId: string;
  table: string;
  compareType: string;
  threshold: number;
  /** 命中说明，便于确认时阅读 */
  hitHint: string;
  rows: SeedPlanRow[];
};

export type SeedResult = SeedPlan & {
  insertId: number;
  promotionId: string;
  cdate: string;
  hour: string;
  consume: number;
};

type RuleRow = RowDataPacket & {
  id: number;
  pline_form: string;
  data_type: string;
  conditions: string;
  opt_status: number | null;
  project_status: number | null;
};

type Condition = {
  timeType?: string;
  column?: string;
  reduceType?: string;
  compareType?: string;
  val1?: number;
  val2?: number;
};

/**
 * 只规划、不写库。Agent 应用 `formatSeedPlanForm` 展示后等用户确认。
 */
export async function planSeedViaDb(ruleId: string, opts?: SeedOpts): Promise<SeedPlan> {
  const mode = opts?.mode ?? 'hit';
  if (mode !== 'hit') {
    throw new Error(`planSeedViaDb: mode=${mode} 未实现（分册仅定义 hit Recipe A）`);
  }

  const ping = await pingDb();
  // eslint-disable-next-line no-console
  console.log(`DB_PING ok=${ping.ok} db=${ping.db} ruleId=${ruleId}`);

  const rules = await query<RuleRow[]>(
    `SELECT id, pline_form, data_type, conditions, opt_status, project_status
     FROM ad_data_control_rule WHERE id = ?`,
    [ruleId],
  );
  if (!rules.length) {
    throw new Error(`planSeedViaDb: rule id=${ruleId} not found in ad_data_control_rule`);
  }
  const rule = rules[0];
  assertRecipeA(rule);

  const cond = parseConsumeCondition(rule.conditions);
  const consume = computeHitConsume(cond.compareType, cond.val1, cond.val2);

  const clock = await query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS cdate, LPAD(HOUR(NOW()), 2, '0') AS hour`,
  );
  const cdate = String(clock[0].cdate);
  const hour = String(clock[0].hour);

  const promotionId = `e2e_dc_${ruleId}_${Date.now()}`;
  const promotionName = `e2e_dc_${ruleId}`;

  return {
    recipe: 'A',
    mode: 'hit',
    ruleId: String(ruleId),
    table: RECIPE_A.table,
    compareType: cond.compareType,
    threshold: cond.val1,
    hitHint: `规则条件 consume ${cond.compareType} ${cond.val1} → 拟写 consume=${consume}`,
    rows: [
      {
        cdate,
        hour,
        pline_form: RECIPE_A.plineForm,
        promotion_id: promotionId,
        promotion_name: promotionName,
        account: RECIPE_A.account,
        video_type: RECIPE_A.videoType,
        consume,
        promotion_status: RECIPE_A.promotionStatus,
        project_status: RECIPE_A.projectStatus,
      },
    ],
  };
}

/**
 * 将 SeedPlan 格式化为 Markdown 表单，供对话确认。
 */
export function formatSeedPlanForm(plan: SeedPlan): string {
  const lines: string[] = [
    `### 造数预览（Recipe ${plan.recipe} · ${plan.mode}）`,
    '',
    `| 项 | 值 |`,
    `|----|----|`,
    `| 规则 ID | ${plan.ruleId} |`,
    `| 目标表 | \`${plan.table}\` |`,
    `| 命中说明 | ${plan.hitHint} |`,
    `| 比较 | ${plan.compareType} ${plan.threshold} |`,
    `| 拟插入行数 | ${plan.rows.length} |`,
    '',
    `#### 拟 INSERT 字段`,
    '',
  ];

  for (let i = 0; i < plan.rows.length; i++) {
    const row = plan.rows[i];
    lines.push(`**行 ${i + 1}**`, '', `| 字段 | 值 |`, `|------|----|`);
    for (const [k, v] of Object.entries(row)) {
      lines.push(`| ${k} | ${typeof v === 'string' ? v : String(v)} |`);
    }
    lines.push('');
  }

  lines.push('请确认是否写入测试库？回复 **确认造数** / **取消**。');
  return lines.join('\n');
}

/**
 * 将已确认的 plan 写入库。
 */
export async function applySeedViaDb(plan: SeedPlan): Promise<SeedResult> {
  if (plan.recipe !== 'A' || plan.rows.length !== 1) {
    throw new Error('applySeedViaDb: 仅支持 Recipe A 单行');
  }
  const row = plan.rows[0];

  const result = await execute(
    `INSERT INTO ${plan.table}
      (cdate, hour, pline_form, promotion_id, promotion_name, account, video_type,
       consume, promotion_status, project_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.cdate,
      row.hour,
      row.pline_form,
      row.promotion_id,
      row.promotion_name,
      row.account,
      row.video_type,
      row.consume,
      row.promotion_status,
      row.project_status,
    ],
  );

  const seed: SeedResult = {
    ...plan,
    insertId: Number((result as ResultSetHeader).insertId),
    promotionId: row.promotion_id,
    cdate: row.cdate,
    hour: row.hour,
    consume: row.consume,
  };

  // eslint-disable-next-line no-console
  console.log(
    `SEED_OK recipe=A table=${seed.table} promotionId=${seed.promotionId} ` +
      `cdate=${seed.cdate} hour=${seed.hour} consume=${seed.consume} ` +
      `compare=${seed.compareType} threshold=${seed.threshold} insertId=${seed.insertId}`,
  );
  return seed;
}

/**
 * 造数入口。
 * - 交互：先 `planSeedViaDb` + `formatSeedPlanForm`，用户确认后 `seedViaDb(id, { confirmed: true, plan })`
 * - 自动化：`seedViaDb(id, { confirmed: true })` 或 `E2E_SEED_AUTO_CONFIRM=1`
 */
export async function seedViaDb(ruleId: string, opts?: SeedOpts): Promise<SeedResult> {
  const auto = process.env.E2E_SEED_AUTO_CONFIRM === '1' || process.env.E2E_SEED_AUTO_CONFIRM === 'true';
  const confirmed = opts?.confirmed === true || auto;
  if (!confirmed) {
    throw new Error(
      'seedViaDb: 未确认造数。请先 planSeedViaDb + formatSeedPlanForm 展示表单，' +
        '用户确认后调用 seedViaDb(ruleId, { confirmed: true, plan })；' +
        '或 Playwright 设 E2E_SEED_AUTO_CONFIRM=1 / opts.confirmed=true',
    );
  }

  const plan = opts?.plan ?? (await planSeedViaDb(ruleId, opts));
  if (plan.ruleId !== String(ruleId)) {
    throw new Error(`seedViaDb: plan.ruleId=${plan.ruleId} 与入参 ruleId=${ruleId} 不一致`);
  }
  return applySeedViaDb(plan);
}

/** 按造数结果清理本批事实行（06-cleanup） */
export async function cleanupSeedViaDb(
  seed: Pick<SeedResult, 'table' | 'promotionId' | 'cdate'>,
): Promise<number> {
  if (seed.table !== RECIPE_A.table) {
    throw new Error(`cleanupSeedViaDb: unsupported table ${seed.table}`);
  }
  const result = await execute(
    `DELETE FROM ${RECIPE_A.table}
     WHERE pline_form = ? AND promotion_id = ? AND cdate = ?`,
    [RECIPE_A.plineForm, seed.promotionId, seed.cdate],
  );
  const n = Number((result as ResultSetHeader).affectedRows);
  // eslint-disable-next-line no-console
  console.log(`SEED_CLEANUP deleted=${n} promotionId=${seed.promotionId} cdate=${seed.cdate}`);
  return n;
}

function assertRecipeA(rule: RuleRow) {
  if (rule.pline_form !== RECIPE_A.plineForm) {
    throw new Error(
      `seedViaDb Recipe A 仅支持 pline_form=${RECIPE_A.plineForm}，实际=${rule.pline_form}`,
    );
  }
  if (rule.data_type !== RECIPE_A.dataType) {
    throw new Error(
      `seedViaDb Recipe A 仅支持 data_type=${RECIPE_A.dataType}，实际=${rule.data_type}`,
    );
  }
}

function parseConsumeCondition(conditionsJson: string): {
  compareType: string;
  val1: number;
  val2?: number;
} {
  let list: Condition[];
  try {
    list = JSON.parse(conditionsJson) as Condition[];
  } catch {
    throw new Error(`seedViaDb: conditions JSON 解析失败: ${conditionsJson}`);
  }
  if (!Array.isArray(list) || !list.length) {
    throw new Error('seedViaDb: conditions 为空');
  }
  const cond = list[0];
  if (cond.column !== RECIPE_A.column) {
    throw new Error(
      `seedViaDb Recipe A 仅支持 column=${RECIPE_A.column}，实际=${cond.column}`,
    );
  }
  if (cond.timeType !== '0') {
    throw new Error(`seedViaDb Recipe A 仅支持 timeType=0(当天)，实际=${cond.timeType}`);
  }
  if (cond.val1 == null || Number.isNaN(Number(cond.val1))) {
    throw new Error(`seedViaDb: 缺少有效阈值 val1: ${conditionsJson}`);
  }
  return {
    compareType: cond.compareType || 'le',
    val1: Number(cond.val1),
    val2: cond.val2 == null ? undefined : Number(cond.val2),
  };
}

/** 使 sum(consume) 落在比较式真侧（Recipe A 单行即可） */
function computeHitConsume(compareType: string, val1: number, val2?: number): number {
  switch (compareType) {
    case 'le':
      if (val1 <= 0) return val1;
      return Math.min(1, val1);
    case 'lt':
      if (val1 <= 0) {
        throw new Error(`seedViaDb: compareType=lt 且 val1=${val1} 无法造正消耗命中`);
      }
      return Math.min(1, val1 / 2);
    case 'ge':
      return val1;
    case 'gt':
      return val1 + 1;
    case 'between': {
      if (val2 == null) throw new Error('seedViaDb: between 缺少 val2');
      return Number(((val1 + val2) / 2).toFixed(2));
    }
    default:
      throw new Error(`seedViaDb: 未支持的 compareType=${compareType}`);
  }
}
