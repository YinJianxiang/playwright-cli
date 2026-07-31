# 广告管控默认填表偏好

供 `default`/冒烟整表使用，以及 `full`/`scoped` 的**非测试轴（B 层）**。  
通用规则见历史 default-preferences（用例生成 skill 已移除；本文件仅作证据归档）。

> 文案以 explore 实探为准（批次参考 `tests/e2e/generated/*/explore/report.md` + `baseline-fill.json`）。

| 区域/字段 | 层 | 默认行为 |
|-----------|----|----------|
| 新建按钮 | — | **新建规则管控**（勿写「新建管控规则」） |
| 维度 | A | 广告（选项：广告 / 渠道 / 项目 / 负责人）；矩阵可覆盖 |
| 业务线 | A | **新媒体-免费短剧**（勿写「免费短剧」；完整 options 见 explore） |
| 规则名称 | A | `auto_dc_{timestamp}`；locator：`textarea[placeholder="请输入规则名称"]` |
| 投放版本 / 投放方式 | A 或 B | 矩阵点名则 A；否则按 baseline / 有控件才填 |
| 小程序类型 / 媒体 / 主体 / 创建时间 / 自投代理 / 是否漫剧 / 竞价策略 | B | **有「不限」则选不限**（降低 Job WHERE）；媒体常为「头条媒体」 |
| 转化目标 | B | 有「不限」→不限；全域等无「不限」→ baseline/options[0]（须记 `form.applied`，seed 对齐或 gap） |
| 广告状态 | B | **开启**（与 capability `statusDefaults.promotion_status` 可过开启过滤一致） |
| 项目状态 | B | 维度=项目 → **开启**；否则「不限」 |
| 管控条件：时间范围 / 条件 / 指标 / 运算符 / 数值 | A | 当天 / 累计 / 消耗 / 小于等于 / 1–10 整型（矩阵覆盖） |
| 执行动作 / 执行周期 | A 或 B | 预警；每30分钟（模型预测 ROI 等禁用 30 分时用每1小时，见 baseline） |
| 负责人 | B | **不限**（点名则 A）；`owner`；填表末尾 |
| 主体 | B | **不限**；`subject`；勿用 `.env` |
| 客户端管控生效剧目 / 白名单 | C | **不填写** |

**为何 B 层优先「不限」：** 具体负责人/主体/转化目标会进规则过滤；造数若未对齐会导致 Job 不命中（假 MISS）。状态默认「开启」须与 [`db/seed-capability.json`](db/seed-capability.json) 的 `statusDefaults` 一致。

## 冲突与缺字段

- 偏好值不在页面 options → 降级（优先「不限」，否则 options[0]），记 report，**继续**
- 当前维度下无此控件 → **跳过**，记 report

