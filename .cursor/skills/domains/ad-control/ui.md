# 广告管控（UI domain）

本文件描述**本业务**的流程、入口与探索清单。  
枚举不写死：来自 explore、[ui.defaults.md](ui.defaults.md)、或用户 scoped 点名。

通用探索/生成方法见 `ui-flow-explore` / `ui-flow-generate`；本文件只补领域细节。

## 页面

| 页面 | URL |
|------|-----|
| 规则列表 | http://192.168.0.215/newdz/home#/newdz/admonitorbyte/rule |
| 管控记录 | http://192.168.0.215/newdz/home#/newdz/admonitorbyte/record |

- 入口按钮：**新建规则管控**（勿写成「新建管控规则」）  
- 列表名称筛 placeholder：`请输入广告规则名称`  
- 侧栏 menuitem 须 **exact**：`广告管控规则` / `广告管控记录`（勿用模糊「广告管控」）  

## 业务链路

```text
登录 → 规则页新建 → 列表取广告规则ID → 打开开关
  → [DB造数：见 db/] → GET Job(ruleId)
  → 记录页轮询出现该 ruleId → 关闭开关 → 询问是否删除
```

用例 step 建议名：准备 / 建规则 / 开开关 / 造数 / 调Job / 验记录 / 收尾开关。

## 全量覆盖轴

**维度 × 业务线 × 指标**（指标在管控条件行内）。

## 新建表单（字段标签，以 explore 为准）

### 管控维度配置

- 维度（随选项切换，字段集会变，如广告维度下出现「广告创建时间」「短剧上架时间」等）  
- 规则名称（`请输入规则名称`）  
- 业务线、小程序类型、媒体、负责人、主体、创建时间类、自投/代理、状态类等  

### 管控条件配置

- 条件行：时间范围、条件、指标、运算符、数值  
- ROI 提示：百分数用小数（80% → 0.8）  

### 管控动作配置

- 执行动作（如 **预警**）、执行周期、跳过时段  
- 白名单/剧目类：默认不填（见 defaults）  

## 探索清单（领域，配合通用 Checklist）

```text
- [ ] 进规则列表；特征：按钮「新建规则管控」或 placeholder「请输入广告规则名称」
- [ ] 列表筛选项逐个开合记 options
- [ ] 点「新建规则管控」；验证维度 radio（EP 可能需点 .el-radio-button__inner）
- [ ] 切到本次 mode 目标维度（如广告）；全字段必填/选填/options/操作方式
- [ ] 负责人等无名 combobox：用 group/表单项定位；探针区分 `el-select` vs `el-select-v2`
- [ ] 条件/指标 options 必须采到
- [ ] 记列「广告规则ID」、行内 switch、操作：详情/编辑/复制/删除/查看管控记录
- [ ] 进记录页：按规则 ID/名称过滤方式
```

## 交互注意（本业务常见）

- UI 多为 Element Plus（`el-drawer`/`el-dialog`、`el-select` / **`el-select-v2`**、`el-radio-button`）  
- 维度切换后标签可能从「项目创建时间」变为「广告创建时间」等，必须以当前上下文回写  
- **同一下拉外观不代表同一模式**；`el-select` ≠ `el-select-v2`（见 ui-flow-codegen `control-patterns`）  
- 确认新建后可能还有 MessageBox「确认提交吗？」→ 再点确定  
- 负责人等 v2：**填表末尾再选**，避免被后续下拉冲掉  

## 已知控件模式（探索预置）

| 字段 | 模式 | 备注 |
|------|------|------|
| 业务线 / 小程序类型 / 媒体 / 时间范围 / 条件 / 指标 / 运算符 | `static-select` | 点开即有 `role=option` |
| 负责人 | `ep-select-v2` + `nameless-combo` | group 内；wrapper + option-item；**form.owner 优先**，未指定才「不限」；**填表末尾再选** |
| 主体 | 常 `static-select`（有 name）；若探针为 v2 则按 `ep-select-v2` | **form.subject 优先**，未指定才「不限」；勿写 `.env` |
| 维度 / 执行动作 / 执行周期 / 短剧上架时间等 | `ep-radio-button` | 点 inner 文案 |

探索须用探针确认；预置被探针推翻时以探针为准并回写本表。

## ruleId / 开关 / 断言

- 按唯一规则名搜列表，读「广告规则ID」  
- Job / 验记录前开开关；结束后关开关  
- 断言：记录页出现该 ruleId；轮询 10s / 最长 120s（见 [apis.md](apis.md)）  

## 删除

- 默认不删；跑完询问；非交互 `E2E_DELETE_RULE=1`  

## DB 造数

- 分册：[db/README.md](db/README.md)（`01`–`06`；原始资料 `db/_inbox/`）  
- 流程：编排 Step 2b 见 `ui-flow-db/SKILL.md`  
- 实现 `seedViaDb` 按 `db/05-seed-recipes.md` Recipe A  
- 与测试 SQL 冲突时以 **market-job DataControl** 为准  
