# 业务 Domain 注册表

Agent：未指定业务时 **先询问用户**，禁止默认某一业务。  
指定后进入 `domains/<biz>/README.md`。  

**有需求 MD**：先跑 `ui-flow-req-cases` 一次产出 `cases-ui` + `cases-flow`（生成一块）。  
**生成自动化 / 跑测前**：指定 `suite=ui|flow`，再对本任务跑 `ui-flow-explore`（见 `ui-flow-codegen`）；禁止用错配旧 explore 直接生成。执行分开，一次一个 suite。

| biz id | 说明 | 入口 |
|--------|------|------|
| `ad-control` | 广告管控（UI + Job + DB 造数） | [ad-control/README.md](ad-control/README.md) |

## 新增业务

1. 建 `domains/<biz>/`（至少 `README.md`、`ui.md`；有 Job 则 `apis.md`；有造数则 `db/`）  
2. 在上表登记  
3. 通用 skill **只引用**本目录，不写业务 URL/表名  
