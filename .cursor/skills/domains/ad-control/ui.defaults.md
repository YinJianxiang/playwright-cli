# 广告管控默认填表偏好

供 `default`/冒烟整表使用，以及 `full`/`scoped` 的非覆盖字段。  
通用规则见 [`../../ui-flow-codegen/references/default-preferences.md`](../../ui-flow-codegen/references/default-preferences.md)。

> 文案以 explore 实探为准（批次参考 `tests/e2e/generated/*/explore/report.md`）。

| 区域/字段 | 默认行为 |
|-----------|----------|
| 新建按钮 | **新建规则管控**（勿写「新建管控规则」） |
| 维度 | 广告（选项：广告 / 渠道 / 项目 / 负责人） |
| 业务线 | **新媒体-免费短剧**（勿写「免费短剧」；完整 options 见 explore） |
| 规则名称 | `auto_dc_{timestamp}`；locator：`textarea[placeholder="请输入规则名称"]` 或 `getByPlaceholder('请输入规则名称')` |
| 小程序类型 / 媒体 / 主体 / 项目创建时间 / 自投代理 等 | 有「不限」则选不限；媒体默认页上常为「头条媒体」 |
| 管控条件：时间范围 | 当天（控件名是「时间范围」，不是「时间周期」） |
| 管控条件：条件 | 累计（若 options 含累计） |
| 管控条件：指标 | 消耗（全量展开指标轴时由矩阵行覆盖） |
| 管控条件：运算符 | 小于等于 |
| 管控条件：数值 | 1–10 内整型 random（含边界） |
| 执行动作 | **预警**（勿写「报警」） |
| 执行周期 | 每30分钟 |
| 负责人 | **`ep-select-v2`**：未指定 →「不限」；用户/矩阵指定人名 → 选该人（不在 options 则降级不限并记偏差）；**填表末尾再选**；form 字段名 `owner` |
| 主体 | 未指定 →「不限」；指定 → `subject`；勿用 `.env` |
| 客户端管控生效剧目 / 白名单 | 不填写 |

## 冲突与缺字段

- 偏好值不在页面 options → 降级（优先「不限」，否则 options[0]），记 report，**继续**
- 当前维度下无此控件 → **跳过**，记 report
