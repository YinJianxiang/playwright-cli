# 06 · 清理约定

## 识别本批造数

建议约定（实现时写入）：

| 标记 | 用法 |
|------|------|
| `promotion_id` / `plan_id` 号段 | 专用测试号段或前缀策略 |
| 可选备注列 | 若表有 remark/扩展字段含 `e2e_dc_` |
| 规则名 | UI `auto_dc_*`（规则清理走 UI，见 UI domain） |

## 事实行删除

用 `cleanupSeedViaDb`（按 SeedResult 的 `table` / `plineForm` / `promotionId` / `cdate`）。示意：

```sql
DELETE FROM /* plan.table，须 ∈ seed-capability 白名单 */
WHERE pline_form = :pline
  AND promotion_id = :e2e_promotion_id
  AND cdate = :seed_cdate;
```

标记前缀见 capability `markerPrefix`（默认 `e2e_dc_`）。**禁止**无 WHERE 的 DELETE。

## 与规则删除

| 数据 | 方式 |
|------|------|
| 管控规则 | UI 删除或 `E2E_DELETE_RULE`；validate Skill 询问 |
| 事实造数 | 本分册；跑完询问或与规则删除一并清理 |

## 注意

- 共享测试库：只删本批标记行  
- 关规则开关 ≠ 删事实数据  
- 未实现自动清理前：手册按 seed 日志中的 ID 删  
