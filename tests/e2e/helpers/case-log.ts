import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';

export type CaseLogKind = 'STEP' | 'ASSERT' | 'INFO' | 'ERROR';

export type CaseLogRecord = {
  ts: string;
  caseId: string;
  kind: CaseLogKind;
  name: string;
  ok?: boolean;
  detail?: unknown;
  durationMs?: number;
  error?: string;
};

export type CaseLogger = {
  readonly filePath: string;
  readonly mdPath: string;
  readonly caseId: string;
  info: (name: string, detail?: unknown) => void;
  assert: (name: string, ok: boolean, detail?: unknown) => void;
  /** 写 STEP 起止，并包一层 test.step */
  step: <T>(name: string, fn: () => Promise<T>, detail?: unknown) => Promise<T>;
  /** flush + 写 md + 挂到当前 test 附件（Allure/HTML） */
  close: () => Promise<void>;
};

function safeFileName(caseId: string): string {
  return caseId.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
}

function writeLine(fd: number, record: CaseLogRecord): void {
  fs.writeSync(fd, `${JSON.stringify(record)}\n`);
}

function sqlLiteral(v: unknown): string {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** 由拟插入行生成可读 INSERT（供 MD 操作记录） */
export function formatInsertSql(
  table: string,
  row: Record<string, unknown>,
): string {
  const cols = Object.keys(row);
  if (!cols.length) return `-- 无字段\n-- INTO ${table}`;
  const colList = cols.map((c) => `\`${c}\``).join(', ');
  const vals = cols.map((c) => sqlLiteral(row[c])).join(', ');
  return `INSERT INTO \`${table}\` (${colList})\nVALUES (${vals});`;
}

function asRecord(detail: unknown): Record<string, unknown> | null {
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    return detail as Record<string, unknown>;
  }
  return null;
}

