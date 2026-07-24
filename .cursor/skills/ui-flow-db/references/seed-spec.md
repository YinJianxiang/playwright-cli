# seed-spec（批次造数契约）

本批「要造什么」；「能不能造」见 `domains/<biz>/db/seed-capability.json`。

## 落点

`tests/e2e/generated/<batch>/explore/seed-spec-<ruleId>-<mode>.json`  
（`planSeedViaDb(..., { specOutDir })` 自动写出；也可手写后 `planFromSeedSpecFile`）

## 字段

| 字段 | 说明 |
|------|------|
| `scenario` | 固定 `rule_trigger`（管控命中；非看板展示） |
| `biz` | 如 `ad-control` |
| `ruleId` | 规则主键 |
| `mode` | `hit` \| `miss` |
| `recipeKey` | 可选；plan 后回填，须与规则解析一致 |
| `rowStrategy` | `synthetic` \| `copy-then-patch` |
| `pairId` / `role` | 成对用例：`trigger` / `non_trigger` |
| `expected` | column + compare + val（审计） |
| `blocked` | 有值则禁止 plan/apply |

## 示例（hit）

```json
{
  "scenario": "rule_trigger",
  "biz": "ad-control",
  "ruleId": "12345",
  "mode": "hit",
  "recipeKey": "cpsvideomf|promotion|0|consume",
  "rowStrategy": "copy-then-patch",
  "pairId": "case-consume-le",
  "role": "trigger",
  "expected": { "column": "consume", "compareType": "le", "val1": 10 }
}
```

## 示例（成对 miss）

同一 `pairId`，`mode=miss`，`role=non_trigger`；两次 plan/apply，实体 ID 不同。

与 `cases-flow` 对齐：`<pairId>-HIT` ↔ `mode=hit`；`<pairId>-MISS` ↔ `mode=miss`。流程用例说明书强制成对，见 [case-spec.md](../../ui-flow-codegen/references/case-spec.md)。

## 与流水线

```text
cases-flow / 规则
  → 写 seed-spec（或 plan 时带 specOutDir）
  → capability 门禁
  → plan（copy-then-patch | synthetic + hit|miss）
  → 确认 → apply → verify → seed-log.json
```
