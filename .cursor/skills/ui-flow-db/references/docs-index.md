# DB 文档总索引

业务注册与入口已统一到：

**[`../domains/README.md`](../domains/README.md)**

Agent：未指定 biz → 询问后停止。指定后读 `domains/<biz>/db/README.md`（读序 `01`–`06`）。

## 读序（每个业务 DB 包）

1. `domains/<biz>/README.md`  
2. `domains/<biz>/db/README.md` → `01` … `06` → `changelog.md`  
3. `domains/<biz>/db/_inbox/` — 未消化原始资料（有则列入缺口）  

造数契约：[seed-contract.md](seed-contract.md)（通用流水线）。  
批次 seed-spec：[seed-spec.md](seed-spec.md)。  
业务可造矩阵：`domains/<biz>/db/seed-capability.json`。  
连接变量：[../env-db.md](../env-db.md)。  
