# DB 文档总索引

业务注册与入口已统一到：

**[`../domains/README.md`](../domains/README.md)**

Agent：未指定 biz → 询问后停止。指定后读 `domains/<biz>/SKILL.md` 并按任务加载三域知识。

## 读序（每个业务 DB 包）

1. `domains/<biz>/README.md`  
2. `domains/<biz>/knowledge/` — 正式机器知识  
3. `domains/<biz>/evidence/` — 只读证据和 refresh 候选来源  

造数契约：[seed-contract.md](seed-contract.md)（通用流水线）。  
批次 seed-spec：[seed-spec.md](seed-spec.md)。  
业务可造矩阵：`domains/<biz>/knowledge/conditions.json`；Seed 只读取派生的 `knowledge/seed-runtime-v3.json`。  
连接变量：[../env-db.md](../env-db.md)。  
