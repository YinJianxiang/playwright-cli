# 05 · 造数剧本 seed recipes

实现位置（约定）：共享 `tests/e2e/helpers`（`db.ts` + 未来 `seed/ad-control.ts`）；批次 helpers **只引用**，不复制连接代码。  
契约：[`../../../ui-flow-db/references/seed-contract.md`](../../../ui-flow-db/references/seed-contract.md)。

## 总原则

1. 读规则（UI 已建 / 或库 `ad_data_control_rule`）→ 得 `pline_form`、`data_type`、时间、指标、阈值、状态。  
2. 按 [03](03-schema-facts.md) 选表；按 [04](04-field-mapping.md) 填列。  
3. `mode=hit`：聚合结果使比较为真；`miss`：为假（分册未细定义前可不做）。  
4. 带可识别标记（如专用 `promotion_id` / 备注前缀 `e2e_dc_`）便于清理。  
5. **禁止**臆造未在 03 出现的表。

## Recipe A · 默认冒烟 hit（优先实现）

**规则形态：** 新媒体-免费短剧 · 广告 · 当天 · 累计消耗 · ≤ `threshold` · 广告状态开启 · 其它多「不限」

| 步骤 | 动作 |
|------|------|
| 1 | `pingDb()` 确认连通 |
| 2 | `planSeedViaDb(ruleId)` 规划行（不写库） |
| 3 | `formatSeedPlanForm(plan)` 以表单展示；**等用户确认** |
| 4 | 确认后 `seedViaDb(ruleId, { confirmed: true, plan })`（或 `applySeedViaDb(plan)`） |
| 5 | 表：`ad_advertiser_online_free_promotion_hour`；`pline_form='cpsvideomf'`，`cdate=CURDATE()` |
| 6 | `sum(consume)` ∈ 命中区间；`promotion_status` 用「投放中」等可通过开启过滤的值 |
| 7 | 调 Job → 记录页应出现 ruleId |

示例骨架（列需按实表补全，勿直接盲跑）：

```sql
-- 示意：先 DESCRIBE 再改列
INSERT INTO ad_advertiser_online_free_promotion_hour
  (cdate, hour, pline_form, promotion_id, consume, promotion_status /* , ... */)
VALUES
  (CURDATE(), HOUR(NOW()), 'cpsvideomf', :e2e_promotion_id, :consume_hit, '投放中');
```

> 「投放中」是否适用于 free 表：以 `SELECT DISTINCT promotion_status FROM ... LIMIT 20` 校准；若非 HM，开启过滤是 `<>已暂停 AND <>已删除`，其它非空值也可能过。

## Recipe B · 近 N 天消耗（未作为默认）

- 表：`ad_advertiser_online_free_promotion_day`  
- `cdate` 落在 Job 的 recent 窗口  
- 同样 `pline_form` + `promotion_id` + `consume`

## Recipe C · 其它业务线

按 [03](03-schema-facts.md) 换表族与 `pline_form`；指标列按公式写入分子字段（不只写 consume）。  
ROI 类 hit：保证 `consume>0` 且比率落在运算符一侧。

## 当前代码状态

- `tests/e2e/helpers/db.ts`：连接 / query / ping — **已有**  
- `tests/e2e/helpers/seed/ad-control.ts`：`planSeedViaDb` / `formatSeedPlanForm` / `applySeedViaDb` / `seedViaDb`（须确认） / `cleanupSeedViaDb` — **已实现**  
- 批次 helpers 只 `import` 共享 seed，不复制连接 / INSERT  

## 验证

1. `npm run db:ping`  
2. 造数后手工：`SELECT sum(consume) FROM ... WHERE promotion_id=? AND cdate=CURDATE()`  
3. 跑 Job + 记录页  
