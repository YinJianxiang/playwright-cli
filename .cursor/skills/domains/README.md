# 业务 Domain 注册表

Agent：未指定业务时 **先询问用户**，禁止默认某一业务。  
指定后进入 `domains/<biz>/README.md`。

当前保留 skill：造数 `ui-flow-db`、跑测 `ui-flow-validate`。用例生成 / smoke / explore / generate 编排已移除。

| biz id | 说明 | 入口 |
|--------|------|------|
| `ad-control` | 广告管控（维度 + 条件 + 动作 + Seed V3） | [ad-control/SKILL.md](ad-control/SKILL.md) |
| `ui-ad-control-rule-create` | 广告管控规则创建计划、页面提交与 Seed V3 交接 | [../ui-ad-control-rule-create/SKILL.md](../ui-ad-control-rule-create/SKILL.md) |

## 新增业务

1. 建 `domains/<biz>/`（至少知识与 references；有造数则走 Seed V3）  
2. 在上表登记  
3. 通用 skill **只引用**本目录，不写业务 URL/表名  
