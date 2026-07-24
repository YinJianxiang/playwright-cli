# 用例说明书模板

每条 **matrix 行 / 每个 `test()`** 对应一节。`generate` 前必须齐全；`spec` 标题与 `test.step` 名与本文对齐。

需求一次解析可产出两套文件（见 [`ui-flow-req-cases`](../../ui-flow-req-cases/SKILL.md)）：

| 文件 | suite | 用途 |
|------|-------|------|
| `{root}/explore/cases-ui.md` | `ui` | 页面交互；断言展示 options |
| `{root}/explore/cases-flow.md` | `flow` | 整链触发；造数 + Job + 记录 |
| `{root}/explore/cases.md` | 兼容旧批次 | 若仅有此文件，视为 **flow**（或单套未分 suite） |

控件「怎么点」细节仍以 `report.md`「操作方式（已验证）」为准；本文写**用例级**故事。

---

## 文件头（必填）

```markdown
# 用例说明书

- domain: <biz>
- 批次: {yyyyMMdd-HHmmss}
- suite: ui | flow
- mode: smoke | full | scoped
- 本任务 scope: <维度/业务线/点名条件摘要>
```

---

## suite=ui（页面交互 / options）

路径：`{root}/explore/cases-ui.md`

```markdown
## UI-<CASE_ID>

### 测什么
某维度×业务线下，指标（或指定字段）选项是否符合需求

### 选择因
- 维度: 广告
- 业务线: 新媒体-免费短剧

### 目标字段
指标

### 期望展示（options）
- A
- B
- C

### 断言方式
含集 | 全量相等
（默认含集：实际 options ⊇ 期望清单）

### 怎么操作（执行步骤）
1. 准备：登录、进入规则列表、打开新建
2. 交互：按选择因切换维度、业务线等
3. 打开目标下拉（如指标）
4. 断言：可见 options 符合「期望展示」与断言方式

### 页面操作要点（explore）
- 引用 report 已验证路径；只列本用例关键控件

### 预期终态
下拉展示符合期望；**不提交规则 / 不开开关 / 不造数 / 不调 Job**

### 产物引用
- matrix 行 id: UI-<CASE_ID>
- spec: `test('UI-<CASE_ID>: …')` → `specs/ui/`
```

门禁（ui）：每节必须含 **测什么、选择因、期望展示（options）、怎么操作、预期终态**。

---

## suite=flow（整链触发）

路径：`{root}/explore/cases-flow.md`（或旧 `cases.md`）

### 硬性：触发条件成对（生效 + 不生效）

同一套规则条件（时间/聚合/指标/运算符/阈值）必须产出 **一对** 说明书节，不得只写正向命中：

| 后缀 | seed `mode` | `role` | 预期终态 |
|------|-------------|--------|----------|
| `-HIT` | `hit` | `trigger` | 记录页出现本规则命中（生效） |
| `-MISS` | `miss` | `non_trigger` | 有造数但不触发；记录页**无**本次 miss 实体对应命中（不生效） |

- 共用同一 `pairId`（建议 = 无后缀的逻辑 id，如 `FLOW-GLOBAL-ROI-001`）
- **同一规则、同一阈值**；只改造数落点（比较真侧 / 假侧）；miss 也必须有数，禁止用「没造数」冒充不生效
- matrix / `test()`：**一对 = 两行 / 两个 test**（`…-HIT` 与 `…-MISS`）
- 条件未齐时：一对都标 `blocked: need-conditions`，仍须写出 HIT+MISS 骨架，禁止只留单条占位
- 造数契约见 [`ui-flow-db/references/seed-spec.md`](../../ui-flow-db/references/seed-spec.md)

```markdown
## <CASE_ID>-HIT

### 测什么
<一句话> — 条件命中应生效

### 规则 / 数据条件
| # | 时间 | 聚合 | 指标 | 运算符 | 阈值 |
|---|------|------|------|--------|------|
| 1 | … | … | … | … | … |

- seed: `mode=hit`；`pairId=<CASE_ID>`；`role=trigger`
- 其它前置（规则字段、开关）写在表下

若条件未齐：标注 `blocked: need-conditions`，**询问用户补充**后再定稿；禁止编造阈值。

### 怎么操作（执行步骤）
1. 准备：…
2. 建规则 / 开开关：…（与同 pair 的 MISS 共用同一规则，或本 test 内自建后复用 ruleId）
3. 造数：`mode=hit`（链 seed-spec / seed-plan）
4. 调 Job：…
5. 验记录：应出现命中

### 预期终态
记录页出现本规则对本 hit 实体的管控记录（唯一可判定；禁止「有则…无则…」）

### 产物引用
- matrix 行 id: <CASE_ID>-HIT
- pairId: <CASE_ID>
- seed mode: hit
- spec: `test('<CASE_ID>-HIT: …')` → `specs/flow/`

---

## <CASE_ID>-MISS

### 测什么
<同上条件> — 有数但不生效

### 规则 / 数据条件
（与 HIT **同一张条件表**）

- seed: `mode=miss`；同一 `pairId=<CASE_ID>`；`role=non_trigger`；**不同实体 ID**

### 怎么操作（执行步骤）
1. 准备：…（复用 HIT 已建规则与开关，或文档写明依赖顺序）
2. 造数：`mode=miss`（新实体）
3. 调 Job：…
4. 验记录：不应出现该 miss 实体对应命中

### 预期终态
记录页在约定窗口内**无**本次 miss 实体的命中记录（可判定；禁止含糊表述）

### 产物引用
- matrix 行 id: <CASE_ID>-MISS
- pairId: <CASE_ID>
- seed mode: miss
- spec: `test('<CASE_ID>-MISS: …')` → `specs/flow/`
```

门禁（flow）：每节必须含 **测什么、规则/数据条件、怎么操作、预期终态、pairId/mode**；可跑条件必须以 `-HIT`/`-MISS` 成对出现；存在 `blocked: need-conditions` 时 **禁止** generate flow specs。

---

## 门禁（总）

- `matrix-ui.json` 行 id ↔ `cases-ui.md` 的 `##`；`matrix-flow.json` ↔ `cases-flow.md`（或兼容 `matrix.json` ↔ `cases.md`）  
- flow：每个 `pairId` 必须同时有 `-HIT` 与 `-MISS` 两行  
- generate：`test` 名 = `<CASE_ID>: <短标题>`；`test.step` 名与「怎么操作」一致  
- **缺对应说明书 → 禁止 generate**  
- UI 与 flow **不得**写进同一个 `test()`  
- HIT 与 MISS **不得**写进同一个 `test()`（各一 test）  
