# 业务 Domain 注册表

Agent：未指定业务时 **先询问用户**，禁止默认某一业务。  
指定后进入 `domains/<biz>/README.md`。  
**生成用例前**：对本任务跑 `ui-flow-explore`（见 `ui-flow-codegen`「任务级探索」）；禁止用错配旧 explore 直接生成。

| biz id | 说明 | 入口 |
|--------|------|------|
| `ad-control` | 广告管控（UI + Job + DB 造数） | [ad-control/README.md](ad-control/README.md) |

## 新增业务

1. 建 `domains/<biz>/`（至少 `README.md`、`ui.md`；有 Job 则 `apis.md`；有造数则 `db/`）  
2. 在上表登记  
3. 通用 skill **只引用**本目录，不写业务 URL/表名  