function mdEscapeCell(v: unknown): string {
  return String(v ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

/**
 * 把 JSONL 记录整理成可读操作报告：步骤、规则指标、造数 SQL、Job、触发记录。
 */
export function formatCaseRunMarkdown(records: CaseLogRecord[]): string {
  const caseId = records[0]?.caseId ?? 'UNKNOWN';
  const meta = records.find((r) => r.kind === 'INFO' && r.name === 'case.meta');
  const metaDetail = asRecord(meta?.detail) ?? {};
  const form = asRecord(metaDetail['规则条件']) ?? asRecord(metaDetail.form) ?? {};
  const errors = records.filter((r) => r.kind === 'ERROR');
  const result = errors.length ? 'FAIL' : 'PASS';
  const started = records[0]?.ts ?? '';
  const ended = records[records.length - 1]?.ts ?? '';

  const lines: string[] = [
    `# ${caseId}`,
    '',
    `| 项 | 值 |`,
    `|----|----|`,
    `| 结果 | **${result}** |`,
    `| 开始 | ${started} |`,
    `| 结束 | ${ended} |`,
    `| suite | ${mdEscapeCell(metaDetail.suite ?? '')} |`,
    `| pairId | ${mdEscapeCell(metaDetail.pairId ?? '')} |`,
    `| mode | ${mdEscapeCell(metaDetail.mode ?? '')} |`,
    `| 测什么 | ${mdEscapeCell(metaDetail['测什么'] ?? metaDetail.title ?? '')} |`,
    '',
    `## 1. 操作步骤`,
    '',
    `| 步骤 | 结果 | 耗时(ms) | 说明 |`,
    `|------|------|----------|------|`,
  ];

  const stepNames = new Set<string>();
  for (const r of records) {
    if (r.kind === 'STEP' && r.detail && asRecord(r.detail)?.phase === 'start') {
      stepNames.add(r.name);
    } else if (r.kind === 'STEP' && r.ok === true) {
      stepNames.add(r.name);
    } else if (r.kind === 'ERROR') {
      stepNames.add(r.name);
    }
  }

  for (const name of stepNames) {
    const end = [...records]
      .reverse()
      .find(
        (r) =>
          (r.kind === 'STEP' && r.name === name && r.ok === true) ||
          (r.kind === 'ERROR' && r.name === name),
      );
    const ok =
      end?.kind === 'ERROR' ? 'FAIL' : end?.ok === true ? 'OK' : '—';
    const note =
      end?.kind === 'ERROR'
        ? end.error ?? ''
        : '';
    lines.push(
      `| ${mdEscapeCell(name)} | ${ok} | ${end?.durationMs ?? ''} | ${mdEscapeCell(note)} |`,
    );
  }

  lines.push('', '## 2. 规则选取值', '');

  lines.push('### 2.1 用例意图（case.meta.规则条件）', '');
  if (Object.keys(form).length) {
    lines.push('| 字段 | 值 |', '|------|----|');
    for (const [k, v] of Object.entries(form)) {
      if (k === 'extraCondition') continue;
      lines.push(`| ${mdEscapeCell(k)} | ${mdEscapeCell(typeof v === 'object' ? JSON.stringify(v) : v)} |`);
    }
  } else {
    lines.push('_（无 case.meta.规则条件）_');
  }

  const extra = form.extraCondition;
  if (extra && typeof extra === 'object') {
    lines.push('', '#### 附加条件（双条件）', '', '| 字段 | 值 |', '|------|----|');
    for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
      lines.push(`| ${mdEscapeCell(k)} | ${mdEscapeCell(v)} |`);
    }
  }

  // 逐项点击：优先 form.clicks 汇总，否则收集每条 ui.click
  const clicksInfo = records.find((r) => r.kind === 'INFO' && r.name === 'form.clicks');
  const clicksFromSummary = asRecord(clicksInfo?.detail)?.clicks;
  const clickRows: Array<Record<string, unknown>> = Array.isArray(clicksFromSummary)
    ? (clicksFromSummary as Array<Record<string, unknown>>)
    : records
        .filter((r) => r.kind === 'INFO' && r.name === 'ui.click')
        .map((r) => asRecord(r.detail) ?? {});

  lines.push('', '### 2.2 逐项点击（建规则 UI）', '');
  if (clickRows.length) {
    lines.push('| # | 控件 | 操作 | 选取值 | 来源 |', '|---|------|------|--------|------|');
    clickRows.forEach((c, i) => {
      const seq = c.seq ?? i + 1;
      lines.push(
        `| ${mdEscapeCell(seq)} | ${mdEscapeCell(c.field)} | ${mdEscapeCell(c.control ?? '')} | ${mdEscapeCell(c.value)} | ${mdEscapeCell(c.source ?? 'fill')} |`,
      );
    });
  } else {
    lines.push(
      '_（无 ui.click / form.clicks — 请确认 `createRule(page, form, { log })` 已传入 case log）_',
    );
  }

  const applied = records.find((r) => r.kind === 'INFO' && r.name === 'form.applied');
  const appliedDetail = asRecord(applied?.detail);
  lines.push('', '### 2.3 实际提交值（form.applied）', '');
  if (appliedDetail) {
    lines.push('| 字段 | 值 |', '|------|----|');
    for (const [k, v] of Object.entries(appliedDetail)) {
      lines.push(
        `| ${mdEscapeCell(k)} | ${mdEscapeCell(typeof v === 'object' ? JSON.stringify(v) : v)} |`,
      );
    }
  } else {
    lines.push('_（无 form.applied）_');
  }

  const heals = records.filter((r) => r.kind === 'INFO' && r.name === 'baseline.heal');
  if (heals.length) {
    lines.push('', '### 2.4 提交前 heal 补全', '', '| 控件 | 补选值 |', '|------|--------|');
    for (const h of heals) {
      const d = asRecord(h.detail) ?? {};
      lines.push(`| ${mdEscapeCell(d.label)} | ${mdEscapeCell(d.picked)} |`);
    }
  }

  lines.push('', '## 3. 造数（SQL）', '');
  const seedResult = records.find((r) => r.kind === 'INFO' && r.name === 'seed.result');
  const seedGap = records.find((r) => r.kind === 'INFO' && r.name === 'seed.gap');
  const seedPlan = records.find((r) => r.kind === 'INFO' && r.name === 'seed.plan');
  const seedVerify = records.find((r) => r.kind === 'ASSERT' && r.name === '造数 verify');

  const sr = asRecord(seedResult?.detail);
  if (sr) {
    lines.push('| 项 | 值 |', '|----|----|');
    for (const key of [
      'ruleId',
      'recipeKey',
      'mode',
      'table',
      'plineForm',
      'insertId',
      'promotionId',
      'cdate',
      'hour',
    ]) {
      if (sr[key] != null && sr[key] !== '') {
        lines.push(`| ${key} | ${mdEscapeCell(sr[key])} |`);
      }
    }
    // 预警记录常用身份字段（优先从 rows[0] / seed.result 顶层取）
    const seedRow =
      Array.isArray(sr.rows) && sr.rows[0] && typeof sr.rows[0] === 'object'
        ? (sr.rows[0] as Record<string, unknown>)
        : {};
    for (const key of [
      'account',
      'channel_code',
      'book_id',
      'book_name',
      'app_name',
      'agent_user_name',
      'project_id',
      'project_name',
    ]) {
      const v = sr[key] ?? seedRow[key];
      if (v != null && v !== '') {
        lines.push(`| ${key} | ${mdEscapeCell(v)} |`);
      }
    }
    if (sr.metricValues) {
      lines.push(`| metricValues | ${mdEscapeCell(JSON.stringify(sr.metricValues))} |`);
    }
    if (sr.verify) {
      lines.push(`| verify | ${mdEscapeCell(JSON.stringify(sr.verify))} |`);
    }
    if (sr.ruleFilters) {
      lines.push('', '### 规则过滤（ruleFilters）', '', '```json');
      lines.push(JSON.stringify(sr.ruleFilters, null, 2));
      lines.push('```');
    }
    const table = String(sr.table ?? '');
    const rows = Array.isArray(sr.rows) ? sr.rows : [];
    if (table && rows.length) {
      lines.push('', '### INSERT SQL', '');
      for (const row of rows) {
        if (row && typeof row === 'object') {
          lines.push('```sql');
          lines.push(formatInsertSql(table, row as Record<string, unknown>));
          lines.push('```', '');
        }
      }
    }
  } else if (seedGap) {
    lines.push(`**SEED_GAP**：${mdEscapeCell(asRecord(seedGap.detail)?.message ?? seedGap.detail)}`);
  } else if (seedPlan) {
    const text = asRecord(seedPlan.detail)?.text;
    lines.push('_仅有 seed.plan 预览（未记录 seed.result）_', '');
    if (typeof text === 'string') {
      lines.push(text);
    }
  } else {
    lines.push('_（本 run 未记录造数）_');
  }

  if (seedVerify) {
    lines.push(
      '',
      `造数 verify：${seedVerify.ok ? 'OK' : 'FAIL'} — ${mdEscapeCell(JSON.stringify(seedVerify.detail ?? ''))}`,
    );
  }

  lines.push('', '## 4. 触发 Job', '');
  const jobAssert = records.find((r) => r.kind === 'ASSERT' && r.name === 'Job 已触发');
  if (jobAssert) {
    lines.push('| 项 | 值 |', '|----|----|');
    lines.push(`| 结果 | ${jobAssert.ok ? 'OK' : 'FAIL'} |`);
    const jd = asRecord(jobAssert.detail);
    if (jd?.ruleId != null) lines.push(`| ruleId | ${mdEscapeCell(jd.ruleId)} |`);
  } else {
    const jobErr = errors.find((r) => r.name === '调Job');
    lines.push(jobErr ? `FAIL：${mdEscapeCell(jobErr.error)}` : '_（未触发或未跑到）_');
  }

  lines.push('', '## 5. 触发记录', '');
  const hitAssert = records.find((r) => r.kind === 'ASSERT' && r.name === '记录页出现命中');
  const missAssert = records.find((r) => r.kind === 'ASSERT' && r.name === 'miss 实体已造数');
  const recordErr = errors.find((r) => r.name === '验记录');
  if (hitAssert) {
    lines.push(
      `| 项 | 值 |`,
      `|----|----|`,
      `| 期望 | HIT：记录页出现 ruleId |`,
      `| 结果 | ${hitAssert.ok ? 'OK' : 'FAIL'} |`,
      `| detail | ${mdEscapeCell(JSON.stringify(hitAssert.detail ?? ''))} |`,
    );
  } else if (missAssert) {
    lines.push(
      `| 项 | 值 |`,
      `|----|----|`,
      `| 期望 | MISS：仅校验造数实体（不要求记录） |`,
      `| 结果 | ${missAssert.ok ? 'OK' : 'FAIL'} |`,
      `| detail | ${mdEscapeCell(JSON.stringify(missAssert.detail ?? ''))} |`,
    );
  } else if (recordErr) {
    lines.push(`FAIL：${mdEscapeCell(recordErr.error)}`);
  } else {
    lines.push('_（未执行验记录）_');
  }

  if (errors.length) {
    lines.push('', '## 错误摘要', '');
    for (const e of errors) {
      lines.push(`- **${e.name}**：${mdEscapeCell(e.error)}`);
    }
  }

  lines.push(
    '',
    '---',
    '',
    `_机读日志：同目录 \`${safeFileName(caseId)}.jsonl\`_`,
    '',
  );
  return lines.join('\n');
}

/**
 * 每个用例：
 * - `{batchRoot}/logs/{caseId}.jsonl` — 机读
 * - `{batchRoot}/logs/{caseId}.md` — 人读操作记录（步骤 / 规则选取值含逐项点击 / 造数 SQL / Job / 触发记录）
 * 同 case 重跑覆盖。
 */
export function createCaseLog(opts: {
  batchRoot: string;
  caseId: string;
}): CaseLogger {
  const caseId = opts.caseId;
  const dir = path.join(opts.batchRoot, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const base = safeFileName(caseId);
  const filePath = path.join(dir, `${base}.jsonl`);
  const mdPath = path.join(dir, `${base}.md`);
  const fd = fs.openSync(filePath, 'w');
  const records: CaseLogRecord[] = [];

  const emit = (partial: Omit<CaseLogRecord, 'ts' | 'caseId'>): void => {
    const record: CaseLogRecord = {
      ts: new Date().toISOString(),
      caseId,
      ...partial,
    };
    records.push(record);
    writeLine(fd, record);
  };

  return {
    filePath,
    mdPath,
    caseId,
    info(name, detail) {
      emit({ kind: 'INFO', name, detail });
    },
    assert(name, ok, detail) {
      emit({ kind: 'ASSERT', name, ok, detail });
    },
    async step(name, fn, detail) {
      emit({ kind: 'STEP', name, ok: undefined, detail: detail ?? { phase: 'start' } });
      const t0 = Date.now();
      try {
        const result = await test.step(name, fn);
        emit({
          kind: 'STEP',
          name,
          ok: true,
          durationMs: Date.now() - t0,
          detail: detail ?? { phase: 'end' },
        });
        return result;
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        emit({
          kind: 'ERROR',
          name,
          ok: false,
          durationMs: Date.now() - t0,
          error: err,
          detail,
        });
        throw e;
      }
    },
    async close() {
      try {
        fs.closeSync(fd);
      } catch {
        // already closed
      }
      const md = formatCaseRunMarkdown(records);
      fs.writeFileSync(mdPath, md, 'utf8');

      const info = test.info();
      if (fs.existsSync(filePath)) {
        await info.attach(`${caseId}.jsonl`, {
          path: filePath,
          contentType: 'application/x-ndjson',
        });
      }
      if (fs.existsSync(mdPath)) {
        await info.attach(`${caseId}.md`, {
          path: mdPath,
          contentType: 'text/markdown',
        });
      }
    },
  };
}

/**
 * 从 specs/... 推到批次根。
 * 支持 `specs/ui|flow/{CASE}.spec.ts`，以及可选子目录 `specs/ui/ACT/{CASE}.spec.ts`。
 * 向上查找含 explore/ 或 matrix-*.json 的目录；找不到则回退 `../..`。
 */
export function batchRootFromSpecDir(specDir: string): string {
  let dir = path.resolve(specDir);
  for (let i = 0; i < 8; i++) {
    if (
      fs.existsSync(path.join(dir, 'explore')) ||
      fs.existsSync(path.join(dir, 'matrix-ui.json')) ||
      fs.existsSync(path.join(dir, 'matrix-flow.json')) ||
      fs.existsSync(path.join(dir, 'matrix.json'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(specDir, '../..');
}
